# Agent Inbox

A convention for agents that watch something for a person and need that
person's decisions: a news digest asking which articles were worth it, a
watchlist proposing stocks to look at, an agent asking whether to merge its
pull request.

Two kinds of script take part:

| Part         | Owns                                                                                    | Does not own           |
| ------------ | --------------------------------------------------------------------------------------- | ---------------------- |
| **Producer** | Its sources and schedule, its domain data, what an answer means, what it learns from it | Where the person reads |
| **Inbox**    | Cards and their lifecycle, rendering, bulk answering, deferral, undo, history           | What an answer _means_ |

The engine knows nothing of either. The convention is a set of MCP tool names
and the shapes they take, so any script can be a producer, an inbox, or both,
and a producer works alone when no inbox is there.

```javascript
// Who is asking: the producer's stable name, and which of the person's
// instances. The label is what the person sees.
const producer = (instance) => ({
  name: "news-digest",
  instance: instance.id,
  label: instance.label, // "Sports digest"
});

// The end of a producer's scheduled run, acting as the person
function postToInbox(instance, digest) {
  if (tools.list("inbox_post").length === 0) return; // standalone

  tools.call("inbox_post", {
    producer: producer(instance),
    card: {
      externalId: `digest-${digest.date}`,
      topic: `news:${instance.id}`,
      title: `${digest.items.length} articles`,
      items: digest.items.map((a) => ({
        id: a.id,
        title: a.title,
        links: [{ label: "Read", url: a.url }],
      })),
      options: [
        { id: "relevant", label: "Relevant", style: "primary" },
        { id: "not-relevant", label: "Not relevant", style: "negative" },
      ],
      allowLater: true,
    },
  });
}

// The start of the next run: what the person did since last time
function applyAnswers(instance) {
  const key = `inbox-cursor:${instance.id}`;
  const since = Number(personalStorage.getItem(key) ?? 0);
  const { events, cursor } = tools.call("inbox_events", {
    producer: producer(instance),
    since,
  });
  for (const event of events) applyEvent(event); // the producer's own meaning
  personalStorage.setItem(key, String(cursor));
}
```

## Answers are pulled

