# 305 — Performance rows looked duplicated on a phone

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · rating the panes
**Surface:** workbench › Inventory › Reports › Performance; sparx console
**Filed:** 2026-10-17
**Fixed:** 2026-10-17
**Confirmed by:** sparx as Doty (Gillett Diesel Service), 2026-10-17
**Blocked on:** —

## What happened

At 360px the warehouse column was hidden, so an item stocked in two warehouses showed as two identical rows.

## What should have happened

Below the wide layout, the warehouse code shows under the item.

## How to reproduce

1. Open Inventory › Reports › Performance at 360px.

## Why it matters

Two identical rows read as a mistake in the report.

## Where it lives

`surfaces/inventory/performance.tsx`.

## The fix

`row.warehouseCode` shows under the item below @lg.

No test: layout only.

ESLint and the workbench `tsc` run out of memory on this machine: not checked.

## Confirmed by

sparx as Doty, 2026-10-17. At 360px the first rows read "Cummins Fuel Injection Crossover Tube O-Ring | 4062328 | WH-CP | 45 | 80.4%", each with its warehouse code.

## Rating effect

See the pane's row in `rating.md`.
