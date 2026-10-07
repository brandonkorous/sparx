# 105 — Shopify's own stock export read as 1,367 problems

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 7 (checking the report change from 104 against all his files)
**Surface:** workbench › Move in › Shopify › a stock (inventory) export (both consoles)
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01, 2026-10-06, his own file run through the shared reader
**Blocked on:** —

## What happened

Gillett's Shopify inventory export (1,368 rows, 3,778 units) read as 1,366 rows, 0 ready, 1,367 problems. Shopify names its columns "On hand (current)", "On hand (new)", "Available (not editable)" and "Incoming (not editable)"; the Shopify reader asked for "On hand" and "Available", found neither, and every row came out with no quantity. In act 4 Doty got his stock in through the column mapper instead ([068]).

The two rows for the Bosch Fuel Rail (0445226014), whose SKU in Shopify is "-", were dropped before the check with their 5 units, without a word.

Found on the same path: the check said "This stock level has no sku." with SKU lower-cased.

## What should have happened

Shopify's own export, in Shopify's own current wording, imports as it is. A row that cannot be matched is named as a problem, not dropped.

## Where it lives

- `mapInventory` in `migration/src/vendors/shopify.ts`: the column names, and `if (sku === '') continue`.
- `clean()` turns "-" into blank, which is right; the row then has to reach the check.
- Every field label in the check was lower-cased whole.

## The fix

- The reader takes "On hand (new)" when typed, else "On hand (current)", and the Available and Incoming columns by Shopify's names.
- A row with no usable SKU is kept, so the check names it.
- A label keeps an abbreviation in capitals ("SKU").

Run on his file: 1,368 rows, 1,366 ready, 3,778 units, and 2 problems: rows 308 and 309, "This stock level has no SKU." The product import named that fuel rail's SKU "BOSCH-0445226014-FUEL-RAIL-1", so its stock is still matched by hand. Matching a stock row to a made-up SKU is not attempted.

Test: `migration/src/left-behind.test.ts`, "Shopify's own stock export". The old reader reddens 3 of 3; the old label wording reddens 1.

## Confirmed by

His real file through the same reader both consoles run, 2026-10-06 (numbers above). Not re-imported on screen: his stock is already in, and a second import of counts would overwrite act 4's received purchase order.

## Rating effect

—
