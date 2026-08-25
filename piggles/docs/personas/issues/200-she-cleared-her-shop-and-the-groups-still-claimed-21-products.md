# 200 — She cleared her shop and the groups still claimed 21 products

**Status:** fixed and confirmed
**Severity:** major
**Found by:** P03 · Juniper Row · act 5
**Surface:** mypiggles › Sell › Groups of products (list and detail)
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** P03 · Juniper Row · act 5, on screen, against her live site

## What happened

Act 1 ends with Devi clearing the decks: the apparel pack's sample catalogue
removed, one product at a time, fifteen of them, and the console confirming each
one. Products then reads seven items, all hers.

Opening **Groups of products** for the first time in act 5, four acts later:

| Name              | How it fills | Products |
| ----------------- | ------------ | -------: |
| Winter layers     | Hand-picked  |        3 |
| The tailoring     | Hand-picked  |        2 |
| The knitwear edit | Hand-picked  |        2 |
| New in            | Hand-picked  |        3 |
| The essentials    | Hand-picked  |        5 |
| New arrivals      | Automatic    |        0 |
| Bestsellers       | Hand-picked  |        6 |

Twenty-one products, in a shop that has seven and has never put one in a group.

Opening Bestsellers is worse. It says **"6 products chosen"** above six identical
chips:

```
Product ×   Product ×   Product ×   Product ×   Product ×   Product ×
```

Six things she cannot name, cannot open, and can only remove by pressing six ×
buttons on six mysteries. The picker underneath lists her seven real garments
with every box unticked.

## What should have happened

A group she never filled says nothing is in it.

## Why it matters

**The count is false, and it hides a broken page on her live website.** The
console advertises a Bestsellers of six; the Bestsellers page on
`juniper-row` says **0 products · No products found**. She has no reason to open
that page, because her own console has just told her it is fine.

It also undoes the act she was told had succeeded. "Clear the decks" reported
done; four screens later the template is still there, wearing her shop's name.
Two catalogues in one shop is the exact mess act 1 existed to prevent, and this
is that mess one level up.

And it is a **count nobody measured presented as one** — the platform-wide rule
this project keeps re-learning. `6` is not the number of products in that group;
it is the number of rows in a join table, which is a different thing the moment
anything is deleted.

## Where it lives

[collection-service.ts](../../../../wizeworks/packages/commerce/src/services/collection-service.ts).

A product delete is a SOFT delete — `deletedAt` is stamped and the row stays, so
a restore can bring it back. Every read of a collection's membership counted
those rows anyway:

```ts
// list()
include: { _count: { select: { products: true } } },

// get() and getByHandle()
products: { select: { productId: true } },
_count: { select: { products: true } },
```

`_count.products` is the join-table count. `productIds` is every id it holds,
deleted or not — which is why the chips render as the word "Product": the picker
fetches names for products it can load, and it cannot load a deleted one.

The storefront was right all along. It resolves products properly and therefore
showed zero, which is what made the disagreement visible.

## The fix

One filter, defined once and applied to all three reads:

```ts
/**
 * A DELETED product is not in the group, so it must not be counted as one.
 */
const LIVE_MEMBERS = { where: { product: { deletedAt: null } } } as const;
```

- `list()` → `_count: { select: { products: LIVE_MEMBERS } }`
- `get()` / `getByHandle()` → the same count, plus
  `products: { ...LIVE_MEMBERS, select: { productId: true } }`

**Filtering on read rather than deleting the rows** is deliberate. The membership
survives, so restoring a product puts it back in the groups it was in — which is
what a restore should do — while nothing counts it in the meantime. And because
`setProducts` replaces the whole set from what the pane holds, opening a group
and saving it now cleans the dead rows out for good.

## What it looked like once fixed

The list, reloaded:

```
Winter layers 0 · The tailoring 0 · The knitwear edit 0 · New in 0
The essentials 0 · New arrivals 0 · Bestsellers 0
```

and Bestsellers itself:

> No products chosen yet. Search below and tick the ones that belong here.

The console and her website now say the same number. Ticking a live product still
names it — the chip reads **Marlow Knit**, not "Product" — so the anonymous chips
were only ever the deleted ones.

## How to reproduce

Before the fix, on any tenant:

1. Put a product into a group.
2. Delete the product.
3. Sell › Groups of products. The group still counts it, and its chip reads
   "Product".

## Rating effect

`Sell › Groups of products` in [rating.md](../rating.md).
