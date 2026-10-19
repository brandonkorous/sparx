# 146 — The account statement dates bills and payments on the UTC day

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 10 (checking the siblings of [145])
**Surface:** workbench › Wholesale › an account › Statement; the statement PDF and email
**Filed:** 2026-10-06
**Fixed:** 2026-10-08
**Confirmed by:** P01 on screen, 2026-10-08 (sparx)
**Blocked on:** —

## What happened

Found by reading, not yet seen on screen. The statement places each invoice, payment and write-off by the exact moment it happened, compared against period edges that are the business's calendar days ([099]) and printed as UTC dates. So the same shape as [145]: a bill raised after 6pm in Denver prints the next day's date on the statement, and a bill raised after 6pm on the last day of a month falls into the next month's statement.

## What should have happened

Each row lands on, and prints, the day it happened in the shop.

## Why not fixed with 145

The statement's arithmetic orders events by their exact moment (a payment received at the moment of a write-off counts before it). Moving every event to its business day changes which month a bill lands in and how same-day events order. That needs its own measured test on a real statement, which act 11 does.

## Where it lives

- `wizeworks/packages/crm/src/services/b2b-statement-service.ts`: `toBillInput` (`issuedAtOf`, `receivedAt`, `voidedAt` as moments).
- `wizeworks/packages/crm/src/services/b2b-statement.ts`: `computeStatement`, `eventsOf`.

## The fix

- `crm/src/services/b2b-statement.ts`, `computeStatement(bills, period, timeZone)`:
  every invoice, payment, refund and write-off is placed by its day in the shop
  (`businessDayOf`, the helper [145] added), so the period's edges and the
  opening balance cut on the business's calendar. Within one day the events keep
  the order they happened in, then the old kind order, so a payment received at
  the moment of a write-off still counts first.
- Each row's `at`, and each open item's `issuedAt`, is now that day as noon UTC,
  the form a due date is stored in. That is the single point of change: all four
  printers (sparx and Piggles statement panes, the statement print page and PDF,
  the buyer's statement on the site) print the UTC day of the value they get, so
  they all print the shop's day with no change of their own.
- `b2b-statement-service.ts`: passes the business's time zone, and reads bills
  made up to a day past the period's end (the exact cut is on the day).

Test, proved red: `b2b-statement.test.ts`, "the business calendar (sparx persona
issue 146)": a Denver bill raised at 7:30pm on Oct 31 lands on October's statement
and in November's opening balance, and prints Oct 31; same-day order kept. Three of
the four were red on the old code (the fourth guards the order). The service test's
read bound moved by the day of slack, with the reason. All 875 crm tests pass; lint
clean. Typecheck not run (Brandon: leave it for now).

Siblings: the AR aging already counts on the business's day (`daysPastDue`), and
issued dates on documents were [145]. The finance month is checked in act 11.

## Confirmed by

P01 on screen, 2026-10-08 (sparx): Wholesale › Wasatch Front Utility Contractors ›
Statement, this month so far. INV-000014, raised at 04:11 UTC on Oct 4 (10:11pm Oct 3
in Denver), reads "Oct 3, 2026"; 4459, raised at 05:14 UTC on Oct 7, reads "Oct 6,
2026". Both printed the UTC day before. Totals unchanged: owed at the end $8,096.40.

The other copies, 2026-10-19, Oct 1 to Oct 19: the print page ("Print or save as PDF") and
Renée's statement on the Gillett site both read "Oct 3, 2026 · Invoice issued · INV-000014" and
"Oct 6, 2026 · Invoice issued · 4459". The emailed statement lists the open invoices with their
due dates and links to the site's copy. Not checked: Piggles.

## Rating effect

—
