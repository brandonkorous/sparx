# 306 — A top grade sat beside a supplier with late orders

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · rating the panes
**Surface:** workbench › Inventory › Reports › Suppliers; sparx console
**Filed:** 2026-10-17
**Fixed:** 2026-10-17
**Confirmed by:** sparx as Doty (Gillett Diesel Service), 2026-10-17
**Blocked on:** —

## What happened

Alliant Power scored well on the scorecard while two of its orders were late right now. The score is measured over past deliveries, so it said nothing about today.

## What should have happened

The scorecard says when a supplier has orders late now.

## How to reproduce

1. Have a late purchase order.
2. Open Inventory › Reports › Suppliers.

## Why it matters

An owner picks a supplier from this page. A grade with no word on open late orders is half the story.

## Where it lives

`surfaces/inventory/supplier-scorecards.tsx`.

## The fix

A badge "N orders late now" from `useLatePurchaseOrders()`.

No test: a badge on a row.

ESLint and the workbench `tsc` run out of memory on this machine: not checked.

## Confirmed by

sparx as Doty, 2026-10-17. Suppliers shows "Alliant Power" with "2 orders late now" under it.

## Rating effect

See the pane's row in `rating.md`.
