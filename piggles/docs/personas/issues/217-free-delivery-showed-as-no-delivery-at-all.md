# 217 — Free delivery showed as no delivery at all

**Status:** fixed and confirmed
**Severity:** minor
**Found by:** P03 · Juniper Row · act 6
**Surface:** mypiggles › Sell › An order
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** P03 · Juniper Row · act 6, on screen, on both sides of her threshold

## What happened

Devi's delivery rule is **$9 flat, free over $150**. Two orders arrived either
side of that line on the same afternoon, and her order pane showed them like
this:

```
O-000005                        O-000004
Items        $138.00            Items        $170.00
Delivery       $9.00            Order total  $170.00
Order total  $147.00            Still owed   $170.00
Still owed   $147.00
```

The $170 order has no delivery line at all. Both are being posted.

## What should have happened

Free is an answer. It is, in fact, the answer Devi wrote the rule to produce.

## Why it matters

Reading the two orders side by side, the obvious inference is that one has
delivery and the other does not — a collection, maybe. Neither is true: both are
going in the post, and on the second one Devi is paying the postage herself.

**The free-shipping threshold is a margin decision, and this is the screen where
she would see what it cost her.** Her whole reason for leaving a marketplace that
took 14% is that she now watches these numbers. A row that vanishes when the
answer is zero hides exactly the case she set up.

It is the platform-wide rule from the other direction. Usually the failure is
**absence rendered as a measurement** — a zero printed where nothing was known
([175], [203], [206]). This is **a measurement rendered as absence**: something
was worked out, it came to nothing, and the screen shows nothing at all, which
reads identically to never having been asked.

## Where it lives

[order-detail-lines.tsx](../../../../piggles/apps/workbench/surfaces/commerce/order-detail-lines.tsx):

```tsx
{
  order.shippingTotal > 0 ? (
    <MoneyRow label="Delivery" amount={order.shippingTotal} currency={currency} />
  ) : null;
}
```

The `> 0` guard is right for every other row it sits with. No discount, no card
fee, no tax, nothing paid so far, nothing given back — for each of those, zero
genuinely means "this did not happen", and a row of $0.00 would be noise.

Delivery is not like them, and the difference is that **it is the only one where
zero is a thing the shop DID.** A discount of nothing is no discount; a delivery
charge of nothing is free delivery.

## The fix

**A posted order shows its delivery row, and reads "Free" when it came to
nothing.** A collected order still shows none, because there is genuinely no
delivery on it — `deliveryPlan(order).collected` already told the orders list
which was which, so nothing new is computed.

`MoneyRow` gained an optional `reads` override for words in place of a figure.
"Free" rather than "$0.00" on purpose: it is what the shopper was shown at
checkout, and the two screens should agree. On a PLACED order there is no
"not worked out yet" state for it to be confused with — checkout cannot complete
without a rate — which is what makes the word safe here and made it wrong at
checkout in [206](206-checkout-said-shipping-was-free-before-it-knew-where-to-send-it.md).

## What it looked like once fixed

```
O-000004 · Anneliese Vogt
Items        $170.00
Delivery        Free
Order total  $170.00
Still owed   $170.00
```

with O-000005 unchanged at `Delivery $9.00`. Both sides of the $150 threshold now
say what happened.

## Rating effect

`Sell › An order` in [rating.md](../rating.md), together with
[215](215-it-told-a-mail-order-customer-to-come-and-collect.md). Recorded in the
run log of [03-juniper-row.md](../03-juniper-row.md).
