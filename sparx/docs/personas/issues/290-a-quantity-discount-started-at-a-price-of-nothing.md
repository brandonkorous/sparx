# 290 — A quantity discount started at a price of nothing

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · confirming [086] item 15 (a product with no cost)
**Surface:** workbench › Selling › a product › Pricing › Cheaper by the dozen, sparx console and Piggles
**Filed:** 2026-10-16
**Fixed:** 2026-10-16
**Confirmed by:** sparx as Doty, 2026-10-16
**Blocked on:** —

## What happened

On the Cummins Fuel Injection Crossover Tube O-Ring (4062328, $4.32), the Pricing
tab's "Cheaper by the dozen" row read "From this many 10" and "Each one costs 0.00".
Nobody had typed that 0.00. A few lines above, the same tab says "A blank box and 0.00
are different: 0.00 means it cost you nothing." Here the box said the opposite of its
neighbor. "Add" was off, so no free price could be added; the box still read as one.

## What should have happened

The price box starts empty, as "What it cost you" does above it, and "Set what each
one costs at that quantity." stands until he types one.

## How to reproduce

1. Open the O-ring 4062328 › Pricing.
2. Read "Each one costs 0.00". Every product, every time.

## Why it matters

A figure nobody measured, shown as a price. Minor: nothing could be saved from it.

## Where it lives

`surfaces/commerce/product-pricing.tsx`, `BulkTiers`: `useState(0)` for the unit
price, and a `MoneyInput` without `optional`, which draws 0 as "0.00".

## The fix

Both consoles' `product-pricing.tsx`: the unit price is `number | null`, starts at
`null`, goes back to `null` after an add, and the `MoneyInput` is `optional`, which
draws `null` as an empty box. Every check that guarded `<= 0` also guards `null`.
ESLint and Prettier clean in both. Siblings: the add-a-price rows on price lists use
their own form; not checked.

## Confirmed by

sparx as Doty, the O-ring 4062328 › Pricing after the change: "Each one costs" empty,
"Set what each one costs at that quantity.", Add off. Typed 3.80: "Buying 10 or more
brings each one down to $3.80." and Add on. Cleared it: empty again, Add off. Nothing
was added. Piggles: not checked on screen (its dev server answered 404 on Oct 14).

## Rating effect

—
