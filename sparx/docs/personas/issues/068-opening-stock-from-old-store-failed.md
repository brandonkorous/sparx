# 068 — Bringing over opening stock from his old online store failed at every step

**Status:** fixed
**Severity:** blocker
**Found by:** P01 · Gillett Diesel Service · act 4 ("opening stock")
**Surface:** workbench › Inventory › Import from a spreadsheet (both consoles); inventory import service
**Filed:** 2026-10-02
**Fixed:** 2026-10-02
**Confirmed by:** On screen, 2026-10-02: Doty's inventory export from his old store (`assets/gillett/shopify-inventory-export.csv`, 1,368 rows, 684 items at two locations) read with "Let sparx work it out" and again with "An inventory export from your old online store": every column matched, 1,368 of 1,368 rows matched, the two Bosch Fuel Rail rows pointed at the existing item, "Apply 684 changes? 3,778 units will move", Applied. Database: Warehouse (Concord Park) 556 items, 3,524 units; Main Office & Shop (Heritage Crest) 128 items, 254 units; the fuel rail 3 and 2. All equal to the file, counted by hand.
**Blocked on:** —

## What happened

Doty's old store gives an inventory export: one row per item per location, with "On hand (current)" (the count) beside "On hand (new)" (left blank, for edits). He uploaded it as his opening stock.

1. **The count column was the empty one.** sparx matched columns by name only and offered "On hand (new)", blank in every row, as the count. Applied, that moves nothing.
2. **"On hand (current)" was not a name sparx knew**, and "Where this file came from" had no choice for an old online store, the most common source for a new sparx shop.
3. **Every row failed: "You have no location called Warehouse (Concord Park)".** That is exactly the name of his location. The import looked a location up only by its short code ("WH-CP"), which no other system has ever seen.
4. **An item with a placeholder code could not be placed.** His Bosch Fuel Rail has the code "-" in the old store; the product import gave it "BOSCH-0445226014-FUEL-RAIL-1". The stock import offered "Create it" (a second fuel rail) or "Leave it out" (no stock). The server could already point a row at an existing item; the screen never offered it.
5. **Once pointed at the item, the row said "does not say which location, and no default was chosen"**, beside a file that named the location. A row with an unknown code was stored before its location was read.
6. **Apply failed every time with a server error: "Could not apply it. Nothing was changed."** All 684 movements ran in one transaction with Prisma's default five-second limit.
7. **A thrown-away file listed 3,773 units** in the import history, beside "Thrown away". Nothing had moved.

## What should have happened

Upload the file, see every column and location recognized, place the one odd item on the item it is, apply, and see the counts the file holds.

## Fix

- `commerce-schemas/src/onboarding.ts`: `matchColumns` takes `emptyHeaders` and never guesses or offers a column with nothing under it. "On hand current" / "current on hand" are standard spellings of the count. New source "An inventory export from your old online store" (`store_export`). Tests: 2 new; removing the empty-column rule reddens 1, removing the spelling reddens 1.
- `inventory/src/services/import-profiles.ts`: the preview finds the empty columns and passes them.
- `inventory/src/services/adjustment-import.ts`:
  - `locationNamed`: a location by its code, then by its name. Code-only reddens 1 of 4 tests.
  - `planRow` reads the location before any failure and keeps it (if open) on a failed row, so pointing the row at an item can land it. Storing none again reddens 1 of 3 tests.
  - `importTimeoutMs`: apply and undo get 15 s plus 150 ms a row, capped at 10 minutes. A 5-second limit reddens 2 of 2 tests.
- `stock-import.tsx` (both consoles): a problem row offers "It is one I have", which opens the shared item search and points the row at the item chosen. The alert names the new choice (Piggles copy too). "Leave it out" no longer names `neutral`. A thrown-away import shows 0 units.
- Tests: commerce-schemas 35, inventory 114, all pass. Typecheck clean: commerce-schemas, inventory, sparx workbench.

## Related

The item search behind "It is one I have" loads only the first 500 items, A to Z (issue 069). The fuel rail is under "B", so it was found; an item late in the alphabet would not be.