The inbox never calls a producer to deliver an answer. The producer asks for
events at the start of its next run and applies them then; what it learns
only matters at that run anyway. An inbox that called producer tools when a
button was pressed would make each button an action taken in the person's
name by code they did not choose. The one exception is
[asking a question](#asking-questions), which only answers.

## Reaching each other

Both directions are `tools.call`, so the engine's rules for it apply:

- **It runs as the person.** A producer's scheduled run calls the inbox as the
  person who scheduled it. Their consent to the producer must include
  `tools` and `write` (check `personalTasks.authorization().scopes`).
- **The inbox stores cards in its own data**, keyed by
  `context.request.auth.userId`, and filters every read by it. A `database`
  table keyed by user needs only `write`; `personalStorage` would need the
  producer's grant to include `personal_storage` as well.
- **They must share a host.** `tools.call` reaches scripts bound to at least
  one host the caller is bound to. Binding a producer to the inbox's host as
  well is how an operator connects them.
- **The inbox decides whom it accepts.** The engine does not tell a tool which
  script called it, so a producer's `producer.name` is a claim. An inbox
  checks it against the producers it has chosen to accept.

## Cards

A card is not a feed item. Producers post what deserves a decision.

```text
producer { name, instance, label?, settingsUrl? }   // settingsUrl may be a path on a shared host

card {
  externalId                     // idempotency: (producer, externalId)
  topic?                         // a newer card with the same topic supersedes
  title, summary?, facts[]?      // facts: [{ label, value }]
  links[]?: { label, url }
  options[]: { id, label, style: primary|neutral|negative,
               weight?: feedback|instruction|consequential }
  boundTo?: { label, value }     // the state an answer depends on
  allowLater?: bool
  suggestedQuestions[]?
  items[]?                       // sub-items, each with its own answer
  expiresAt?
  priority?
}
```

Every call names its `producer`: `name` is the stable identity an inbox
accepts or refuses (`news-digest`), `instance` is which of the person's
copies (`sports`), and `label` is what the person sees ("Sports digest").

Posting the same `externalId` again updates the card, so a retried task does
not post twice. A card may hold items; items hold nothing. The convention has
two levels on purpose: it is for deciding on steps, not for managing a project.

### Three shapes

| Shape         | What it is                                      | Examples                                   |
| ------------- | ----------------------------------------------- | ------------------------------------------ |
| **Batch**     | Items, each answered on its own                 | Today's articles, a watchlist, PR comments |
| **Alert**     | One card per `topic`, replaced by a newer one   | A big price move, a failed build           |
| **Work item** | One card per piece of work, with its next steps | An issue or pull request                   |

A work item is superseded whenever its state changes, and offers only the
steps valid now: no Merge while the build is red.

### Four kinds of control

| Kind     | Examples                         | Effect                                                     |
| -------- | -------------------------------- | ---------------------------------------------------------- |
| Links    | Read the article, open a preview | Opened through the inbox, reported as `opened`. Stays open |
| Deferral | Read later, remind me tomorrow   | The inbox's own; reported as `later`                       |
| Ask      | "What does this company make?"   | Answered by the producer; never resolves, never acts       |
| Options  | Relevant / Not relevant, Merge   | Resolve the card or item; reported as `decided`            |

### Weights

An option's `weight` tells the inbox how carefully to take it:

- **feedback** (the default): one tap.
- **instruction**: one tap and optional free text, reported as `instruction`
  ("tests for the timeout case").
- **consequential**: something that cannot be taken back, such as a merge or
  a trade. The inbox asks for confirmation, shows `boundTo`, and holds the
  answer before releasing it.

The producer re-checks `boundTo` before it acts. A merge decided on head
`abc123` is refused if the head has moved; a buy decided at "up to €42.50" is
not made above it. Either way the producer posts a fresh card rather than act
on a stale answer.

## Events

```text
event { cardId, externalId, itemId?,
        type: decided | changed | cleared | opened | later | asked
            | expired | withdrawn | acted,
        optionId?, instruction?, question?, boundTo?,
        revision, decidedBy, at, shownSnapshot? }
```

- **`expired` is no signal.** A card nobody answered says nothing about the
  person's interest. A producer that read it as "not interested" would learn
  from neglect.
- **`opened` and `later` are reported, not interpreted.** The producer decides
  how much each counts.
- **Answers can be corrected.** People misclick. A `changed` or `cleared`
  event with a higher `revision` replaces the earlier answer on that card or
  item; the producer undoes what the earlier one did. Apply events by
  revision so a repeated one changes nothing.
- **`acted` ends undo.** A producer that has carried out a consequential
  answer reports `acted`, and the inbox shows that it can no longer be taken
  back. Reversing it is a new decision, not an undo.
- **`shownSnapshot`** is what the person saw when they answered, including any
  questions and answers: the audit record.

Lifecycle of a card:

```text
open → decided ⇄ (changed | cleared) → acted
     → later | expired | withdrawn | superseded
```

## Tools

### An inbox publishes

| Tool                                       | Answers                                                                       |
| ------------------------------------------ | ----------------------------------------------------------------------------- |
| `inbox_post({ producer, card })`           | `{ id, status }`. Idempotent; supersedes an open card by `topic`              |
| `inbox_withdraw({ producer, externalId })` | `{ withdrawn }`. Removes a card that no longer matters                        |
| `inbox_events({ producer, since? })`       | `{ events, cursor }`: what happened to this instance's cards since the cursor |

A `status` other than `open` means the person has finished that card: a
producer adding to a rolling card starts a new one, with a new `externalId`,
rather than adding to a card nobody will look at again.

An inbox may refuse a call (a producer it does not accept, a post from a
person over their limit or without a subscription) by throwing; the producer
logs it and carries on. Collecting events should keep working when posting no
longer does, so answers already given are not stranded.

### A producer publishes

Tool names share a namespace per host, so a producer prefixes its own:

| Tool                                                  | Purpose                                                                                                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `<x>_manifest()`                                      | Name, description, an example card, configuration JSON schema, scopes and secrets it needs, settings URL, `canAnswer`, `suggestedQuestions` |
| `<x>_setup({ instance, config })`                     | Create or update an instance; answers with what is still missing (consent, a key)                                                           |
| `<x>_status({ instance })`                            | Running, paused or missing something; last run, next run, last problem                                                                      |
| `<x>_pause`, `<x>_resume`, `<x>_remove`               | Lifecycle, driven from the inbox                                                                                                            |
| `<x>_ask({ instance, externalId, question, thread })` | Optional. `{ answer, sources[], at }`                                                                                                       |

An **instance** is one person's configured copy of a producer ("Sports",
"Finnish politics"), with its own configuration, schedule and identity in the
inbox. Consent and secrets stay on the producer's own page: the inbox links to
`authorization().consentUrl` and never handles the person's keys.

## Asking questions

A person deciding on a card wants to know more first: "Why do you recommend
this?", "What does this company make?". The producer answers, because it has
the domain data, the reason it posted the card and the person's AI key.

The person is waiting, so this is the one direct call: the inbox calls
`<x>_ask` while they are present, with `{ readOnly: true }`, so a producer
that tried to change anything would be refused. Asking never acts; a question
that reads as an instruction ("merge it") gets an answer saying to use the
card's options.

- Answers show their `sources` and `at`. One from the model's own knowledge
  says so.
- Keep it a short thread on the card; deeper research belongs in a chat
  client.
- Each question is reported as an `asked` event, and the producer decides what
  it says about the person's interest.

The full API for the calls underneath is `ToolsApi` and `PersonalTasks` in
`aiwebengine.d.ts`; see also [Personal Schedules](personal-schedules.md) and
[MCP Tools](mcp-tools.md).
