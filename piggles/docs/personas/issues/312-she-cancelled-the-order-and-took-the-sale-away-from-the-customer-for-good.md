# 312 — She cancelled the order and took the sale away from the customer for good

**Status:** fixed, confirmed
**Severity:** major (an order that was cancelled or fully refunded still spends
the customer's one use of a code, and the same code stays live on their basket
until they touch it)
**Found by:** P03 · Juniper Row · wrong moves — a discount on an undone sale
**Surface:** the console — an order › Cancel this order; and the shop — the cart
**Filed:** 2026-08-28
**Fixed:** 2026-08-28

## What happened

Jo Kim ordered a Marlow Knit and a Tee with **SPRING15**, Devi's spring sale:
$138.00 less $20.70, $126.30 with delivery. She never paid it. Devi cancelled
it, which the console handles well:

    Cancel order O-000010?
    This marks the order as cancelled for Jo Kim — 2 items worth $126.30 will
    no longer be sent. No money has come in, so there is nothing to refund.
    A cancelled order cannot be reopened.

No money changed hands. Nothing was made or posted. The sale runs until
**September 30**.

Jo comes back and types the code:

    SPRING15   [Apply]
    You've already used this discount the maximum number of times

She has not. She used it on an order that no longer exists. The shop gave her
nothing, kept nothing, and has taken the sale away from her for the rest of its
run — and the sentence it tells her is not true.

**And the mirror image, on the same screen, one minute earlier.** Before typing
anything, Jo's basket was _still carrying the code_:

    Subtotal (2 items)        $138.00
    Discount   SPRING15 ×     −$20.70
    Estimated total           $117.30
    [ Proceed to checkout ]

So the same shopper is refused when she asks and served when she does not. Had
she pressed the button instead of re-typing the code, she would have had the
sale a second time. Which way it falls depends on nothing but whether she
happened to touch the chip.

## Why

**1. Nothing ever releases a redemption.** `recordDiscountUsage` writes a
`DiscountUsage` row and increments `usageCount` when the cart converts
([discount-service.ts](../../../../wizeworks/packages/commerce/src/services/discount-service.ts)).
There is no counterpart anywhere in the repo — no delete, no decrement, nothing
on cancel and nothing on refund. `assertUsageLimit` then counts every row that
was ever written:

```ts
const used = await tx.discountUsage.count({
  where: { discountId: discount.id, customerId },
});
if (used >= discount.perCustomerLimit) { … }
```

An order's fate is not part of that count, so a sale that was undone spends the
allowance exactly as a sale that stands.

**2. A basket re-checks the sale's DATES and nothing else.**
`foldRunningDiscounts` in
[cart-service.ts](../../../../wizeworks/packages/commerce/src/services/cart-service.ts)
was written for issue [300] and does its job precisely:

> A code's dates are checked when it is TYPED, and a basket outlives that moment
> — it can sit for a week. So the offer behind each saving is read again here…

It reads back `status`, `startAt`, `endAt`, `deletedAt` — the window — and drops
what has lapsed. The usage limits are the other half of the same sentence and
are still only checked once, when the code is typed. [300] fixed the condition
it was found through; every other condition kept the shape of the bug.

The two faults are one fault seen from both ends: the count is wrong, and it is
only consulted once.

## The fix

**1. Undoing a sale gives the code back.** `releaseOrderDiscountUsage` is the
counterpart `recordDiscountUsage` never had: it deletes the order's usage rows
and takes the counter back down. **The order's own settled status is the test**,
not anything the caller passes — `cancelled` and `refunded` both mean the shop
sold nothing, and a partial refund never reaches either, so it keeps its usage
without anything having to know the difference.

It runs from the commerce consumers on `order.cancelled` and `order.refunded`,
where the restock already lives, for the reason that file already states: the
seam belongs to the consumer, so CRM stays discount-agnostic. Running after the
commit only ever means the shopper gets their code back a moment late, which is
the harmless direction.

**2. A basket re-checks the limits, not only the dates.** The comparison moved
out of `assertUsageLimit` into `usageBlock` beside `isDiscountRunning`, and
`foldRunningDiscounts` now asks it on every read. One rule, two callers — the
code box and the basket — which is what stops them disagreeing again. `usageBlock`
also returns WHICH limit was hit, because the shop-wide one and the per-customer
one are two different sentences.

**3. Devi is told before she presses.** Both confirms now carry it:

    ... No money has come in, so there is nothing to refund. The sale code on
    it goes back to them, to use again. A cancelled order cannot be reopened.

On a refund it appears only when the amount clears the whole outstanding total,
because a partial refund does not give the code back.

## Confirmed as Devi and Marguerite, 2026-08-28

Marguerite Adeyemi had used SPRING15 on **O-000011** ($138.00 less $20.70,
unpaid). Devi cancelled it, and the confirm said so before she pressed:

    Cancel order O-000011?
    This marks the order as cancelled for Marguerite Adeyemi — 2 items worth
    $126.30 will no longer be sent. No money has come in, so there is nothing
    to refund. The sale code on it goes back to them, to use again.
    A cancelled order cannot be reopened.

| SPRING15                    | before | after    |
| --------------------------- | ------ | -------- |
| usage_count                 | 4      | **3**    |
| Marguerite's redemption row | there  | **gone** |

Then, as Marguerite on the shop: **SPRING15 accepted** — $276.00 less **$41.40**,
$234.60, and **O-000014 placed at $234.60**. She has her sale back, on a code the
shop had taken off her for an order it never fulfilled.

Jo Kim's row is deliberately left where it is: her order was cancelled before
this existed, so no event ever reached the new consumer. It is the record of what
the platform did.

## Not re-driven

**The stale chip on a lingering basket.** The defect itself was seen on screen —
Jo's basket showing SPRING15 at −$20.70 with a live checkout button while the box
beside it refused the same code — and the fix is `foldRunningDiscounts` asking
`usageBlock`, covered by tests on the shared rule. What was not re-driven is that
same screen afterwards: reproducing it needs a shopper whose basket the storefront
still serves across an order, and the only one of those was Jo's, whose chip was
removed in the course of proving the other half. Checking out starts a fresh
basket, so a new order cannot recreate the case.

**Four orphan baskets still carry a SPRING15 chip** — Anneliese's $22.80,
Marguerite's $20.70 and $41.40, and a guest's $6.30. Three belong to people who
have spent the code. They are exactly the baskets this fix now empties on read;
none is reachable from the shop, because the storefront serves each shopper their
newest basket.
