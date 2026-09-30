# 686 — Twelve rows of one overshirt, all called the same thing

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 242
**Surface:** mypiggles — Stock › Edit a lot at once, and the spreadsheet it exports
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen — see below
**Blocked on:** —

## What happened

Devi opened **Edit a lot at once** to set reorder points across her stock. Every
row looked like this:

> `THE-ASH-OVER-M-BONE`
> The Ash Overshirt

Twelve rows in a run, each reading "The Ash Overshirt", each told apart only by
the tail of a code. To set a different reorder point on the extra-smalls she had
to decode `XS` out of `THE-ASH-OVER-XS-BONE` and trust she had read the right
line before typing a number into it.

## Why

The grid asked for the wrong two fields:

```ts
variant: { select: { sku: true, title: true, product: { select: { title: true } } } },
// ...
title: level.variant.title ?? level.variant.product.title,
```

No variant here has a title of its own, so `??` resolved to the PRODUCT on every
row. MEASURED 2026-09-18, Juniper Row: **76 stock rows, 0 variant titles**, and
every one of them carrying its option values in the database the whole time:

```
 THE-ASH-OVER-M-BONE  |       | Size: M, Color: Bone
 THE-ASH-OVER-M-CLAY  |       | Size: M, Color: Clay
```

The interesting part is that somebody had already reasoned about this screen and
left a long note on the cell explaining why the CODE leads and the title
truncates: "the title does not tell the rows apart and the code is the only thing
that does."

The reading was right. The conclusion was wrong. The thing that tells the rows
apart is the VERSION, and the answer to "the name does not distinguish" is to
fetch the name that does, not to promote a barcode.

`variant-label.ts` — written the same day, for issue 681, five services away in
the same package — is exactly that answer. The grid was not one of its callers.
Neither was `item-name.tsx`, the console component that lays the three parts out.

## What changed

- `stock-grid.ts` selects `VARIANT_LABEL_SELECT` and returns `productTitle` +
  `variantName` as TWO fields, per that module's own contract: "a caller that
  squashes them into a single string is the bug coming back".
- The cell uses the shared `ItemName`, with a new `wrapCode` prop. That keeps the
  half of the old note that still stands: a code is distinguished by its TAIL, so
  a truncated code is not a shortened name, it is another row's name. Typing a
  count into the wrong size is the whole cost of getting this wrong.
- The CSV export gained a `version` column instead of gluing it onto `item`. A
  person sorting that sheet by size could not do it against "The Ash Overshirt".

## Confirmed

```
The Ash Overshirt
M / Bone · THE-ASH-OVER-M-BONE
```

and, for a product with one unnamed version, the code alone with no empty second
line:

```
Brass belt hardware, antique
BRASS-BELT-1
```

## Files

- `wizeworks/packages/inventory/src/services/stock-grid.ts`
- `piggles|sparx/apps/workbench/surfaces/inventory/stock-grid.tsx`
- `piggles|sparx/apps/workbench/surfaces/inventory/item-name.tsx` — `wrapCode`
- `piggles|sparx/apps/workbench/surfaces/inventory/onboarding-data.ts`
