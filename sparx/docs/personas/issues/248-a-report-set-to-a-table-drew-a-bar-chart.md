# 248 — A report set to show a table drew a bar chart

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · filing issue 247 (Customers › Build a report, as Doty)
**Surface:** any grouped report whose "How to show it" is "A table", sparx console and Piggles
**Filed:** 2026-10-13
**Fixed:** 2026-10-13
**Confirmed by:** sparx as Doty and Piggles as The Marrow Review, 2026-10-13
**Blocked on:** —

## What happened

The report list labels "Where your deals are" as "A table". Opened, it drew a bar
chart. The report counts open deals AND adds up what they are worth, so one bar chart
puts a count of 2 and a sum of $86,400 on the same axis, where the count is a sliver
nobody can read.

The renderer builds a chart for every grouped result and only checks for a pie or a
funnel. It never checks for "table", so a table falls through to bars. The table branch
below it is reached only when there is no chart at all.

## What should have happened

"A table" draws a table: one row per group, one column per thing worked out.

## How to reproduce

1. Customers › Build a report › "Where your deals are" (or any report set to "A table"
   with a breakdown).

## Why it matters

The owner chose a table for a reason, and the screen ignored the choice. Two measures
of very different size on one axis make one of them unreadable.

## Where it lives

`ResultView` in `surfaces/crm/report-builder.tsx` (sparx) and the Piggles report
builder: the `option` memo.

## The fix

The result view's chart option returns nothing for `visualization === 'table'`, so the
table below it is drawn. sparx `report-builder.tsx`; Piggles `report-result-view.tsx`.
Tested by `report-builder-result.test.ts` in both (red, then green).

## Confirmed by

- sparx: "Where your deals are" is a table (Stage, Deals, Total value), no chart.
- Piggles: the same report is a table, no chart.

## Rating effect

Build a report, one report: the chosen shape is the one drawn.
