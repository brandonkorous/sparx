# 298 — She was quoted $129.20 and the shop billed her $152.00

**Status:** fixed
**Severity:** blocker (the price on the button a customer presses was not the
price written to the order, on every discounted order, in the shop's favor and
without a word to either side)
**Found by:** P03 · Juniper Row · standing check "Money at the edges"
**Surface:** the tenant site — **Cart → Checkout**, and **Sell › Orders › an
order** in the console
**Filed:** 2026-08-28
**Fixed:** 2026-08-28
**Confirmed by:** A second order placed the same way, on all three screens and in
the row

## What happened

Working the money-edge check — a discounted order sitting on the free-shipping
threshold — I built Anneliese a basket of a $110.00 Sunday Trouser and a $42.00
Everyday Tee, $152.00, and applied **SPRING15**.

Everything on screen was right, three times over:

| Where                  | What it said                     |
| ---------------------- | -------------------------------- |
| Cart                   | Discount −$22.80 · total $129.20 |
| Checkout, all 3 steps  | Discount −$22.80 · total $129.20 |
| The button she pressed | **Place order — $129.20 to pay** |

The order that was written:

    subtotal 152.00 | discount_total 0.00 | shipping 0.00 | total 152.00

Both line items, `discount_amount 0.00`.

Her own order history says **#O-000009 · Placed · $152.00**. Devi's console says
**Order total $152.00 · Still owed $152.00**, with no discount line and nothing
anywhere saying a code was used. So Devi would invoice her for $152.00, Anneliese
would answer that the site said $129.20, and neither of them could see who was
right.

**The code was still spent.** `commerce_discount_usages` recorded the redemption
with `applied_cents = 2280` and pushed SPRING15's usage count to 2. The offer is
`per_customer_limit = 1`, so she has now used her one and only SPRING15 and
received nothing for it.

This is not an edge case. It is every order with a code on it.

## How to reproduce

Before the fix, every time:

1. On Juniper Row, put anything from **The core range** worth $100 or more in a
   basket.
2. Apply `SPRING15`. The cart shows the saving correctly.
3. Check out. Every step, and the button itself, shows the discounted total.
4. Open the order in **Sell › Orders**. It is the full price.

## Why it matters

Devi's second reason for being here, in her words, is _"run a sale without
emailing 1,900 people a code that breaks."_ The code does not break. It is
accepted, it is counted as used, it shows the shopper a saving on every screen up
to and including the button, and then it charges her full price. She would find
out from complaints, one customer at a time, after the sale.

It is also the worst-shaped money defect available: silent, one-directional, and
in the shop's favor.

## Where it lives

Three files, and the bug is the seam between two of them.

[wizeworks/packages/crm/src/services/order-totals.ts](../../../../wizeworks/packages/crm/src/services/order-totals.ts)
is the order spine's money, and its own header states the contract:

> Line items are the source of truth for subtotal + discount + tax; shipping is a
> header-level add.

`computeTotals(items, shippingTotal, taxTotalOverride, surchargeTotal)` — **there
was no discount parameter.** `discountTotal` was summed from the lines and nothing
else could reach it.

[wizeworks/packages/crm-schemas/src/orders.ts](../../../../wizeworks/packages/crm-schemas/src/orders.ts)
nevertheless declared `discountTotal: Money.default(0)` on `CreateOrderInput`. So
the field was published, typed, validated — and then never read. Its neighbour two
lines down is `taxTotal`, documented as _"Header-level tax override … if provided,
this value wins."_ **Tax was given the override; discount was left as a decoy that
every caller believed in.**

Two callers believed in it:

- [checkout-service.ts](../../../../wizeworks/packages/commerce/src/services/checkout-service.ts)
  passes `discountTotal: discountDollars`, and builds its line items with no
  `discountAmount` at all.
- [import-worker/src/processors/orders.ts](../../../../wizeworks/services/import-worker/src/processors/orders.ts)
  passes `discountTotal: decimal(head.discount)` — **so the orders CSV import has
  been reading a merchant's discount column into nothing too.**

The checkout session itself was never at fault. Its row held
`discount_total_cents 2280, total_cents 12920` — correct, and discarded one
function call later.

## The fix

Two halves, because fixing the total alone would leave every line still claiming
it sold at full price, and a line is what a refund reads.

