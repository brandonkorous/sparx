# 316 — A transfer said "-29 available"

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · rating the panes
**Surface:** workbench › Inventory › Transfers › a transfer › Add an item; sparx console and Piggles
**Filed:** 2026-10-17
**Fixed:** 2026-10-17
**Confirmed by:** sparx as Doty (Gillett Diesel Service), 2026-10-17, in part
**Blocked on:** —

## What happened

Adding the O-Ring to a transfer out of the Warehouse warned "-29 available at Warehouse (Concord Park)". The shelf held 11 and unshipped orders wanted 40, so the free count was below zero, and it was printed as a count.

## What should have happened

When nothing is free, say so, and say how far short the shelf is.

## How to reproduce

1. Start a transfer from a location where orders want more of an item than the shelf holds.
2. Add that item.

## Why it matters

Nobody has minus 29 of anything. The number also hides the real news: the shelf cannot cover the orders already taken.

## Where it lives

`surfaces/inventory/transfer-detail.tsx`; `surfaces/inventory/transfer-availability.ts` (new) in each console.

## The fix

`availableTitle(level, place)` reads "None free at …" when nothing is free. `spokenForReason(level)` says how many are on the shelf and, when orders want more than that, how many more. Counts take thousands commas.

Test: `transfer-availability.test.ts`, 3 per console. Printing the count whatever it is turns one red.

ESLint and the workbench `tsc` run out of memory on this machine: not checked.

## Confirmed by

sparx as Doty, 2026-10-17. The warning reads "None free at Warehouse (Concord Park). 11 are on the shelf, and orders that have not shipped want 40: 29 more than you have. A transfer can only take what is free." A part that was free added, and the transfer started as TRF-000001.

Later the same day: the 40 spoken for turned out to be a cart hold that had run out on 2026-10-03. Locally nothing runs the reservation reaper (production runs it every minute, `k8s/cronjobs/commerce-reservation-reaper.yaml`), so it was never released. Running the reaper once locally freed it: the O-Ring now reads 11 on the shelf, 0 spoken for. The wording stays right for the real case, when unshipped orders want more than the shelf holds.

The words were then widened to name open baskets as well as orders, since the 40 was a basket hold: "orders not yet shipped and baskets still open hold 40: 29 more than you have". Tests updated to match, both consoles.

Not checked: Piggles on screen (tests only).

## Rating effect

See the pane's row in `rating.md`.
