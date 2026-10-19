# 360 — The collected figures were worked out every night for no screen

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · checking issue 174 ("Invoicing's collected chart on Denver's day"), as Doty
**Surface:** workbench › Finance › Owed to you, in both consoles; `GET /v1/invoicing/reports/collected-timeseries`
**Filed:** 2026-10-19
**Fixed:** 2026-10-19
**Confirmed by:** P01 on screen as Doty, 2026-10-19 (sparx)
**Blocked on:** —

## What happened

Issue 174 left "Invoicing's collected chart" to check. There is no such chart in either
console. The old dashboard's Invoicing page drew billed against collected per day from
`rollup_invoicing_daily_collected`; the move to the workbench (b86797b03) left it behind. The
nightly job (`k8s/cronjobs/invoicing-collected-rollup.yaml`), its table and three reports
(`collected-timeseries`, `collections`, `customer-breakdown`) kept running, read by nothing.

## What should have happened

An owner can see whether the money is coming in as fast as it is billed.

## How to reproduce

1. Look for billed against collected over time anywhere in the console. There is none.

## Why it matters

Owed to you shows what is still out today, never the trend: a shop that bills $14,901.12 in a
month and collects $2,633.44 learns it only by adding up invoices.

## Where it lives

No surface reads `collected-timeseries`. Finance has one chart, Profit.

## The fix

"Billed and collected, the last 30 days" on Owed to you, in both consoles
(`surfaces/finance/collected-card.tsx`, `collected-data.ts`, `collected-chart-option.ts`):
the two totals in a sentence, then a pair of bars per day, billed in the info color and
collected in the success color, every day on the axis (`everyDay`). Shown under the records,
and under "You're all paid up". A business without invoicing gets no card: the report is the
invoicing module's.

Test, red first: `collected-chart-option.test.ts` in both consoles (2). Finance tests 116
(sparx) and 106 (Piggles) pass. Lint and format clean.

## Confirmed by

P01 as Doty, 2026-10-19. The collected job was run once the way its cron calls it (`POST
/internal/invoicing/collected-rollup`, 12 businesses). Owed to you then read "Billed and
collected, the last 30 days · $2,633.44 came in against $14,901.12 billed", with bars on Oct 2,
Oct 3, Oct 6, Oct 9, Oct 11 and Oct 13: the stored days, $513.84 + $2,119.60 collected. Piggles
not seen on screen; its test passes.

## Rating effect

—
