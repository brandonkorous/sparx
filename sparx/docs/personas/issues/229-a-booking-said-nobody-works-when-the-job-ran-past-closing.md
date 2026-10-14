# 229 — A booking said "No one is working" when the job only ran past closing

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · standing checks (a booking at 18:30 Mountain)
**Surface:** Take a booking and moving a booking, in the workbench (both consoles); the same refusal over the API and MCP
**Filed:** 2026-10-12
**Fixed:** 2026-10-13
**Confirmed by:** P01, 2026-10-13, Take a booking in Doty's workbench
**Blocked on:** —

## What happened

Doty booked Seamus O'Malley a Diesel oil change (60 minutes) on Wed, Oct 14 at 4:30 PM
Mountain. Gillett's bays and technicians work 7:30 AM to 5:30 PM. The booking was
refused:

> Could not take this booking. No one is working at 4:30 PM on Wed, Oct 14, 2026.

Everyone is working at 4:30 PM. The oil change keeps 15 minutes free after it for
clean-up, so it would run to 5:45 PM, past closing. The message named the wrong cause
and gave no time that works. The latest start that day is 4:15 PM.

The same sentence comes from the time kept free BEFORE a job: the clock it names is the
start of that time, not the time Doty typed, so a 7:30 AM booking with 10 minutes
before it would read "No one is working at 7:20 AM".

(At 6:30 PM the refusal was right: nobody works then.)

## What should have happened

The refusal says the job would run past the end of the working day, by how much, and
the latest time it can start.

## How to reproduce

1. Workbench › Take a booking. Diesel oil change, Wed Oct 14 2026, 4:30 PM, Seamus
   O'Malley.
2. Take booking. "No one is working at 4:30 PM".

## Why it matters

Doty reads it as his hours being wrong and goes to change them, or tells the customer
the shop is shut at 4:30. One outcome, two causes, and the message sends him to the
wrong one.

## Where it lives

- `wizeworks/packages/scheduling/src/slot-guards.ts` `blockedError`: prints the clock of
  `span.start` and "No one is working at …" whenever every candidate is outside their
  hours. `span` is the booking widened by the service's buffers, so it does not know
  the time that was asked for, or that the start was inside the hours.
- `booking-service.ts` builds that widened span in two places (take and move).

## The fix

The refusal names the time asked for, and when that time is inside the working day,
says the job does not fit and when it can.

- `wizeworks/packages/scheduling/src/slot-guards.ts`: new `keptSpan(startAt, service)`
  builds the widened span and carries the job's own time with it (`booked`).
  `blockedError` uses that time for every sentence, and a new `overrunText` answers
  first when someone is working at the time asked for:
  - "At 4:30 PM on Wed, Oct 14, 2026 it would run until 5:45 PM, counting the 15
    minutes kept free after it, and the working day ends at 5:30 PM. The latest it can
    start is 4:15 PM." With one bay or person picked, it names them ("Bay 1 (light
    duty) stops working at 5:30 PM").
  - The same for time kept free before a job: "it needs the 10 minutes before it kept
    free, from 7:20 AM, and the working day starts at 7:30 AM. The earliest it can
    start is 7:40 AM."
  - Nobody working at the time asked for still reads "No one is working at 6:30 PM".
- `booking-service.ts`: taking and moving a booking both build their span with
  `keptSpan`; the two copies of that sum are gone.

Tests, red first: `slot-guards.test.ts` "a job that runs past the working day" (6; 4
red before, 1 keeps the old answer for a time nobody works, 1 for `keptSpan`, red with
`booked` taken out). scheduling 188 pass. Lint clean. Typecheck not run.

## Confirmed by

P01, 2026-10-13, Doty in Take a booking: Diesel oil change for Seamus O'Malley, Wed
Oct 14 at 4:30 PM. The refusal read the sentence above. At 4:15 PM, as it said, the
booking was taken (Bay 1 (light duty), Kirk Halvorsen), stored 22:15 UTC, 4:15 PM in
America/Denver, on a computer set to Pacific time.

## Rating effect

—
