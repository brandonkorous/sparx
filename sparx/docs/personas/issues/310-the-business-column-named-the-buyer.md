# 310 — The Business column named the buyer, not the business

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · rating the panes
**Surface:** workbench › Wholesale › Orders; sparx console
**Filed:** 2026-10-17
**Fixed:** 2026-10-17
**Confirmed by:** sparx as Doty (Gillett Diesel Service), 2026-10-17
**Blocked on:** —

## What happened

The Business column showed the person who placed the order (Renée Castañeda), not the trade account (Wasatch Front Utility Contractors, LLC). Piggles had fixed this already.

## What should have happened

The business first, the buyer under it.

## How to reproduce

1. Open Wholesale › Orders.

## Why it matters

A wholesaler sorts work by account. A list of people’s names hides which business each order is for.

## Where it lives

`surfaces/b2b/orders-list.tsx`; `surfaces/b2b/wholesale-order-row.ts` (copied from Piggles).

## The fix

The helper and its test come across from Piggles with a port note. The Business cell shows `orderBusiness(order)`, with `orderBuyer(order)` under it.

Test: `wholesale-order-row.test.ts`, 10 passed.

ESLint and the workbench `tsc` run out of memory on this machine: not checked.

## Confirmed by

sparx as Doty, 2026-10-17. Wholesale › Orders shows O-000031 and O-000030 as "Wasatch Front Utility Contractors, LLC" with "Renée Castañeda" under it.

## Rating effect

See the pane's row in `rating.md`.
