# 151 — The email screen had no way to make an audience

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 10 (one email to the fleets)
**Surface:** workbench › Email › Write an email › "Who it goes to" (sparx and Piggles)
**Filed:** 2026-10-08
**Fixed:** 2026-10-08
**Confirmed by:** P01 on screen, 2026-10-08
**Blocked on:** —

## What happened

Doty opened "Write an email" to send to his fleets. "Who it goes to" offered six saved audiences, and none was his fleets. The section had no way to make one. The section below it, "What you're sending", has a "Design emails" button that opens the email designer beside the composer.

With no audiences at all, the section says "Audiences are built from your customer list: create one, then come back to send to it." It does not say where that is or give a button. Doty found "Segments" by typing "audience" into Search everything.

Behind that: the composer keeps its own copy of the audience list (`['email', 'audiences']`, kept for 60 seconds). Saving a segment refreshes the segment lists (`['crm', 'segments']`) and not that copy. So an audience made beside an open composer does not show in its dropdown until the composer is opened again.

## What should have happened

"Who it goes to" has a button that opens a new segment beside the composer. Once that segment is saved, it is in the dropdown.

## Why it matters

An audience is the first thing an owner needs and the one thing the composer cannot make. Every first email starts with a dead end.

## Where it lives

- `sparx/apps/workbench/surfaces/email/broadcast-detail.tsx`: the "Who it goes to" section.
- `sparx/apps/workbench/surfaces/email/broadcasts-data.ts`: `useAudiences` and `emailKeys.audiences`.
- Piggles: `surfaces/email/broadcast-compose-message.tsx` and `broadcasts-data.ts`.

## The fix

- "Who it goes to" has a "Make an audience" button, the twin of "Design emails". It opens a new segment beside the composer. The empty state points at it: "Use “Make an audience” above to build one from your customer list. Once it is saved, it shows up here to choose." Same in Piggles (`broadcast-compose-message.tsx`, key in `broadcast-draft.ts`).
- The composer's audience list lives under the segments' key, `['crm', 'segments', 'audiences']`, in sparx and Piggles. Saving a segment refreshes it with every other list of segments.

Test, proved red: `surfaces/email/audiences-follow-segments.test.ts` in sparx and in Piggles, which checks that the audience key sits under `segmentKeys.all`. Against the committed key it fails in each app.

## Confirmed by

P01 on screen, 2026-10-08, as Doty. "Write an email" › "Who it goes to" shows "Make an audience". It opened "Create a segment". Doty made "Dealer shops" (Price tier is Dealer, 1 of 38: Lars Høgberg), went back to the open "New email" tab without reloading, and "Dealer shops" was in the Audience list.

On the way, the API restarted under the first "Create segment". The segment screen said "Could not save this segment. The server did not answer. Nothing was changed and your work is still on screen." The second press saved it. That message is right.

## Rating effect

—
