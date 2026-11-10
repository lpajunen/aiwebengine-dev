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
[asking a question](#asking-questions), whose calls only read.

A producer whose next run is far off can ask to be woken instead. It
publishes `<x>_wake({ instance })`, and the inbox calls it after an answer,
as the person and in their request. The call carries no answer; it only
lets the producer queue a run that pulls its events now. It cannot be
read-only, because a read-only call cannot queue work, so a wake tool does
nothing else. It is also called once per answer, so it coalesces: keep a
"pending until" mark, and queue a run a short while ahead only when none is
waiting, so answers given in a row are read in one run. The inbox ignores a
wake that fails; the answer stands, and the next scheduled run reads it.

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
  body?                          // Markdown, or two Markdown texts as a diff; see below
  options[]: { id, label, style: primary|neutral|negative,
               weight?: feedback|instruction|consequential }
  boundTo?: { label, value }     // the state an answer depends on
  allowLater?: bool              // Later for the card, and for each item on its own
  handledByOpening?: bool        // opening a link handles the item (an article)
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

### A card's body

What the person decides on is sometimes the content itself: a draft to
approve, a position to answer, a lesson to read. A link to the producer's
page would leave that out of `shownSnapshot`, so a card may carry it:

```text
body?:
  | { kind: "markdown", text }                       // text ≤ 64 KB
  | { kind: "diff", before?, after,                  // two Markdown texts, each ≤ 64 KB
      beforeLabel?, afterLabel? }                    // "r6", "r7 (proposed)"
```

- **The body is data.** The inbox renders the Markdown safely: raw HTML is
  text, and a link or image keeps its URL only when it is http(s),
  `mailto:` or a path. An image should be a path on the shared host (a
  board the producer draws), so showing a card loads nothing from a third
  party.
- **The inbox draws the diff.** The producer sends both texts, never a list
  of changes, so what the person approves is exactly `after`. Name the
  version it applies to in `boundTo`, and refuse an answer once the text
  has moved on. An empty `before` is a first draft.
- **`shownSnapshot` keeps the body** as posted: for a diff, both texts.
- **Ask sees it**: the Markdown, or for a diff what changed, shortened.
- The body has its own limit apart from the rest of the card, and belongs
  to the card only; items stay short.

### Three shapes

| Shape         | What it is                                      | Examples                                   |
| ------------- | ----------------------------------------------- | ------------------------------------------ |
| **Batch**     | Items, each answered on its own                 | Today's articles, a watchlist, PR comments |
| **Alert**     | One card per `topic`, replaced by a newer one   | A big price move, a failed build           |
| **Work item** | One card per piece of work, with its next steps | An issue or pull request                   |

A work item is superseded whenever its state changes, and offers only the
steps valid now: no Merge while the build is red.

### Four kinds of control

| Kind     | Examples                         | Effect                                                                                |
| -------- | -------------------------------- | ------------------------------------------------------------------------------------- |
| Links    | Read the article, open a preview | Opened through the inbox, reported as `opened`. Stays open, unless `handledByOpening` |
| Deferral | Read later, remind me tomorrow   | The inbox's own; reported as `later`, with `itemId` for one item                      |
| Ask      | "What does this company make?"   | Answered by the inbox from the producer's context; never resolves, never acts         |
| Options  | Relevant / Not relevant, Merge   | Resolve the card or item; reported as `decided`                                       |

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

An item is **handled** once it is answered, opened on a card with
`handledByOpening`, or set aside for Later; a batch card closes when every
item is handled. Opening is not an answer: it is reported as `opened` only,
and the item can still be answered. An item set aside is moved to a card of
its own on the inbox's Later shelf, but everything done to it there is
reported under the original `externalId` and `itemId`, so the producer never
sees the move.

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

An inbox may also offer the person's own apps a way in:

| Tool                                                        | Answers                                                                                            |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `inbox_list({ view?, limit? })`                             | `{ cards }`: open (default), later or answered, with options, items and the answers already given  |
| `inbox_decide({ cardId, itemId?, optionId, instruction? })` | `{ cardId, status }`. The same as answering on the inbox's page; reported to the producer as usual |

These answer only a client (`context.meta.mcp.via` is `"client"`), never
another script: a producer acting for the same person must not read other
producers' cards or answer them. An option of weight `consequential` is left
to the inbox's page, where it is confirmed.

### A producer publishes

Tool names share a namespace per host, so a producer prefixes its own: `<x>`
is its `name` with `-` as `_` (`news-digest` → `news_digest_setup`). An inbox
calls them as the person, so they act on that person's instances only.

| Tool                                                       | Answers                                                                                                   |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `<x>_manifest()`                                           | What it is and what it needs, for the inbox's catalog (below)                                             |
| `<x>_setup({ instance?, config })`                         | Creates an instance, or with `instance` changes one; answers its status. Refuses a `config` it cannot use |
| `<x>_status({ instance })`                                 | `{ instance, label, settingsUrl, state, pausedReason, missing[], lastRunAt, nextRunAt, problem }`         |
| `<x>_pause`, `<x>_resume({ instance })`                    | Its status. Resume also starts an instance that is ready; it refuses while something is `missing`         |
| `<x>_remove({ instance })`                                 | `{ removed }`. Stops the instance and forgets what it kept                                                |
| `<x>_context({ instance, externalId, itemId?, question })` | Optional, read-only. `{ why?, facts[]?, documents[]?, at }` for a question on a card                      |
| `<x>_capture({ instance, externalId, itemId?, text })`     | Optional. `{ message, url? }`: what it did with something the person wrote on a card                      |
| `<x>_wake({ instance })`                                   | Optional. Queues a run that pulls the events; see [Answers are pulled](#answers-are-pulled)               |

```text
manifest { name, label, description,
           config,                      // JSON schema: string, integer; "x-multiline": true for a text area
           instances: one | many, maxInstances?,
           scopes[], secrets[]: { name, label, required },
           settingsUrl,
           ask?: { policy?, tools[]? },   // with <x>_context: questions can be asked
           capture?: { label, placeholder? } }  // with <x>_capture: additions can be written

state:   running | paused | ready | incomplete | gone
missing: [{ kind: consent | secret | config, label, url }]
```

- **`ready`** is set up and allowed but not started: the inbox offers Start,
  which is `<x>_resume`. **`gone`** is an instance the producer no longer has,
  removed on its own page; the inbox offers to remove it there too.
- **`missing`** is what the person still has to do, each with where to do it:
  the consent page (`authorization().consentUrl`, to which the inbox adds
  `&redirect=` back to itself) or, for a key, the engine's secret page
  (`secretStorage.entryUrl(name)` for a name the producer declared in
  `init`). The inbox never takes a key or grants a permission for anybody.
- **Setup saves without permission.** A producer keeps the configuration and
  schedules nothing until the person has consented; its status says so, and
  its page or Start schedules it afterwards.
- **Welcome once.** On its first run that reaches the inbox, an instance
  posts one card saying what will arrive and when, with a single "Got it"
  option whose answer means nothing. An instance that reached the inbox
  before is not welcomed again.
- **A refused setup leaves nothing behind.** Check the configuration before
  creating the instance, and throw with a message the person can act on
  ("Not a URL: …"); the inbox shows it as written.

An **instance** is one person's configured copy of a producer ("Sports",
"Finnish politics"), with its own configuration, schedule and identity in the
inbox. The inbox decides which producers it offers (its allow-list) and how
many instances a person may have; it refuses a new one past that before
asking the producer.

## Asking questions

A person deciding on a card wants to know more first: "Why do you recommend
this?", "What does this company make?". The producer has the domain data and
the reason it posted the card; the inbox has the person, the card as they saw
it and its thread. So the producer gives **context** and the inbox answers,
with one harness for every producer and the person's own AI key, stored in
the inbox. A producer needs no model, prompt or key to be asked.

The person is waiting, so this is a direct call: the inbox calls
`<x>_context` while they are present, with `{ readOnly: true }`. The call
names the card by its `externalId`, and the item by `itemId` when the
question is about one; `question` is a hint for a producer that picks what to
return, not something to trust. A producer that cannot give context (the data
gone) throws, and the inbox shows that message and keeps nothing.

```text
<x>_context({ instance, externalId, itemId?, question }) → {
  why?          // why the producer posted this card or item, in its words
  facts[]?      // [{ label, value }]: a quote, a threshold, the person's lists
  documents[]?  // [{ title, url?, text, at? }]: an article, a profile, news
  at            // when the data was read
}
```

The manifest's `ask` says what else the inbox's model may use:

- **`policy`**: a few sentences added to the inbox's own rules ("Information,
  not advice: never tell the person to buy, sell or hold"). It can only add
  limits; the inbox's rules come first.
- **`tools`**: further read-only tools the model may call for more, such as
  `stock_monitor_news({ symbol, days })`. They answer in the same shape as
  the context. The inbox offers one only if it is the producer's own: named
  with its prefix, published by the same script as `<x>_context`, and not one
  of the contract's tools. It calls each read-only, as the person, and gives
  the card's `instance` itself.

```javascript
// The inbox, in the request where the person asked
const context = tools.call(
  "news_digest_context",
  { instance: "sports", externalId, itemId, question },
  { readOnly: true },
);
```

Asking never acts, by construction: everything the model can reach only
reads. A question that reads as an instruction ("merge it") gets an answer
saying to use the card's options. The context, documents and tool results
are data, not instructions to the model.

- Answers show their `sources`, which are only links the context or a tool
  returned, and `at`. One from the model's own knowledge says so.
- Keep it a short thread on the card; deeper research belongs in a chat
  client.
- Each question is reported as an `asked` event, and the producer decides what
  it says about the person's interest.
- A model call takes longer than the engine's default request budget, so an
  operator raises the inbox's timeout (`set_script_limits`). A producer's
  context should come back in a few seconds.

## Adding while deciding

Going through an agent's cards is when the person thinks about what the agent
works on, so that is when ideas come: an issue for the backlog, a topic for
the digest. They write it on the card they are on rather than leaving for the
agent's own page.

A producer that takes additions says how the field reads in its manifest
(`capture: { label: "New issue", placeholder: "Title on the first line" }`)
and publishes `<x>_capture`. The inbox shows the field on its cards and calls
the tool while the person is present, as them and not read-only: they wrote
it, so the producer acts on it at once, with no card to approve.

```text
<x>_capture({ instance, externalId, itemId?, text }) → {
  message   // what it did, as the person reads it: "Added #12 in acme/widgets"
  url?      // what it made, when there is a page for it
}
```

- The card it was written on is context: which repository, which digest. A
  producer that cannot tell from it throws with a message the person can act
  on, and the inbox shows that and keeps nothing.
- `text` is the person's own words, at most 4000 characters. Keep them; a
  producer that rewrites them says so in `message`.
- The inbox keeps no copy and reports no event: what was added is the
  producer's, where the person will find it.

The full API for the calls underneath is `ToolsApi` and `PersonalTasks` in
`aiwebengine.d.ts`; see also [Personal Schedules](personal-schedules.md) and
[MCP Tools](mcp-tools.md).
