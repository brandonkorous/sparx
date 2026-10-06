# 050 — A "Title" picker on 523 products that have no choices

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 3 (read ahead of the import, while dev was down)
**Surface:** workbench › Move in › Shopify products file (and the live Shopify link)
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** **not checked** on screen yet; re-run P01 act 3 and open SKU `#80`
**Blocked on:** —

## What happened

Shopify writes a product with no choices as one option named "Title" with one
value, "Default Title". 523 of Doty's 653 products look like this (for example
Mag-Hytec Dana 80 Differential Cover, SKU `#80`). The Shopify reader copied it
as a real option. Each product would have shown a "Title" picker with one
entry, "Default Title", in the workbench and on his product pages.

## What should have happened

A product with no choices arrives with no options.

## Where it lives

`wizeworks/packages/migration/src/vendors/shopify.ts` `mapProducts`. The live
Shopify link builds the same rows and calls the same mapper, so one fix covers
both.

## The fix

When the first option is "Title" and every value is "Default Title" (or blank),
the option is dropped. A real option that happens to be named "Title" keeps its
values. Test in `vendors.test.ts`; red with the fix off.

Checks: migration 194/194, tsc 0, eslint 0.

## Rating effect

Move in: Ease deduction until re-proved on screen.
