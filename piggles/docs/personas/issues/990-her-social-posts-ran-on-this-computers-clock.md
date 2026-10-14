# 990 — Her social posts ran on this computer's clock

**Status:** fixed (code)
**Severity:** major
**Found by:** P09 · The Marrow Review · act 10, while fixing issue 984 (the same fault in email)
**Surface:** mypiggles › Social: the calendar, the composer and its schedule boxes, approvals, the queue, the inbox, insights and "When to post", posting times, connections, and the spreadsheet import (both consoles, and the server)
**Filed:** 2026-10-11
**Fixed:** 2026-10-11
**Confirmed by:** not yet on screen
**Blocked on:** screen proof

## What happened

Issue 984 found that her campaigns showed and took times on this computer's clock. The
social module had the same fault everywhere. For a business in London, opened on a
laptop set to Pacific time:

- A post set for 09:00 London showed as 1:00 AM, with no clock named.
- The calendar put a post under the day it was on this computer, so a Saturday-night
  post in London could sit under Saturday on a calendar meant for her Sunday, and
  "today" was this computer's today.
- A time typed into a schedule box was read on this computer's clock, eight hours out.
- "When to post" asked for the best times on this computer's zone, and new posting
  times were saved with it.
- A spreadsheet import read "2026-10-15 09:00" on the server's clock (UTC), an hour
  late in London all summer.

## The fix

New `surfaces/social/social-clock.ts` in both consoles: per-zone formatters, calendar-day
arithmetic, day placement, the drag-to-reschedule rule and the clock notes, all on the
business's zone (or this computer's, said out loud, while she has none).

- Composer: three schedule boxes read and write on the business clock
  (`wallClockToIso`, `isoToWallClock`, `futureInstant`, `wallClockFromNow`), each with
  a line naming the clock and "Pick a time in the future." when it is past.
- Calendar: the grid is built from calendar days; posts and free posting times are
  placed on the business's day; "today" is hers. Tapping a day opens at 9:00 on it;
  dragging a post keeps its time of day on her clock.
- Approvals, queue, inbox, insights, connections: times on her clock.
- "When to post" asks on her zone; new posting times get her zone and show its plain
  name ("British Summer Time").
- Spreadsheet import (`wizeworks/packages/social/src/bulk.ts`, the REST route and the
  `import_social_posts` AI tool): a time with no zone is read on the business's clock.
- Both social `composer.tsx` files are off the date-conversion debt list.

## Proof

- `social-clock.test.ts`, 16 cases in each console: 09:00 London reads 9:00 AM on
  London and 1:00 AM on Los Angeles; 23:30 UTC Saturday sits under Sunday in London and
  Saturday in Los Angeles; 08:30 London is stored as 07:30 UTC in October and 08:30 UTC
  in December; the no-zone notes, the grid, dragging a post.
- `bulk.test.ts` (social package), 19 cases, 6 new, including the same 08:30 case.
- Red: formatters without the zone fail 2; day placement on this computer's clock fails
  2; the notes fail 1 each; the schedule helpers on this computer's zone fail 6; the
  import on the runtime clock fails 4. Restored, all pass.
- Piggles console 2,445 tests and sparx console 2,139 pass; the social package 270.
  Lint and format clean; `check:date-conversions` green (12 files left as debt, was 14).
- The full console typecheck runs out of memory. The changed files were typechecked on
  their own and pass.
- Not yet on screen.