**The header discount is honored.** `computeTotals` gains `discountTotalOverride`,
written to mirror `taxTotalOverride` exactly rather than inventing a second idiom
— supplied, it wins; omitted, the lines are summed. `CreateOrderInput.discountTotal`
becomes `.optional()` instead of `.default(0)`, because that is what makes the two
readings distinguishable: **a header discount of 0 is a real discount of nothing
and must not erase line-level discounts, and only `undefined` can mean "I am not
answering this."** This single change repairs the CSV import at the same time.

**Each line records what it actually sold for.** A new `apportionToLines` sits in
[discount-conditions.ts](../../../../wizeworks/packages/commerce/src/services/discount-conditions.ts),
beside `eligibleBaseCents` — that file already existed to answer "which part of the
basket does this saving come off", and this is the same question asked per line
rather than in total. A restricted offer lands only on the lines it covers; an
unrestricted one splits by line subtotal, **largest remainder first, so the parts
sum to exactly the header and the two can never disagree by a cent.** Checkout
calls it once per cart and puts each share on its `LineItemInput`.

Two smaller things followed from it:

- The shopper's order page showed each line at its post-discount total _and_ a
  Discount row below, so the saving read twice. It now shows the line at what it
  was worth with **"$14.40 off"** beneath — which is what Devi's console already
  did, so the two sides describe one fact the same way. It is also the only place
  she can see which items the code came off.
- That page and the account layout still carried nine inline `style` props
  (CLAUDE.md forbids them, and [294] cleared the orders list but not these).
  Migrated to utilities while here.

**Tests.** `order-totals.ts` had **no test file at all** — the order spine's money
math, untested. There is one now, built on Anneliese's actual basket, covering the
override, the line sum, the two together not double-counting, and 0-versus-absent.
`apportionToLines` has five more, including the rounding case where $10.00 split
three ways must still be $10.00.

## Confirmed by

Placed a second discounted order as **Jo Kim**, choosing figures that also carry
shipping so the whole composition is exercised: a $96.00 Marlow Knit and a $42.00
Everyday Tee, $138.00, under the $150 free-shipping line.

Computed by hand first: 15% of $138.00 = **$20.70**, so $117.30 + $9.00 = **$126.30**.

The button read **"Place order — $126.30 to pay"**, and:

    O-000010 | subtotal 138.00 | discount_total 20.70 | shipping 9.00 | total 126.30
    Marlow Knit       96.00  discount 14.40  line total 81.60
    The Everyday Tee  42.00  discount  6.30  line total 35.70

$14.40 is 15% of $96.00 and $6.30 is 15% of $42.00, to the cent, and they sum to
$20.70 exactly.

**All three screens now agree.** Devi's console reads `1 × $96.00 · $14.40 off`,
Discount −$20.70, Order total $126.30. Jo's own order page reads $96.00 and $42.00
with the savings named beneath, Subtotal $138.00, Discount −$20.70, Shipping $9.00,
Total $126.30. **The console's discount row and its per-line "off" were already
built** — they had simply never had a number to show.

**A refund now has the right basis.** Before this, refunding Jo's Tee would have
handed back $42.00 on a line she paid $35.70 for. The line says $35.70.

**The refusal path still works**, and it is worth recording because it is the half
a previous fix already got right: applying SPRING15 to a $96.00 basket answers
_"This code needs a basket of at least $100.00. Add $4.00 more to use it."_

## The older order this explains

**O-000006, Rowan Ellery, 2026-08-26.** `commerce_discount_usages` holds a $6.30
redemption against it; the order reads `discount_total 0.00, total 51.00`. It was
read at the time as a conditions failure — a $42.00 basket accepting a code with a
$100 minimum — and the conditions half was fixed. `discount-conditions.test.ts`
opens by describing it: _"a $6.30 saving was recorded against an order that charged
full price."_

**That sentence was the symptom, and only its first clause got fixed.** The code is
refused now, so Rowan's basket could not do it again. But the reason the saving
never reached the order was never touched, so a code that legitimately qualified
reached the same end — which is exactly what happened to Anneliese two days later
at $152.00.

## Not checked

- **The free-shipping threshold reads the pre-discount subtotal.** Anneliese's
  $152.00 basket shipped free although she paid $129.20, and O-000010's $138.00
  basket was charged $9.00. That is at least consistent, and both readings of
  "free over $150" are defensible, so it is recorded rather than filed. Devi has
  never been asked which she means, and the shop says only "free over $150".
- **A refund against the corrected lines.** The basis in the row is right now, but
  `return-service` still splits a refund by `unitPrice` rather than by what the
  line actually earned. That is a narrower question than this issue and is left
  open.
