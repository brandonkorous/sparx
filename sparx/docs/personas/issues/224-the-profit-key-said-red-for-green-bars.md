# 224 — The profit chart's key said red for the green bars

**Status:** fixed
**Severity:** design
**Found by:** P01 · Gillett Diesel Service · act 11 (finance: the month's numbers)
**Surface:** workbench › Finance › Profit, the chart; same in Piggles
**Filed:** 2026-10-11
**Fixed:** 2026-10-11
**Confirmed by:** P01 on screen, 2026-10-11 (sparx, dark theme)
**Blocked on:** —

## What happened

Doty opened Profit for October. The key above the chart read "■ What you kept" in red
and "■ Sales" in blue. Every bar under it was green. In this chart red means a day that
lost money.

## What should have happened

The key shows the color of the thing it names: green for "What you kept".

## How to reproduce

1. As Doty, open Finance › Profit, This month.
2. Look at the key at the top right of the chart. Every time, both themes.

## Why it matters

The chart's one job is "green is money kept, red is money lost". A red key over green
bars tells him the opposite, and the red bar he must spot on a bad day matches the key.

## Where it lives

`sparx/apps/workbench/surfaces/finance/profit-chart.tsx` and Piggles' twin: the bar
series sets its color per bar (by the sign of each day) and never for the series. The
key draws the series color, so it fell back to the chart's first palette color, the
brand red.

## The fix

- `surfaces/finance/profit-chart-option.ts` (new, both consoles): what the chart draws,
  as a plain function. The "What you kept" series carries the success color itself, so
  the key draws green; each bar still takes green or red by its own day. Before the
  theme is read it gives no color rather than a wrong one.
- `profit-chart.tsx` (both): reads the three theme colors and hands them over; the
  option is built by the new function.

Checked the other charts in both consoles (CRM and booking reports, report widgets):
none colors bars one by one under a key, so none has this fault.

Tests: `profit-chart-option.test.ts` in each console (3; 1 red before the fix in sparx,
and Piggles runs the same file).
Finance tests 102 pass in each; lint clean.

## Confirmed by

P01 on screen, 2026-10-11, as Doty: Finance › Profit, This month. The key reads
"■ What you kept" in green and "■ Sales" in blue, over green bars. In the light theme, 2026-10-19:
the key reads "■ What you kept" in green and "■ Sales" in blue, over green bars, the same as
dark. Not checked: Piggles on screen.

## Rating effect

—
