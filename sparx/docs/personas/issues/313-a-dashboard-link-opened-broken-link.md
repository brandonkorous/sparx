# 313 — A dashboard’s own link opened "Broken link"

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · rating the panes
**Surface:** workbench › Dashboards › any dashboard; shared address table; sparx console and Piggles
**Filed:** 2026-10-17
**Fixed:** 2026-10-17
**Confirmed by:** sparx as Doty (Gillett Diesel Service), 2026-10-17, in part
**Blocked on:** —

## What happened

Built-in dashboards are named by a word (`traffic`, `sales`, `customers`). Their address was `/analytics/:id`, and an `:id` refuses words. The pane wrote `/analytics/traffic` into the address bar, and a reload, a copied link or a pasted one answered "That link doesn’t open anything".

## What should have happened

The address takes the word.

## How to reproduce

1. Open Dashboards › Traffic.
2. Reload the page, or paste its address into a new tab.

## Why it matters

Sharing a dashboard is the reason to have an address for it.

## Where it lives

`wizeworks/packages/links/src/routes.ts`, and `surfaces/analytics/dashboards-list.tsx` and `dashboard-view.tsx` in each console.

## The fix

The route is `/analytics/:key`, the way payment providers were fixed before. The list opens `{ key }`. The view reads `key`, and `id` for a pane saved before the change.

Test: a case in `links/test/routes.test.ts` (80 passed). Putting `:id` back turns it red. The route check reads "350 surfaces, all addressed".

ESLint and the workbench `tsc` run out of memory on this machine: not checked.

## Confirmed by

sparx as Doty, 2026-10-17. `/analytics/traffic` opens Traffic, and `/analytics/sales` opens Sales.

Not checked: Piggles on screen.

## Rating effect

See the pane's row in `rating.md`.
