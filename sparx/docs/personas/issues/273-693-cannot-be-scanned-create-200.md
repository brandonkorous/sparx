# 273 — "693 items cannot be scanned" over a button reading "Create 200 barcodes"

**Status:** fixed (sparx); Piggles listed as debt
**Severity:** copy
**Found by:** P01 · Gillett Diesel Service · rating Stock › Product labels
**Surface:** Stock › Product labels, the "cannot be scanned" box, sparx console and Piggles
**Filed:** 2026-10-14
**Fixed:** 2026-10-14
**Confirmed by:** sparx as Doty, 2026-10-14
**Blocked on:** —

## What happened

> 693 items you sell cannot be scanned
> … sparx can create one for each of these now …
> [Create 200 barcodes]

The sentence says each of 693; the button says 200. Why 200 is explained only inside
"Choose which" ("Showing the first 200 … the rest follow").

## What should have happened

The button agrees with the sentence: "Create 200 of 693 barcodes".

## How to reproduce

1. Sign in as Doty. Open Stock › Product labels.

Every time more than 200 items need a code.

## Why it matters

Two numbers for one job, side by side. The owner cannot tell if 493 parts will be
left out.

## Where it lives

`surfaces/inventory/product-labels.tsx`, `GenerateBarcodesButton`: it knew only the
200 it was given, not the 693 in all.

## The fix

- `surfaces/inventory/barcode-words.ts` (new): `createBarcodesLabel(count, outOf)` says
  "Create 200 of 693 barcodes" when the button covers part of the list.
- `GenerateBarcodesButton` takes `outOf`; the box passes its total.
- Piggles has the same box in `product-labels.tsx` (649 lines, over its 250-line rule),
  so it waits on that split.

Test: `surfaces/inventory/barcode-words.test.ts` (2). The old words, "Create 200
barcodes", fail the first. Inventory 262/262. Scoped type check and lint clean.

## Confirmed by

sparx as Doty: the button reads "Create 200 of 693 barcodes".

## Rating effect

inventory.barcodes.labels: one count for one job.
