# 181 — The goods table cut the item name to "Bosch Reman…"

**Status:** fixed
**Severity:** design
**Found by:** P01 · Gillett Diesel Service · act 13 (a retail return)
**Surface:** Workbench › Commerce › Returns › a return › What happens to the goods
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P01 on screen, 2026-10-09
**Blocked on:** —

## What happened

The table where Doty decides what happens to each returned item showed the item as
"Bosc…" while Qty and Condition kept their room. After the decision it read "Bosch
Reman…". Gillett sells many Bosch remanufactured injectors; the name is what tells them
apart.

## What should have happened

The item name wraps. It is the one column this table exists for.

## Where it lives

`sparx/apps/workbench/surfaces/commerce/return-disposition-panel.tsx`: the Item cell
is `max-w-0` with `truncate`. Piggles already fixed the same cell (it wraps, with a
`min-w-[7rem]` floor). Sparx was left behind.

## The fix

`sparx/apps/workbench/surfaces/commerce/return-disposition-panel.tsx`: the Item cell
wraps (`min-w-[7rem]`, `break-words`), as Piggles' already does. Test: the same
`return-goods-words.test.ts`, red first in sparx.

## Confirmed by

P01 on screen, 2026-10-09 (Commerce › Returns › O-000004): the row reads "Bosch
Remanufactured Fuel Injector (0986435621)" in full. Not checked at 360px.

## Rating effect

—
