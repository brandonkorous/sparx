# 300 — The supplier cost was hidden on a phone

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · rating the panes
**Surface:** workbench › Dropshipping › Products; sparx console
**Filed:** 2026-10-17
**Fixed:** 2026-10-17
**Confirmed by:** sparx as Doty (Gillett Diesel Service), 2026-10-17
**Blocked on:** —

## What happened

At 360px the dropship product list hid the Cost column. Cost is the reason to open that list.

## What should have happened

Cost shows at every width.

## How to reproduce

1. Open Dropshipping › Products at 360px.

## Why it matters

Deciding what to sell from a supplier is a margin decision, and the margin starts with the cost.

## Where it lives

`surfaces/dropship/products-list.tsx`.

## The fix

The Cost cell and heading lose their width rule.

No test: layout only.

ESLint and the workbench `tsc` run out of memory on this machine: not checked.

## Confirmed by

sparx as Doty, 2026-10-17. At 360px the list heads read "Image, Product, Cost, State, Actions", and the first row reads "S&B 68 Gallon High-Capacity Fuel Tank … | $1,100.00 | On sale".

## Rating effect

See the pane's row in `rating.md`.
