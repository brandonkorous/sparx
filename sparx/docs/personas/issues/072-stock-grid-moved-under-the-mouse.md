# 072 — The stock grid moved under the mouse, and "running low" counted the wrong rows

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 4 (reorder points)
**Surface:** workbench › Inventory › Edit stock in a grid (both consoles); inventory stock-grid service
**Filed:** 2026-10-02
**Fixed:** 2026-10-02
**Confirmed by:** On screen, 2026-10-02, as Doty: AP0128 "Reorder at" 8 then "Order qty" 10, typed one after the other in the same row; both landed in that row, the "1 change not saved" bar appeared at the bottom, Save and Discard clear of the corner search button; "1 row saved". AP54851 set to 1 / 2. "Running low only" lists the one part at its reorder level (on hand 1, reorder at 1) and no longer says "Showing 1 of 3".
**Blocked on:** —

## What happened

1. **Typing a number pushed the table down.** The "N changes not saved" bar appeared above the table on the first keystroke, every row moved down by its height, and the next click landed on the row below. I set the warehouse's reorder level and then, one click later, the counter's order quantity. The bar for ticked rows did the same, so ticking one row moved the next checkbox away.
2. **"Running low only" showed one row and said "Showing 1 of 3".** The total counted every row with a reorder level; the "running low" check ran in the browser after a page of 200 was fetched, so a low row past that page would never have been shown at all.

## Fix

- `stock-grid.tsx` (both consoles): both bars sit below the table, where appearing moves no row, with room on the right for the corner search button. In the same bars, sparx's Discard is `danger` like Piggles's (it throws typed work away) and Clear selection is plain rather than `neutral`.
- `inventory/src/services/stock-grid.ts`: "running low" compares on hand with the reorder level in the query itself (a Prisma column reference), so the rows and the total agree and every page is included.
- Typecheck clean (both consoles, inventory); prettier and eslint clean.

## Why "low" here means on hand

The grid shows "On hand" beside "Reorder at" and nothing else about the level, so "running low" compares exactly those two numbers: the owner can check every row by eye. Low-stock alerts elsewhere use what is free to sell (on hand minus reserved), which the grid does not show; with nothing reserved the two agree.
