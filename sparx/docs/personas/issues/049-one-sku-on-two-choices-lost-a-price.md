# 049 — One SKU on two choices would have lost a price on 94 products

**Status:** fixed
**Severity:** blocker
**Found by:** P01 · Gillett Diesel Service · act 3 (read ahead of the import, while dev was down)
**Surface:** workbench › Move in › Shopify products file
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** workbench › Products, search "0986435621" (2026-10-01): one product, 2 versions, $600.00 to $730.15; its Variants tab shows "Accept Core Charge (+$150)" $730.15 and "Defer Core Charge" $600.00. Database: the hand-check SKUs at the file's prices
**Blocked on:** —

## What happened

Doty's Shopify export gives both choices of a core-charge part one SKU:

| Product                                         | Choice                     | SKU        | Price   |
| ----------------------------------------------- | -------------------------- | ---------- | ------- |
| Bosch Remanufactured Fuel Injector (0986435621) | Accept Core Charge (+$150) | 0986435621 | $730.15 |
| Bosch Remanufactured Fuel Injector (0986435621) | Defer Core Charge          | 0986435621 | $600.00 |

Shopify allows this. sparx does not: a SKU names one item per business. The
importer matched each row to an item by SKU, so the second row found the first
and overwrote it. 94 of his 127 products with choices do this. Each would have
come across with one choice, at the other choice's price ($600.00 for the part
his site sells at $730.15).

Worse, two unrelated products carry the SKU `-` (a Bosch fuel rail and an
Alliant oil-cooler gasket). The importer would have found the fuel rail by `-`
and turned the gasket row into an update of the fuel rail: its name, price and
picture replaced.

Nothing warned. The file check skips repeated keys for products, because a
product spread over several rows is normal.

## What should have happened

Every row in his file becomes its own item, at its own price. Where his SKUs
cannot all be kept, he is told which ones changed and to what.

## Where it lives

`wizeworks/services/import-worker/src/processors/products.ts`: the product match
and the variant match both used the file's SKU as is.

## The fix

`planSkus()` decides every row's SKU for the whole file before anything is
saved. The first row keeps the SKU. A repeat gets the SKU plus its choice
(`0986435621-DEFER-CORE-CHARGE`), or a number when it has no choice. A "SKU" with
no letter or digit (`-`) counts as missing. Each changed row says so in the
results ("Your file gives the SKU … so this one is saved as …"). The plan comes
from the file alone, so importing the same file again updates the same items.
The preview uses the same plan.

Test (`move-in-writes.test.ts`, his real rows): 4 items made, both prices kept,
3 products, no update. Red with the old SKU handling: exactly that test.

Checks: import-worker 76/76, tsc 0, eslint 0.

## Found on the screen (same day)

- The practice run said nothing about the renamed SKUs; the owner only learned
  after the real import. The practice run now carries the same notes.
- His file also lists 10 items TWICE (same SKU, same price, the second row with
  Shopify's "Default Title" or the same choice). Renaming those invented
  products like `42806-R-DEFAULT-TITLE`. Now a repeat with the same price and the
  same choice (or none) is one item listed twice: brought in once, the second row
  skipped with a note. And the Shopify reader drops "Default Title" wherever it
  appears, not only when it is the only value ([050]).
- On screen: practice run of his file, "777 of 787 rows would come over", the 10
  duplicates each noted "brought in once", 91 renames listed with their new SKU.

Tests: duplicate listing imported once (red with the rule off); practice-run
note; mixed placeholder (red with the adapter fix off).

## Rating effect

Move in: Ease deduction until re-proved on screen.
