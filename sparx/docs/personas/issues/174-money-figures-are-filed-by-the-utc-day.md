# 174 — Money figures are filed by the UTC day, not Gillett's

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 11 (finance: the month's numbers)
**Surface:** workbench › Finance › Profit; Selling › Reports; Invoicing's collected chart; same in Piggles
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P01 on screen, 2026-10-11 (Profit)
**Blocked on:** —

## What happened

Found while fixing [172]. Every daily money figure is filed by the UTC date of the
moment it happened. Gillett is in Denver (UTC−6 in summer, −7 in winter), so a sale
from 6pm to midnight lands on the next day. On the last evening of a month it lands
in the next month. Today the October figures still add up only because no October
order fell in a month-end evening; O-000001 to O-000006, placed on the evening of
Oct 1 in Denver, are filed under Oct 2.

## What should have happened

A sale, a payment and a cost land on the day they happened in the shop, the same day
an invoice and a statement print ([145], [146]).

## Why it matters

A month's profit can move by an evening's takings between months, and the day-by-day
chart shows the evening's sales on the wrong day.

## Where it lives

- `wizeworks/packages/commerce/src/services/reporting-service.ts`: the daily revenue
  rollup and its live overlay bucket `placed_at` by UTC date.
- `wizeworks/packages/crm/src/services/invoicing-reporting-service.ts`: the collected
  and billed rollup, the same.
- `wizeworks/packages/finance/src/rollup.ts`, `recomputeDay`: reads each input over a
  UTC day (`utcDayRange`).

## What it takes

Not a one-line change, because the inputs are not the same kind of date:

- Sales, payments and stock movements are **moments**: their day is the business
  day of the moment (`businessDayOf`, as [145] and [146] did).
- Expenses are **dates** stored as midnight UTC (`incurred_at` = `2026-10-06
00:00:00+00`): their day is that date as written. Reading them over a Denver day
  range would move every expense to the day before.
- Each rollup's window has to be cut on business-day edges (the reconcile deletes
  and rewrites from a window start), or its first day is written half full.
- The Profit and Reports ranges are business-calendar days already
  (`statementPeriod`-style); the stored buckets would then mean the same days.

Left open, not parked: the two larger money errors in this area ([172]) are fixed;
this one needs its own measured test across a month edge in Denver.

## The fix

Every daily money figure is now filed on the business's own calendar day, read from
`tenant_businesses.timezone`. A business with no zone (or one the runtime does not
know) keeps UTC, exactly as before.

- One shared set of day helpers, in `@wizeworks/time` (`src/business-day.ts`), built on
  the zone math that package already had: `businessDateKey` (the shop's day of a
  moment), `businessDayRange` / `businessDayStart` (the shop's midnight to midnight, as
  moments; 25 hours on the day the clocks go back), `rangeDayKey` (a report's range
  end: a date such as `2026-10-01` or midnight UTC is that date as written, any other
  moment is the shop's day of it), and `calendarZone` (the zone, or UTC). Finance now
  depends on `@wizeworks/time` (package.json and the lockfile entry).
- `commerce/src/services/reporting-service.ts`: the revenue rollup, its live overlay
  and its cold start file each sale on the shop's day of `placed_at`; the range ends
  and "today" are the shop's days; the nightly reconcile's window starts on the shop's
  midnight, so its first day is never rewritten half full. The dropship orders chart
  (revenue, cost, profit by day) gets the same. Also fixed on the way: the per-site
  reconcile keyed sales by `row.property_id`, which is undefined on the row Prisma
  returns (it was a type error nobody had seen, because this package's full typecheck
  runs out of memory), so every site's sales on a day folded into one row.
- `crm/src/services/invoicing-reporting-service.ts`: collected and billed are filed
  `AT TIME ZONE` the shop's zone, over windows cut on the shop's midnights, for the
  chart, its overlay and the reconcile. "Collected this month" and "last month" start
  on the shop's midnight on the 1st instead of the database's UTC month.
- `finance/src/rollup.ts` `recomputeDay`: invoice payments, stock movements and channel
  fees are read over the shop's day. Expenses are dates stored at midnight UTC and stay
  on the date written on them (`utcDayRange`), so no expense moves to the day before.
- `finance/src/jobs.ts` (Profit, By job): orders and appointments are read over the
  shop's days, so a job and the month's profit always agree on the month.
- `finance/src/business-clock.ts`: reads the zone (the same read as crm's
  `businessTimeZone`, which finance cannot import) and `businessToday`.
- `api-rest/src/routes/internal/finance-cron.ts`: the nightly profit sweep counts its
  two days back from each business's today. It runs at 06:45 UTC, still the evening
  before in Denver in winter, so it used to recompute a day that had not started and
  skip the last hours of the one that had just ended.

Tests, all measured across a month edge in Denver: `time/src/business-day.test.ts`
(12), `finance/src/rollup-business-day.test.ts` (5: the 11:30pm sale on Oct 31 is Oct
31's fee, goods cost and revenue; Nov 1 is empty; the winter Dec 31 evening stays in
December; rent dated Oct 1 stays on Oct 1; no zone keeps UTC),
`commerce/src/services/revenue-business-day.test.ts` (5: the rollup files O-000001's
evening under Oct 1 and Oct 31's evening under Oct 31; the Reports chart shows none of
it on Nov 1; a range ending now ends on the shop's today),
`crm/src/services/invoicing-business-day.test.ts` (4, with the fake database filing
rows by `Intl`, not by the code under test). Each went red with its bucketing put back
on UTC: 3 of 5 in finance, 1 more when expenses were read over the shop's day, 4 of 5 in
commerce, 3 of 4 in crm.

Read against Gillett in the dev database, inside a transaction that was rolled back:
the revenue chart files O-000001 to O-000006 under Oct 1 (6 orders, $1,502.64), where
the stored rollup still has them under Oct 2; By job for Oct 1 lists those 6 orders.

For the screen: the stored rollups were filed under the old rule. The revenue and
collected rollups rewrite 400 days every night, so they correct themselves on the next
nightly run. The profit rollup only rewrites two days a night, so the Profit screen
needs "Rebuild figures" for a month (or the profit sweep run once with `?days=400`)
before its older days move.

## Confirmed by

P01 on screen, 2026-10-11, as Doty: Finance › Profit, This month. Oct 1 reads "Sales
$1,503 · What you kept $1,503": O-000001 to O-000006, placed on the evening of Oct 1 in
Denver. The stored day (`rollup_finance_daily_profit`, Gillett's site) holds 150264
cents under 2026-10-01, rewritten that morning. Before the fix those six orders were
filed under Oct 2.

Found on the way: the chart's key was red over green bars ([224], fixed).

The stored days, 2026-10-19: `rollup_commerce_daily_revenue` holds O-000001 to O-000006 (placed
the evening of Oct 1 in Denver) under 2026-10-01, and the six orders of Oct 2 under 2026-10-02.
The collected days, built by running the collected job the way its cron calls it, put the
$500.00 and $13.84 payments under 2026-10-06 and $2,119.60 under 2026-10-09, each its Denver
day. "Invoicing's collected chart" no longer existed in the console; it is now "Billed and
collected" on Owed to you ([360]). Not checked: Piggles on screen.

## Rating effect

—
