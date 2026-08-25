# 186 — On a phone, the picture sat on top of the product name

**Status:** fixed and confirmed
**Severity:** minor
**Found by:** P03 · Juniper Row · [026] website half, RULE #6 pass
**Surface:** Juniper Row's own website — the basket, under 520px
**Filed:** 2026-08-24
**Fixed:** 2026-08-24
**Confirmed by:** P03 · Juniper Row · 2026-08-24
**Blocked on:** —

## What happened

At 360px the basket's line item read:

> **arlow Knit**
> KU: MARLOW-KNIT

The product thumbnail was sitting on top of the first letter of the name and the
first letter of the SKU label. Every line, every product, every phone.

## Why it matters

Most shoppers are on a phone, and the basket is the screen where somebody checks
they are buying the right thing. A name whose first letter is behind a picture is
a name that has to be guessed at, and "KU:" is not a word.

It is cosmetic in the sense that nothing is mispriced, and not cosmetic in the
sense that the one job of that row is to say what is in the basket.

## Where it lives

[cart-view.tsx](../../../../wizeworks/apps/site/components/cart-view.tsx). The
row is a grid that narrows its first track on a phone:

```
grid-cols-[88px_1fr_auto]  max-[520px]:grid-cols-[64px_1fr]
```

and the tile inside that track was a fixed `h-[88px] w-[88px]`. The track went to
64px; the tile did not, so it hung 24px into the text column beside it. Nothing
clipped it, because the text column has no background of its own — the picture
simply painted over the words.

## The fix

The tile is sized by its column instead of by a number: `aspect-square w-full`,
which keeps the shape it had and makes it 88px or 64px depending on which track
it is in. One line, and it cannot drift out of step with the grid again.

## Confirmed on screen

At 360px in an iframe (RULE #6, and without resizing the window): **Marlow Knit**
and **SKU: MARLOW-KNIT** both fully readable, the thumbnail square and clear of
them. Re-checked in dark.

## How to reproduce

1. Put anything in the basket on a tenant site.
2. Open `/cart` at 360px.
3. Before: the first character of the title and of "SKU:" is behind the image.

## Rating effect

None recorded — the tenant's own website has no row in [rating.md](../rating.md).
