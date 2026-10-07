# 926 — A month of appointments, and "No completed work in this period"

**Status:** fixed (act 325)
**Severity:** major
**Found by:** P02 · Halo & Hem · act 325, Money › By job
**Surface:** mypiggles › Money › By job, and Bookings (both consoles)
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P02 · Halo & Hem · act 325, "Show them" opening the 25, one marked Completed, By job going to 5 jobs and 24 open
**Blocked on:** —

## What happened

Halo & Hem had 23 appointments in August. By job for the period counted one.
The other 22 were still **Confirmed**, and one was **In progress** since
August 30. By job counts an appointment once it is marked Completed, which is
right (an open one may have been a no-show, and a no-show made nothing). But
nothing closes a past appointment by itself, nothing on Home or in Bookings
asks her to, and By job did not say why it was nearly empty. Over all time, 25
had happened and were still open.

## What should have happened

The screen that leaves them out says so, and opens them, so she can mark each
one Completed or Did not turn up.

## The fix

- Finance: `openPastBookingCount`, the appointments in the period that started
  before now and are still Confirmed or In progress. `/v1/finance/jobs` returns
  it beside the jobs (only when appointments are in the filter).
- By job, both consoles: a note, "25 appointments have happened and are still
  open", what that means, and **Show them** in the Bookings app's color. When
  the period has no jobs at all, the empty state says the same with the button.
- Bookings, both consoles: a status choice **Happened, still open**: in the
  past, still Confirmed or In progress, measured from when the list opened. The
  tab reads "Bookings · happened, still open". The sparx console's list now
  reads the status it is opened with, as the Piggles one has since issue 258;
  it shares the same tested filters module.

## Proof

- `open-bookings.integration.test.ts`: two open past appointments among seven
  (completed, no-show, cancelled, later today, next week); red when completed
  ones are counted, and red when later today counts.
- `bookings-list-filters.test.ts` (both consoles) and two word tests per console.
- On screen, as Nia: the note read 25 and Show them opened a list of exactly 25. She marked Bilal Osei's August 31, 2:15 PM cut Completed; By job went to
  5 jobs and 24 open. The sparx console's half is typechecked and tested, not
  driven.
