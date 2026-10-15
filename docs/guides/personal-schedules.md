# Personal Schedules

Work that runs for one person, on a cadence they choose, while they are away:
a morning digest, a weekly summary, a reminder at seven in their own time zone.

```javascript
// POST /digest/schedule, from a signed-in person
function saveSchedule(context) {
  const grant = personalTasks.authorization();
  if (!grant.granted) return ResponseBuilder.redirect(grant.consentUrl);

  personalTasks.schedule({
    key: "morning-digest",
    handler: "sendDigest",
    cron: "0 7 * * *",
    timeZone: "Europe/Helsinki",
  });
  return ResponseBuilder.redirect("/digest", 303);
}

// Each run: a task acting as that person, with no request.
function sendDigest(context) {
  const { scheduledFor } = context.meta.schedule;
  personalStorage.setItem("digest", `Digest for ${scheduledFor}`);
}
```

## It belongs to the person

A schedule is declared by a person's request, or by a message from a sender
they have linked (`personalTasks.scheduleFrom`), and it runs as them, through
the permission they gave the script on the consent page. So it follows that
permission, not the code:

- **It survives deployments.** Writing a new version of the script does not
  touch it.
- **It ends when they withdraw permission** on their account page.
- **It pauses when the permission lapses**, and starts again when they give it
  again. Permission lasts at most 90 days.
- **They can see it.** Their account page lists it under the script, with
  Pause, Resume and Delete.

No script can list or change anybody else's schedules: `schedules()` and
`unschedule(key)` answer for the person making the request.

## When it runs

Exactly one of:

- `cron`: five fields (minute hour day month weekday) in `timeZone`, an IANA
  name such as `"Europe/Helsinki"`. Seven stays at seven across daylight
  saving.
- `intervalMinutes` (or `intervalMilliseconds`), with `firstRunAfterMs` for a
  first run that should not wait a whole interval.

The engine refuses runs closer together than its minimum (15 minutes by
default; `* * * * *` is refused) and caps how many schedules one person may
hold, per script and in all.

Declaring the same `key` again replaces the schedule. With the same cadence it
keeps its next run, so calling `schedule` every time the person saves a form,
or every time they visit, is safe. It also resumes a paused one.

## What a run is

Each due slot becomes an ordinary task, as `personalTasks.enqueue` makes: the
person's lane (one of their runs at a time), retries, the job time budget.
`context.meta.schedule` says which schedule and which slot (`key`,
`scheduledFor`). There is no `context.request`.

- A slot whose previous run has not finished is skipped, not stacked.
- After the engine was down, a schedule runs once, not once per missed slot.
- A run that throws is retried. Three runs in a row that give up pause the
  schedule as `failing`; the person sees that on their account page, and
  declaring it again starts it.

## Say when permission is about to lapse

The engine does not yet tell anybody, and a schedule whose permission lapses
pauses without a word. Read `personalTasks.authorization().expiresAt` in the
run and say so wherever the app already talks to the person: its page, a chat
reply.

## Examples

- `daily-note` in [aiwebengine-examples](../examples/index.md): one file, a
  page and a daily run.
- The agent's `scheduled` starter (in `aiwebengine-template`) is the same
  shape with tests.

The full API is `PersonalTasks`, `ScheduleSpec` and `PersonalSchedule` in
`aiwebengine.d.ts`.
