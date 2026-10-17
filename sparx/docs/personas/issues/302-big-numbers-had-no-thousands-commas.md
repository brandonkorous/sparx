# 302 — Big numbers had no thousands commas

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · rating the panes
**Surface:** workbench › Finance › Profit by job; Inventory › Reconciliation; every plural helper; sparx console and Piggles
**Filed:** 2026-10-17
**Fixed:** 2026-10-17
**Confirmed by:** sparx as Doty (Gillett Diesel Service), 2026-10-17
**Blocked on:** —

## What happened

Counts such as "3677 units" and "3721 units" had no commas, while money beside them did.

## What should have happened

Every count over 999 reads with commas, US style.

## How to reproduce

1. Open Finance › Profit › By job, or Inventory › Reports › Reconciliation.

## Why it matters

A four-digit count without a comma is slow to read and looks like a code.

## Where it lives

`surfaces/finance/job-margin-words.ts`, each workbench `plural()` helper, and `wizeworks/packages/inventory/src/services/gl-reconciliation-lines.ts`.

## The fix

All of them format with `toLocaleString('en-US')`.

Test: a case in the reconciliation lines test.

ESLint and the workbench `tsc` run out of memory on this machine: not checked.

## Confirmed by

sparx as Doty, 2026-10-17. By job reads "560 things on your shelves, 3,677 units in all, have never had a cost recorded." Reconciliation reads "29 of 3,721 units on hand".

## Rating effect

See the pane's row in `rating.md`.
