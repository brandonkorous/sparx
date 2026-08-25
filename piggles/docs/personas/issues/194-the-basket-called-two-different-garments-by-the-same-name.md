# 194 — The basket called two different garments by the same name

**Status:** fixed and confirmed
**Severity:** major
**Found by:** P03 · Juniper Row · act 4
**Surface:** Juniper Row's own website — the basket drawer and the cart page
**Filed:** 2026-08-24
**Fixed:** 2026-08-24
**Confirmed by:** P03 · Juniper Row · 2026-08-24
**Blocked on:** —

## What happened

Found the moment the version picker started working ([190]). A basket holding an
XS in Oat and an S in Moss showed:

**The drawer:**

```
Marlow Knit                          $96.00
Marlow Knit                          $96.00
```

Two lines, same name, same price, nothing else. No way to tell which is which, no
way to remove the right one.

**The cart page** did better and still not well:

```
Marlow Knit    SKU: MARLOW-KNIT
Marlow Knit    SKU: MARLOW-KNIT-S-MOSS
```

A product code as the only difference between two garments.

## Why it matters

A shopper who buys three sizes to try cannot check their own basket, and the one
they remove is a guess. Then the same lines become the order, and the order is
what Devi picks and packs from.

`MARLOW-KNIT-S-MOSS` is also not a thing anybody outside the studio is supposed
to read. Piggles' whole voice rule is that a shop owner should never have to
decode an identifier, and a shopper less so.

## Where it lives

[cart.ts](../../../../wizeworks/services/api-rest/src/routes/v1/public/cart.ts) —
`variantTitle: v?.title ?? null`.

The storefront was ALREADY willing to show it: `cart-view.tsx` renders
`line.variantTitle` under the product name whenever it is there. The field was
simply empty, because `ProductVariant.title` is null on a product built from
options — the schema even says so in a comment on the column ("computed from
options when omitted"). Nothing computed it.

Another instance of [[feedback_fetched_but_never_rendered]] with the halves the
other way round: the component was ready and the payload never carried it.

## The fix

The cart selects each variant's `optionAssignments` and builds the words the
shopper actually chose, in the product's own option order — `"S · Moss"`. A
variant with no options falls back to its `title`, so a single-version product is
unchanged.

Ordered by `option.position` then `optionValue.position`, the same order the
picker on the product page uses, so the basket reads the way the page she picked
from read.

## Confirmed on screen

The cart page, reloaded, same two lines:

```
Marlow Knit    XS · Oat      SKU: MARLOW-KNIT
Marlow Knit    S · Moss      SKU: MARLOW-KNIT-S-MOSS
```

The first is the line added before the picker existed, so it also shows that the
old default really was XS · Oat.

## Rating effect

None recorded — the tenant's own website has no row in [rating.md](../rating.md).
