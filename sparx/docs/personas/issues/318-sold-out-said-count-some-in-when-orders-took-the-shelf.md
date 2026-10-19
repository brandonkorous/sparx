# 318 — Sold out said "count some in" when orders had taken the shelf

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · rating the panes
**Surface:** workbench › Inventory › Stock › an item, and a product's Stock tab; sparx console and Piggles
**Filed:** 2026-10-17
**Fixed:** 2026-10-17
**Confirmed by:** sparx as Doty (Gillett Diesel Service), 2026-10-17, in part
**Blocked on:** —

## What happened

The Cummins Fuel Injection Crossover Tube O-Ring read "Nothing left to sell. Your website shows it as sold out and will not take an order for it. It comes back on sale by itself the moment you count some in." The same page showed 11 on the shelf and 40 spoken for. Counting a few in would bring nothing back: the orders already taken would use them first.

## What should have happened

The sentence follows the cause. An empty shelf comes back when stock is counted in. A shelf that orders have taken comes back only once more arrives than those orders want, and the page says how many that is.

## How to reproduce

1. Take orders for more of an item than the shelf holds.
2. Open that item under Inventory › Stock.

## Why it matters

The advice sent the owner to count stock that was already counted. The real news, that the shop owes 29 to customers, was not said.

## Where it lives

`surfaces/inventory/stock-item.tsx` and `surfaces/commerce/product-stock.tsx` in each console; `surfaces/inventory/sold-out-words.ts` (new).

## The fix

`soldOutBody(levels)` reads the sold-out places:

- orders want more than the shelf holds: "Orders that have not shipped already want 29 more than you have, so those orders are filled first and it comes back on sale once more arrive than that."
- units are there but none is free: "What is on the shelf is spoken for or held back, so it comes back on sale once more arrive."
- the shelf is empty: the sentence as before.

Both stock pages use it, in both consoles.

Test: `sold-out-words.test.ts`, 3 per console. Dropping the orders case turns one red.

ESLint and the workbench `tsc` run out of memory on this machine: not checked.

## Confirmed by

sparx as Doty, 2026-10-17. The O-Ring's stock page reads "Nothing left to sell. Your website shows it as sold out and will not take an order for it. Orders that have not shipped already want 29 more than you have, so those orders are filled first and it comes back on sale once more arrive than that."

Later the same day: the 40 spoken for turned out to be a cart hold that had run out on 2026-10-03. Locally nothing runs the reservation reaper (production runs it every minute, `k8s/cronjobs/commerce-reservation-reaper.yaml`), so it was never released. Running the reaper once locally freed it: the O-Ring now reads 11 on the shelf, 0 spoken for. The wording stays right for the real case, when unshipped orders want more than the shelf holds.

The words were then widened to name open baskets as well as orders, since the 40 was a basket hold: "orders not yet shipped and baskets still open hold 40: 29 more than you have". Tests updated to match, both consoles.

Not checked: the product's Stock tab on screen, and Piggles (tests only).

## Rating effect

See the pane's row in `rating.md`.
