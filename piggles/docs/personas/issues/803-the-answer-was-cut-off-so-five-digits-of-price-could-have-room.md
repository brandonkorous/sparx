# 803 — The answer was cut off so five digits of price could have room

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 280
**Surface:** mypiggles + sparx workbench — `commerce.configurator-template.detail`, `commerce.product.configurator`
**Filed:** 2026-09-24
**Blocked on:** —

## What happened

Devi set up her monogram build and docked the pane down the side of the window,
which is what the pane is for. Her answer read:

```
Answer              Adds to price
Three initials,     18.00
```

"Three initials, hand stitched" cut off mid-phrase, while `18.00` sat in a box
nearly twice as wide as the one holding the words.

## Why

The row is `flex flex-wrap`, so it was meant to wrap. But the answer was
`min-w-0 flex-1` and the price a fixed `w-32`:

```tsx
<div className="flex flex-wrap items-end gap-2 …">
  <div className="min-w-0 flex-1">      {/* Answer */}
  <div className="w-32">                {/* Adds to price */}
```

`min-w-0` means "you may shrink to nothing", so the flex line never got wide
enough to need wrapping: the answer absorbed every pixel the fixed box and the
delete button did not want. Measured in the pane at 360px: 128px of price box,
about 64px of answer.

**`flex-wrap` does nothing without a floor to wrap against.**

## What was done

`min-w-0` → `min-w-40` on the answer, in all four call sites (the build editor
and the product's own build panel, in each console). Below about 400px the price
now drops to its own line under the answer, which is the right shape: the words
are the content, the price is five characters.

```
Answer
Three initials, hand stitched
Adds to price
18.00
Choosing this changes the price by +$18.00.
```

## Confirmed

On screen at 360px in dark, before and after.

## Files

- `piggles|sparx/apps/workbench/surfaces/commerce/configurator-template-detail.tsx`
- `piggles|sparx/apps/workbench/surfaces/commerce/product-configurator.tsx`
