# 796 — It named the screen and would not open it

**Status:** fixed
**Severity:** low
**Found by:** P03 · Juniper Row · act 279
**Surface:** mypiggles + sparx workbench — `commerce.product.dropship`
**Filed:** 2026-09-23
**Blocked on:** —

## What happened

**Shipped by a supplier** on a scarf Devi makes herself is a good empty state,
and then its last line is three technical words and a dead end:

> To have someone else ship it, connect that supplier and bring the product in
> from their catalog: a product becomes **dropshipped** by being **imported**,
> not by being **flagged**.

"Dropshipped", "imported", "flagged". The pane's own title avoids all three
("Shipped by a supplier", "Who ships this") and then the help line reverts to
them. And nothing on the card opens the screen it is telling her to go to —
which is the same gap issue 791 closed on **Where it is listed**.

## What was done

Plain words, and a button.

```
To have someone else ship it for you, add that supplier and bring the product in
from their own list. That is the only way a product becomes theirs to ship:
there is no switch for it here, because the link carries their price, their
stock and where the order has to go.

[ 🚚  Go to your suppliers ]
```

The sentence still says the thing that matters — there is no switch, and why —
without naming a mechanism.

## Proof

Pressed it as Devi. It lands on **Ship-direct suppliers**, which says "No
suppliers yet" and offers "Connect a supplier".

## Files

- `piggles|sparx/apps/workbench/surfaces/commerce/product-dropship.tsx`
