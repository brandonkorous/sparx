# 942 — Thursday at six, on whose clock?

**Status:** fixed (act 4)
**Severity:** major
**Found by:** P09 · The Marrow Review · act 4, scheduling a piece for Thursday 06:00
**Surface:** mypiggles › Content › an article: Schedule, the status line, the history (both consoles)
**Filed:** 2026-10-07
**Fixed:** 2026-10-07
**Confirmed by:** P09 · The Marrow Review · act 4, the piece rescheduled and stored for 05:00 UTC, 06:00 in England
**Blocked on:** —

## What happened

Rosalind's Ledger piece goes out Thursdays at 06:00. She pressed **Schedule…**,
typed 10/08/2026 06:00 AM into **Go live at** and pressed **Schedule**.

- It was stored for **13:00 UTC**. The box is a plain date-and-time input, read
  on the clock of the computer in front of it, which here is Pacific time. In
  England, where the journal is, that is 2 PM.
- The editor said **"Goes live Oct 8, 2026, 6:00 AM"**, which was true on that
  computer and on no clock she keeps.
- The history said **"Scheduled for 2026-10-08T13:00:00.000Z"**, a machine time.
- Nothing said whose clock any of it was on. Her business had no time zone set,
  and nothing said that either.
- Once she saw it, moving the piece meant **Cancel schedule**, then **Schedule…**
  again from an empty box. A scheduled piece had no way to change its time.

Her persona file asks exactly this as a standing check: "Thursday 06:00, in
whose timezone?"

## The fix

`surfaces/cms/publish-clock.ts`, used by the editor in both consoles:

- What she types is read on **the business's clock**, or on this computer's
  when the business has none, using the same offset rule automations already
  use (`schedule-clock.ts`), so a clock change is handled.
- Under the box: **"On your business's clock, British Summer Time."** Without a
  zone: "Your business has no time zone yet, so this is this computer's clock,
  Pacific Daylight Time. To schedule on your business's own clock, set it in
  Business details."
- The status line, the toast and the history name the clock: "Goes live Oct 8,
  2026, 6:00 AM British Summer Time". History notes already stored with a
  machine time are read out the same way.
- A scheduled piece has **Change the time…**, which opens on its current time.
- Two buttons there lost `color="neutral"`.

## Proof

- `publish-clock.test.ts`, 8 cases: 06:00 London is 05:00 UTC and 06:00 Pacific
  is 13:00; both sides of the March clock change; a non-time refused; the
  clock named; the note with and without a business zone; a stored history
  time read out; a stored time back into the box. Ignoring the zone's offset
  reddens 3.
- On screen, as Rosalind: the piece read **"Goes live Oct 8, 2026, 6:00 AM
  Pacific Daylight Time"**. She set **London** in Business details; it then read
  **"2:00 PM British Summer Time"**, which is what had really been stored.
  **Change the time…** opened on 2:00 PM; she typed 6:00 AM; it reads **"Goes
  live Oct 8, 2026, 6:00 AM British Summer Time"**, and the database holds
  `2026-10-08 05:00:00+00`.
- Typecheck clean in both consoles; the sparx half is not driven.

## Found in the same act

The article form's **Section** list was a dropdown with no name: the label sat
above it, but only the text, number and date controls were inside the
`FieldControl` that ties a control to its label. Both list controls in
`schema-form.tsx` (a choice from a list, and a link to other content) now are,
in both consoles; it reads **Section (required)**.
