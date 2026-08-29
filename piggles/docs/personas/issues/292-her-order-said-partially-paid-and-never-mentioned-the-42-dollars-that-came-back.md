# 292 — Her order said "Partially Paid" and never mentioned the $42 that came back

**Status:** fixed
**Severity:** major (the shopper's own record of her money says she is short, when
she was refunded; both true numbers are already in the endpoint's hand)
**Found by:** P03 · Juniper Row · standing check "Buyer's side"
**Surface:** the tenant site — **Account › Orders › Order #O-000004**
**Filed:** 2026-08-27
**Fixed:** 2026-08-27
**Confirmed by:** Her order reads **Partly refunded**, `Refunded to you −$42.00`, `You paid $128.00`

## What happened

Anneliese opens her own order on Juniper Row's site. Under the heading it says:

> Placed August 25, 2026 · **Payment Partially Paid**

The money box on the same page reads:

| Subtotal | $170.00 |
| Shipping | $0.00 |
| **Total** | **$170.00** |

Nothing else about money appears anywhere on the page.

What actually happened to this order is that she was charged **$170.00** and then
**refunded $42.00** for the Everyday Tee, leaving **$128.00** paid. The order row
says so itself:

```
 order_number | total  | amount_paid | refund_total | payment_status
 O-000004     | 170.00 |      128.00 |        42.00 | partially_paid
```

So the page shows her a $170.00 total she did not end up paying, tells her the
payment is "Partially Paid", and never mentions the refund at all. The one
reading available to her is that she still owes $42.

## What should have happened

Her order should show the refund, because the refund is the most important thing
that has happened to it since she placed it. Three numbers, all already known:
charged $170.00, refunded $42.00, paid $128.00.

And "Partially Paid" should not be the sentence. `partially_paid` is one code
covering two situations with opposite meanings:

| The state        | What it means to her   | What she should do |
| ---------------- | ---------------------- | ------------------ |
| Underpaid        | she still owes money   | pay the rest       |
| Refunded in part | money came back to her | nothing            |

The console has already been burned by this shape once — one outcome, two causes,
one message, and the message sends someone to redo work that was never wrong.
Here the data distinguishes the two cleanly (`refundTotal > 0`), so the sentence
can too.

## How to reproduce

Every time.

1. Sign in on Juniper Row's site as `anneliese.vogt@example.com`.
2. **Account › Orders** and open **#O-000004**.
3. Read the line under the heading and the totals box.

Order O-000005 (Jo Kim, $147.00, refunded $42.00, paid $105.00) does the same.

## Why it matters

It is the shopper's own record of her own money, and it reads as a debt she does
not owe. She either writes to Devi to ask, which is the "three messages back and
forth" Devi came here to stop, or she quietly believes the shop shorted her.

Returns are **22% of Juniper Row's orders**. This is not an edge case on this
business; it is close to a quarter of every order page a customer will ever open.

## Where it lives

The numbers exist and are simply not put in the payload — the endpoint has the
whole `order` row in hand:

- [wizeworks/services/api-rest/src/routes/v1/public/account.ts:363-367](../../../../wizeworks/services/api-rest/src/routes/v1/public/account.ts#L363-L367)
  — the money block sends `subtotal`/`tax`/`shipping`/`discount`/`total` and stops.
  `order.amountPaid` and `order.refundTotal` are right there, maintained by
  `recomputeOrderPaymentRollup` on every refund, and neither is sent.
- [wizeworks/apps/site/lib/customer-client.ts:183](../../../../wizeworks/apps/site/lib/customer-client.ts#L183)
  — `OrderDetail` has no field for either.
- [wizeworks/apps/site/app/account/(authed)/orders/[orderId]/page.tsx](<../../../../wizeworks/apps/site/app/account/(authed)/orders/[orderId]/page.tsx>)
  — `Payment {titleCase(order.paymentStatus)}` renders the raw enum, and
  `OrderTotals` has no refund or paid row.

## The fix

**Send the two numbers that already exist.** `amountPaidCents` and
`refundedTotalCents` join the order payload — both come straight off the `order`
row the endpoint already loaded, and `recomputeOrderPaymentRollup` keeps them
current on every payment and refund, so they cost nothing to add.

**Show the refund.** When there is one, the totals box gains two rows under the
total, and the box now ends on the number she actually cares about:

| Subtotal | $170.00 |
| Shipping | $0.00 |
| **Total** | **$170.00** |
| Refunded to you | −$42.00 |
| **You paid** | **$128.00** |

"Refunded to you" is `text-success` — money coming back is good news, and that is
bare text being deliberately colored rather than a control being re-skinned.

**Stop printing the enum.** `paymentLine()` asks about the REFUND FIRST, because
that is the fact that tells the two causes of `partially_paid` apart:

```ts
if (order.refundedTotalCents > 0) {
  return order.amountPaidCents > 0 ? 'Partly refunded' : 'Refunded in full';
}
```

then `Paid in full` / `Partly paid` / `Not paid yet`. Five states in her words,
none of them a database value. The rollup's own vocabulary is closed
(`unpaid | partially_paid | paid | refunded`), so nothing falls through.

Order O-000005 (Jo Kim) is the same shape and is fixed by the same change.

**Migrated in passing:** the not-found branch's `<Button color="neutral">` is now
colorless. `neutral` needs Brandon's approval every time and a colorless control
does not, so this drops to the sanctioned form rather than asking (root RULE #4).

## Confirmed by

Re-opened order **#O-000004** as Anneliese. The line under the heading reads
**Placed August 25, 2026 · Partly refunded**, and the money box reads Subtotal
$170.00 / Shipping $0.00 / **Total $170.00** / **Refunded to you −$42.00** /
**You paid $128.00** — matching `amount_paid 128.00` and `refund_total 42.00` in
the database to the cent. The word "Partially" appears nowhere on the page.
