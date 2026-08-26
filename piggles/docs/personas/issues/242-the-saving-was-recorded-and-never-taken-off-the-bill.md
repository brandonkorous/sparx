# 242 — The saving was recorded, shown as accepted, and never taken off the bill

**Status:** fixed and confirmed
**Severity:** blocker
**Found by:** P03 · Juniper Row · act 9 — checking out with SPRING15
**Surface:** the shop's basket and checkout
**Filed:** 2026-08-26
**Fixed:** 2026-08-26
**Confirmed by:** P03 · Juniper Row · act 9 — a $126 basket now shows −$18.90 and totals $107.10

## What happened

A shopper typed SPRING15 into the basket. The code was accepted — a `SPRING15 ×`
chip appeared beside the total. The total did not move:

```
Subtotal (1 items)   $42.00
SPRING15  ×
Estimated total      $42.00
```

Checkout said the same, and then:

> **Place order — $51.00 to pay**

They paid $42.00 plus $9.00 delivery. Order **O-000006**:

```
subtotal         42.00
discount_total    0.00
shipping_total    9.00
total            51.00
```

Meanwhile the platform recorded that the discount HAD been used:

```
commerce_cart_discounts.applied_cents  = 630
commerce_discount_usages.applied_cents = 630
```

## What should have happened

An accepted code comes off the bill.

## Why it matters

Three different people are misled by one bug.

**The shopper** typed a code, was shown it accepted, and paid full price. Nothing
on the screen explains it; the chip says it worked.

**The owner's books** say she gave away $6.30 she never gave. Her discount
reporting and her margin both carry a saving no customer received.

**The shopper's allowance** was spent. `perCustomerLimit` is 1 and a usage row
was written, so the one discount they were entitled to is gone — used up on a
discount they did not get.

## Where it lives

The machinery was all there. `recomputeTotals` in
[cart-service.ts](../../../../wizeworks/packages/commerce/src/services/cart-service.ts)
sums `cartDiscount` rows into `cart.discountTotalCents`, and checkout reads that
field. **`redeemCode` never called it.** It created the join row and returned,
leaving the cart's own total stale at zero.

`recomputeTotals` was private to cart-service, so nothing outside could call it
even deliberately. It ran on add-item, remove-item and re-price — which is why
the discount appeared if the shopper happened to change their basket afterwards,
and never if they did not.

## The fix

`recomputeTotals` is exported as `recomputeCartTotals`, with a comment saying why
it is exported, and `redeemCode` calls it after writing the row. The money is
derived from the rows rather than from an assumption.

## What it looked like once fixed

```
Subtotal (3 items)   $126.00
Discount             −$18.90
SPRING15  ×
Estimated total      $107.10
```

## Related

[241](241-the-conditions-on-a-sale-were-stored-and-never-read.md) is why that
code was accepted at all on a basket below its minimum.
[243](243-taking-the-code-back-off-left-the-saving-on.md) is the same omission
facing the other way.

## Rating effect

`Sell › Discounts` in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
