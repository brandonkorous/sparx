# 165 — Opening a chat said "Saved just now"

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 10 (a customer message answered)
**Surface:** workbench › Messages › a conversation; Site › Form submissions › a message; same in Piggles
**Filed:** 2026-10-08
**Fixed:** 2026-10-08
**Confirmed by:** P01 on screen, 2026-10-08 (sparx)
**Blocked on:** —

## What happened

Doty opened Renée Castañeda's new chat to read it. He typed nothing and pressed
nothing. The status bar at the bottom of the screen read "Saved just now".

Opening a new contact-form message does the same.

## What should have happened

Nothing of his was saved, so the status bar says nothing new. It is the one place
he looks to check his work is safe.

## How to reproduce

1. As a shopper, start a chat on the site (or send the contact form).
2. As Doty, open Messages and open that conversation (or Site › Form submissions ›
   the new message).
3. "Saved just now" in the status bar. Every time a conversation or message is
   still unread.

## Why it matters

It says something false. A "Saved" that comes from opening a screen teaches him the
word means nothing, and on the day a real save fails he will believe the status bar.

## Where it lives

- `sparx/apps/workbench/surfaces/chat/data.ts`, `useMarkRead`: the write that clears
  the unread mark when a conversation opens. No `meta`.
- `sparx/apps/workbench/surfaces/builder/submission-detail.tsx`: on open, a New
  message is marked Read through `useSetSubmissionStatus`, the same hook his own
  "Mark as spam" and "Archive" use.
- `sparx/apps/workbench/components/status-bar-signals.ts` counts every write that
  succeeds, unless the write says `housekeeping: true` (`lib/api/write-meta.ts`).
  The visit ping says so; these two did not.
- Piggles: the same two.

## The fix

- `useMarkRead` (chat, both consoles) now says `meta: { housekeeping: true }`.
- New `useMarkSubmissionRead` (`form-submissions-data.ts`, both consoles): the same
  write as marking Read by hand, flagged as housekeeping. The form message's
  open-marks-read effect uses it; his own status changes stay on
  `useSetSubmissionStatus`.
- New guard `lib/api/write-on-open.test.ts` (both consoles): every `useEffect` in the
  console that fires a mutation on its own must use a hook that declares
  `housekeeping: true`. It found exactly these two and no others. Proved red in both
  consoles (sparx: both; Piggles: the old chat `data.ts` put back for one run), then
  green. Lint clean. Typecheck not run (Brandon: leave it for now).

## Confirmed by

P01 on screen, 2026-10-08 (sparx): Renée sent "Also, can you check the core charge on
the HE351VE for Unit 31? Thanks, Renée" (database: `unread_staff` 1). Doty opened
Messages, then her conversation. The status bar said "Online" before and after, with
no "Saved". The database then read `unread_staff` 0, so the mark still happened. When
Doty sent his reply, the status bar said "Saved just now", which is his work.

Not checked on screen: the form-message path, and the Piggles console. Both are the
same flag on the same kind of hook, and the guard covers them.

## Rating effect

—
