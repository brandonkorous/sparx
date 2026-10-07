# 099 — A due date from terms was counted from the moment, not the day

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 6 (checking every balance against Owed to you)
**Surface:** every due date worked out from terms: checkout on account, signing off a held order, accepting a quote, an invoice entering its payable stage or being sent; Wholesale invoices list (both consoles)
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

INV-000014, Wasatch Front's Net 30 bill for an order Renée placed at 10:11 PM Mountain on Oct 3, read "Nov 2, 2026" on Wholesale invoices and "Nov 3, 2026" on Owed to you. Two screens, one bill, two due dates.

## What should have happened

Net 30 from Oct 3 is Nov 2 on the business's calendar, on every screen.

## How to reproduce

Place an order on account in the evening, Mountain time. Before the fix: its due date stored as 05:11 UTC thirty days on, printed as the next day on Owed to you and on the invoice, and as the business day on the Wholesale list.

## Why it matters

The platform counts and prints a due date as its UTC calendar day (`daysPastDue`, `formatDay`). Every evening order got one day more than its terms, and the one list that read local time disagreed with the bill the customer holds.

## Where it lives

Four writers added the days to the MOMENT (`new Date(); setDate(+days)` or `setUTCDate`): `checkout-service.ts`, `b2b/approval.ts`, `billing-document-conversion-service.ts`, `dueDateFromTerms` in `billing-document-stage-service.ts`. The Wholesale list printed `dueAt` with the reader's local `formatDate`.

## The fix

- `dueDayAfter(from, days, timeZone)` in `crm/billing-ar.ts`: the business's calendar day `days` after `from`, at midday UTC. All four writers use it. The editor's "date it only if the payer has terms" check now counts days rather than comparing a midday date with now (which would have dated walk-ins' bills every morning).
- The Wholesale list prints a due date as its UTC day (`formatDueDay`), the house rule.
- Migration `20270530000026_every_due_date_is_a_day` moves every stored due date to midday of the SAME UTC day, so nothing already printed or sent changes its date. Applied locally: 68 of 78 dated bills, 0 left off midday.

Tests, each proved red:

- `crm/src/services/due-day-after.test.ts` (INV-000014's real moment): the old rule reddens 4 of 4.
- `crm/test/integration/invoice-due-date.test.ts` still passes against the database (5 of 5).

## Confirmed by

On screen, 2026-10-06, as Doty: INV-000014 reads "Nov 3, 2026" on both the Wholesale list and Owed to you, the day its sent copy was printed with. New bills count from the business day: 4466 for Høgberg, raised the same afternoon, defaulted to Nov 5 (Net 30 from Oct 6).

## Rating effect

—
