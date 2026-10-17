# 303 — Empty pages had no way forward

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · rating the panes
**Surface:** workbench › Finance › Bills to pay; Inventory › Packing; sparx console and Piggles
**Filed:** 2026-10-17
**Fixed:** 2026-10-17
**Confirmed by:** sparx as Doty (Gillett Diesel Service), 2026-10-17
**Blocked on:** —

## What happened

Bills to pay, when empty, explained what would show there but gave no way to add one. The bare pack bench did the same.

## What should have happened

Each empty page offers the action that fills it.

## How to reproduce

1. Open Finance › Bills to pay with nothing owed.
2. Open Inventory › Packing with no order picked.

## Why it matters

An owner who reads "this fills when…" and finds no button has to guess where to go.

## Where it lives

`surfaces/finance/bills-to-pay.tsx`, `surfaces/inventory/pack-bench.tsx`.

## The fix

Bills to pay gets "Record a cost". The bare bench gets "Go to orders".

No test: an action on an empty state.

ESLint and the workbench `tsc` run out of memory on this machine: not checked.

## Confirmed by

sparx as Doty, 2026-10-17. Bills to pay shows "Record a cost" beside its filters. Packing shows "Go to orders" under its sentence.

## Rating effect

See the pane's row in `rating.md`.
