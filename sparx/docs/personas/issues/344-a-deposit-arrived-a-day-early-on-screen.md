# 344 — A deposit's day read one day early

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · checking issue 342 on Finance › Payouts
**Surface:** Workbench › Finance › Payouts, the "Arrives" column and a deposit's page title and line (both consoles)
**Filed:** 2026-10-18
**Fixed:** 2026-10-18
**Confirmed by:** P01 on screen as Doty, 2026-10-18
**Blocked on:** —

## What happened

The two card sales were taken on Oct 18 at 1:38 AM and 2:28 AM (Utah). The page settles a
sale two days after it is taken, so the deposit was due on 2026-10-20. The list read
"Arrives Oct 19, 2026".

## What should have happened

The day the deposit arrives, as that day: Oct 20.

## How to reproduce

1. Open Finance › Payouts on a computer west of Greenwich, with any deposit.
2. Each "Arrives" day is one day early. Every time. A deposit's page says "arriving" the
   day before too.

## Why it matters

The owner looks for the money in the bank a day before it can be there.

## Where it lives

`arrivalDate` is a calendar day ("2026-10-20"), from the derived model and from Stripe's
own payouts alike. `payouts-list.tsx` and `payout-detail.tsx` printed it with `formatDate`,
which reads it as midnight UTC and shows it in the reader's zone: the day before, in the US.
`format.ts` already has `formatDay` for a calendar day, for this reason.

## The fix

Both files, in both consoles, print `arrivalDate` with `formatDay`.

No new test: `formatDay` is the existing reader of a calendar day, and the change is which
of the two the page calls. Lint and format clean.

## Confirmed by

P01 on screen as Doty, 2026-10-18: the same deposit read "Oct 20, 2026 · Card sales · 2 sales
· On its way". The Piggles console was not opened.

## Rating effect

—
