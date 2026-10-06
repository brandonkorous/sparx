# 053 — "787 products ready" over a file of 653 products

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 3
**Surface:** workbench › Move in › a dropped Shopify products file
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-dropped his file: "653 products in 787 versions ready to import.", "787 of 787 rows ready", "1 column in this file has no home here". and the button "Bring in 653 products"
**Blocked on:** —

## What happened

Doty dropped his Shopify export (653 products, 787 rows because 127 products
have versions). Move in said:

- "787 products ready to import." and a badge "787 of 787 ready"
- a button "Bring in 787"
- "1 column in this file have no home here"

He sells 653 products. A count he knows to be wrong on the first screen of a
move makes him doubt everything after it.

## What should have happened

The screen counts products as products, rows as rows, and its sentences are
grammatical.

## Where it lives

`@wizeworks/migration` `validate.ts` `summarize` counted rows for every entity;
the consoles' `migration-run.tsx` built the badge and button from row counts with
no noun.

## The fix

- `ValidationReport.recordCount`: things counted the way the importer groups them
  (products by handle, orders by number); equal to the row count elsewhere.
- The summary: "653 products in 787 versions ready to import." (orders: "in N
  lines").
- Badge: "787 of 787 rows ready" when things span rows.
- Button: `bringInLabel`: "Bring in 653 products" for one kind of thing, "Bring
  it all in" for several.
- Grammar of the unmapped-column note, both consoles.

- Past moves and the run screen: the platform's name ("Shopify", was
  "shopify"), and "rows would come across / brought over" instead of a bare
  number, both consoles.

Button seen on screen: "Bring in 653 products".

Tests in `validate.test.ts`. Checks: migration and both consoles tsc 0.

## Rating effect

Move in: Ease deduction removed once the button is seen.
