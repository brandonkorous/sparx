# 496 — The $25 of carriage she typed never reached what the linen cost

**Status:** fixed — see [497](497-freight-is-not-shipping.md) for the answer
**Severity:** major
**Found by:** Devi booking in her first delivery against PO-000001
**Surface:** `inventory.purchase-orders.detail` · `inventory.receiving.detail` (both consoles)
**Filed:** 2026-09-09

## What was wrong

She raised an order for 40 metres of linen at $18.00 and typed **$25.00** into
the field labelled **Shipping cost**. The order totalled **$745.00** and she
paid $745.00.

38 metres arrived and she booked them in. The receipt said:

|                                        |             |
| -------------------------------------- | ----------- |
| What the goods cost                    | **$684.00** |
| Nothing recorded for getting them here | **$0.00**   |
| What this stock is worth to you        | **$684.00** |

The database agrees — `avg_cost_cents 1800`, `allocated_charge_cents 0`,
`landed_unit_cost_cents 1800`.

**Her $25 is not in the value of anything she owns.** It is on the order total
and nowhere else, so every margin worked out from this linen is wrong by $25
spread across it.

## Two fields mean carriage, and only one of them counts

The purchase order carries both, on the same screen:

1. **Shipping cost** — `purchase_order.shipping_cents`. Sits in Order details
   next to the payment terms. Described as _"Added to the order total, not to
   any one item."_
2. **What you expect it to cost to get here** — `inventory_purchase_order_charges`.
   Its own card, further down. Described as _"Each delivery against this order
   carries its share, so what you hold is valued at what it really cost rather
   than at the invoice price."_

Only (2) reaches stock valuation. Grepping every consumer of `shippingCents` in
`packages/inventory`: it is read by `recomputeTotals` (the order total) and by
`purchase-order-document` (the printed order). **Nothing in the receiving path
looks at it at all.**

So she filled in the field that is named after the thing she was doing, and it
did not do the thing the other field does.

## And the screens said so, out loud, in contradiction

With $25.00 of shipping sitting on the order, four hundred pixels further down
the same pane read:

> **Nothing expected on top of the goods.** If a shipping quote comes in later,
> add it here and every delivery against this order picks up its share.

Two statements about one order, on one screen, disagreeing. The receipt then
said _"Nothing recorded for getting them here"_ over an order that records $25
for exactly that.

## What was fixed

The screens stop contradicting each other, and the difference is stated where
she types the number rather than only where it goes missing.

The Shipping cost field's own description, both live and settled:

> On the supplier's bill, so it is in the order total. It is not spread into
> what each item cost you — for that, add it under What you expect it to cost to
> get here.

And the expected-costs card, when the order carries shipping:

> The $25.00 of shipping on this order is on the supplier's bill and is already
> in the order total. It is not part of what each item cost you. To have it
> spread across the goods, add it here as well.

`OrderChargesSection` now takes `shippingCents` so it can say that instead of
claiming nothing is expected.

## Answered: freight is not shipping

Brandon settled it, and the split is the standard one: **freight** is inbound
transport and belongs in what the stock cost; **shipping** is outbound and is a
selling expense. Both were called shipping in this database, and that is _why_
the inbound one behaved like the outbound one.

The rename, the migration, and freight reaching landed cost are
[497](497-freight-is-not-shipping.md). The copy written here was rewritten there
in the same pass, because this issue's fix told her freight is NOT spread into
item cost and that stopped being true.

## Proven here

The two cards stopped contradicting each other on the placed and partly-received
PO-000001. The valuation half is 497's, and is not yet proven on screen.
