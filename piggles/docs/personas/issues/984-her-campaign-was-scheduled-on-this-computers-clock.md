# 984 — Her campaign was scheduled on this computer's clock

**Status:** fixed; the Sent half confirmed
**Severity:** major
**Found by:** P09 · The Marrow Review · act 10, after the real send
**Surface:** mypiggles › Email › a campaign: When to send, the confirm, the review (Sent, Scheduled for, the scheduled notice, Cancel send), the campaign list, a sequence's people (both consoles)
**Filed:** 2026-10-11
**Fixed:** 2026-10-11 (code, both consoles)
**Confirmed by:** P09 on screen, 2026-10-11 (Sent: Oct 11, 2026, 9:20 AM British Summer Time; the scheduling half is tested, not yet seen)
**Blocked on:** seeing a campaign scheduled for Friday 08:30 London

## What happened

Rosalind sends The Marrow Review's newsletter on Friday mornings. Her business
time zone is London, set in Business details. Her campaign went out at 08:20 UTC.
On a computer set to California time, the campaign's review said:

- **"Sent: October 11, 2026 at 1:20 AM"**. In London it was 9:20 AM. Nothing
  said whose clock it was on.

The same clock ran through the rest of the campaign:

- **When to send › Schedule for a specific time** is a plain date-and-time box,
  and what she typed was read on this computer's clock. The line under it said
  **"Uses your own time zone."**, which meant California, not London. Friday
  08:30 typed there is stored for 16:30 in London, eight hours late.
- The box opened a quarter of an hour ahead on this computer's clock, and
  **"Pick a time in the future"** compared the box with this computer's clock
  too, so a London time already gone could pass as still to come.
- The confirm (**"goes out on …"**), **Scheduled for**, the **"This goes out on
  …"** notice and the **Cancel send** confirm all read this computer's clock,
  with no clock named.
- The campaign list's "2 days ago" carried this computer's time on hover, and so
  did a sequence's "Joined" and "Next email".

Articles had exactly this defect, fixed by issues 942 and 956. Email had been
left on the old clock.

## Why

The composer turned the box into a time with `new Date(box)`, which only knows
this computer's zone. `soonLocalValue` used this computer's offset. `formatWhen`
was `toLocaleString` with no zone. The business's zone was already in hand
(`useReaderClock`, `lib/business-timezone.ts`); email never asked for it.

## The fix

The clock helpers 942 built for articles (`surfaces/cms/publish-clock.ts`)
moved to **`lib/publish-clock.ts`** in both consoles, one copy, so an article and
a campaign can never disagree about what 06:00 means. `content-detail.tsx`
imports it from there. Two helpers were added:

- `wallClockFromNow(minutes, zone, now)`: where the box opens, on the business's
  clock.
- `futureInstant(local, zone, now)`: what the box says, read on the business's
  clock, and only when that moment is still to come.

Piggles (`piggles/apps/workbench/surfaces/email/`):

- `broadcast-draft.ts`: `soonLocalValue(clock)` uses `wallClockFromNow`;
  `formatWhen` is gone. `ComposeBodyProps` carries `scheduledIso`, `clock` and
  `reader`.
- `broadcast-compose-state.ts`: `useComposerSchedule` reads the box on
  `reader.zone ?? reader.device` and `scheduleValid` uses `futureInstant`.
- `broadcast-compose-delivery.tsx`: `WhenToSend` opens on the business's clock and
  says whose clock under the box with `clockNote`: "On your business's clock,
  British Summer Time." With no business zone: "Your business has no time zone
  yet, so this is this computer's clock, Pacific Daylight Time. To schedule on
  your business's own clock, set it in Business details." The clock is named for
  the day picked, so a December send says Greenwich Mean Time.
- `broadcast-compose-writes.ts`: the confirm reads "goes out on Oct 16, 2026,
  8:30 AM British Summer Time", and the stored time is the instant already read
  on her clock.
- `broadcast-review.tsx`: **Sent**, **Scheduled for**, the scheduled notice and
  the Cancel send confirm use `onClock`. With no business zone, the Summary says
  so with `clockNote`.
- `broadcasts-list.tsx` and `sequence-enrollments.tsx`: the relative times keep
  their words and carry the business's clock, named, on hover (`title` on
  `Timestamp`).

sparx (`sparx/apps/workbench/surfaces/email/`): the same in `broadcast-detail.tsx`
(box, opening value, "in the future", the line under the box, Sent, Scheduled
for, the notice, the Cancel send confirm, the no-zone note), and the same hover
in `broadcasts-list.tsx` and `sequence-enrollments.tsx`. sparx schedules with no
confirm, so there is no confirm sentence to change there. Its
`localMomentInstant` (this computer's clock) is gone from this file.

`scripts/check-date-conversions.mjs` counts `lib/publish-clock` as naming a
clock, and four files are off its WALL_DEBT list: both consoles'
`content-detail.tsx` (fixed by 942, never taken off) and both broadcast
composers. The check said so itself until they came off.

## Proof

- `lib/publish-clock.test.ts`, 12 cases in each console, 4 new for this issue:
  Friday 08:30 in London is 07:30 UTC in October and 08:30 UTC in December;
  08:20 UTC reads "Oct 11, 2026, 9:20 AM British Summer Time" and a December send
  reads "Greenwich Mean Time"; at 9:00 AM in London, 08:30 is past and 09:30 is
  still to come, where the same box on a Pacific clock would be hours ahead; the
  box opens at 09:15 in October and 08:15 in December.
- Red: putting "in the future" and the opening value back on this computer's
  clock (run under `TZ=America/Los_Angeles`) fails 2. Ignoring the zone's offset
  fails 5. Restored: 12 of 12.
- Both consoles' email and CMS tests pass (Piggles 204, sparx 142).
  `check:date-conversions` is green with 14 files left as debt (was 18). The
  changed files lint and format clean. The full typecheck runs out of memory in
  both consoles; the changed files and everything they import typecheck clean.
- Not yet on screen. Needed: as Rosalind, a London business on a Pacific
  computer, the review reads "Sent Oct 11, 2026, 9:20 AM British Summer Time";
  a campaign scheduled for Friday 08:30 says British Summer Time under the box
  and in the confirm, and the database holds 07:30 UTC.
