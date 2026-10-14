# 172 — Profit counted core deposits, sales tax and an unapproved order as money kept

**Status:** fixed
**Severity:** blocker (wrong money)
**Found by:** P01 · Gillett Diesel Service · act 11 (finance: the month's numbers against the orders)
**Surface:** workbench › Finance › Profit; same in Piggles
**Filed:** 2026-10-08
**Fixed:** 2026-10-09
**Confirmed by:** P01 on screen, 2026-10-09 (sparx)
**Blocked on:** —

## What happened

Finance › Profit, This month, first said "Nothing to measure in this period. No money
came in and no costs were recorded". Nine orders had been paid this month ($3,740.80)
and two invoice payments received ($513.84). After "Rebuild figures" it said "You
kept $14,740.25", "Money in $14,740.25", "About the same as last month".

By hand, from the orders (Oct 1 to 8, cancelled orders out): goods sold come to
$11,459.60. The difference, $3,280.65, is exactly:

- $2,200.00 of core deposits ($1,750.00 on Oct 1 and 2, less the $150.00 refunded on
  O-000001, plus $300.00 on O-000018 and $300.00 on O-000020). A deposit is the
  customer's money held until the old part comes back; it is not kept.
- $73.05 of Utah sales tax on O-000020. Tax collected is owed to the state.
- $1,007.60, O-000020 itself: Renée's order is waiting for Doty's approval and may
  never be a sale.

The summary also files each order by its UTC day, so an order placed on the evening of
the last day of a month in Denver lands in the next month.

## What should have happened

"Did we make money this month?" answered from what was sold this month: goods and the
shipping charged, less discounts and goods refunded, on Gillett's own calendar. Tax,
deposits and orders not yet agreed are not money kept. And a period that has orders
is never reported as one in which "no money came in".

## How to reproduce

1. As Doty, Finance › Profit › This month. "No money came in" (until Rebuild).
2. Rebuild figures: "Money in $14,740.25" against $11,459.60 sold. Every time.

## Why it matters

The headline number of the finance module overstates what Gillett kept by 28%. An
owner deciding whether he can afford a hire reads this number.

## Where it lives

- `wizeworks/packages/commerce/src/services/reporting-service.ts`,
  `aggregateRevenueByDay` and `aggregateRevenueByDayPerProperty`: `net` is
  `SUM(total) - SUM(refund_total)` over every order that is not cancelled, bucketed
  by `placed_at`'s UTC date. `total` includes tax, shipping and core deposits;
  `pending_approval` orders are included.
- `wizeworks/packages/finance/src/rollup.ts`: reads that `net` as revenue.
- The first answer, "no money came in", was a summary never filled (it is built by a
  nightly job), read as a measurement.

## The fix

- **What an order sold, decided once** (`wizeworks/packages/commerce/src/services/order-sales.ts`):
  `orderSales` (goods − discounts + shipping + card surcharge − goods refunded, their
  tax share out, + deposits kept), `coreDeposits` (a deposit goes back when the old
  part comes back or with the part itself; a line bought old part first took none),
  and `NOT_A_SALE` (cancelled, awaiting approval). `order-sales.test.ts`, 12 tests.
- **Every revenue figure in `reporting-service.ts` adds that up**: the daily rollup
  Profit reads, the revenue summary, channel and traffic-source splits, email
  campaign revenue, channel comparison and channel revenue (they all summed `total`
  over every order not cancelled). Top products and top customers now leave out an
  order awaiting approval.
- **Invoices in Profit** (`wizeworks/packages/finance/src/rollup.ts`): only invoices
  not made from an order, as they are paid, sales share only (`paymentSalesCents`,
  4 tests, red then green). Both of October's payments were on order invoices, so the
  nightly invoice rollup would have counted $513.84 twice.
- **A day that dropped to nothing is rewritten to zero**, as `recomputeDay`'s own
  description promised and did not do: O-000020's $1,380.65 stayed on Oct 7 beside
  the new zero until this. A quiet day writes one zero row, so it reads as worked out.
- **Never worked out is not "no money came in"** (`routes/v1/finance/profit.ts`): the
  first read of a period not yet worked out works it out.
- **The words**, both consoles: "Money in" is "Sales" ("What your orders sold, paid
  or still owed, and what was paid on your other invoices. Sales tax and core deposits
  are not yours, so they are left out."); "of everything you sold"; with nothing last
  period, "Nothing in last month to compare with" instead of "About the same as last
  month"; the empty state says "Nothing was sold". Selling › Reports: "Revenue is what
  your orders sold after refunds, paid or still owed; sales tax and core deposits are
  left out." (it said "Money is what customers paid").

Proved red: on screen, the old code gave $14,740.25; the new one $11,459.60, the hand
count. Unit tests for the new functions were written first. Lint clean; commerce 505,
finance 99, both consoles' finance tests pass. Typecheck not run (Brandon: leave it for
now).

Not fixed here: every figure is still filed by UTC day, so an order on the evening of
a month's last day in Denver lands in the next month: issue 174.

## Confirmed by

P01 on screen, 2026-10-09 (sparx): Finance › Profit › This month › Rebuild figures:
"You kept $11,459.60", "Sales $11,459.60", "Nothing in last month to compare with",
matching the hand count from the orders to the cent. Selling › Reports, last 30 days:
"Revenue $11,460 after refunds", 15 orders, $763.97 per order, and "$1,900.00 in core
deposits is still waiting on old parts to come back" (O-000004, 7, 8, 12 and 18, by
hand). The two screens now agree.

Not checked on screen: Piggles.

## Rating effect

—
