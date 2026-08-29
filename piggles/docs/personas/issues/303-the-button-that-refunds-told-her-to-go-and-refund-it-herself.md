# 303 — The button that refunds told her to go and refund it herself

**Status:** fixed
**Severity:** major (a shop that takes cash or cheques cannot refund an order at
all from the order, and the amount it offered was short by every refund already
given)
**Found by:** P03 · Juniper Row · standing check "Wrong moves" — refund the same
Tee line twice
**Surface:** the console — **Sell › Orders › an order**
**Filed:** 2026-08-28
**Fixed:** 2026-08-28
**Confirmed by:** Both of her cheque orders, before and after

## What happened

The named wrong move has two doors, and only one of them is guarded.

**The return door refuses correctly.** Anneliese's Everyday Tee on O-000004 had
already been refunded once, and the returns panel says so in her words:
_"Everything that went out is either already coming back or has been refunded, so
there is nothing left to add to a return."_ That half is right and stays right.

**The other door is "Refund this order", and it was wrong twice over.**

### It offered the wrong number

| Order    | Taken   | Given back | Shop is holding | Offered    |
| -------- | ------- | ---------- | --------------- | ---------- |
| O-000004 | $170.00 | $42.00     | **$128.00**     | **$86.00** |
| O-000005 | $147.00 | $42.00     | **$105.00**     | **$63.00** |

$86.00 is $128.00 − $42.00. The refund was being subtracted a second time.

### Then it refused, and told her to do the thing it had just offered to do

The panel is written for a shop that takes money by hand, and says so:

> Marks $86.00 as given back. **You hand the money over yourself, so nothing is
> sent anywhere**, and this cannot be undone.

Press it, and:

| Order    | How it was paid                                      | What came back                                                                              |
| -------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| O-000005 | Cheque, reference box empty                          | "This order has **no captured card payment** to refund. Refund the customer manually…"      |
| O-000004 | Cheque, reference reads `Cheque 4471, banked Aug 25` | "**No payment gateway is configured** to settle this refund. Refund the customer manually…" |

Two different refusals for the same act on the same shop, decided by whether she
had typed a note in the reference box. Both end by advising the manual refund the
button had just promised to record. And each arrived **twice** — see [304].

## What should have happened

Most shops on this platform are not holding a charge anywhere. Devi takes cheques
and cash. "Refund" for her means writing down that she handed the money back, and
the console already knew that: `refundWords` picks its wording from
`paidByHand(payment.processor)`, and it had picked the by-hand wording. It even
has a receipt written for the outcome — _"Nothing was sent anywhere, so give them
the money yourself"_ — which nothing on this platform could ever produce.

## Why it matters

She hands over the cash, because the message told her to. Nothing records it. The
order says **Part paid · $128.00 still owed** for ever, her books disagree with
her till, and the only screen that could settle it is the one that refused.

It is also the second time in two days that the words on a control described
something the code beneath it could not do ([298] was the first).

## Where it lives

Two files, one cause each.

**The number** —
[order-detail-facts.ts](../../../../piggles/apps/workbench/surfaces/commerce/order-detail-facts.ts):

    const refundableAmount = Math.max(0,
      round((Number(order.amountPaid) - Number(order.refundTotal ?? 0)) * 100) / 100);

`amountPaid` **is** the money still held: `recomputeOrderPaymentRollup` writes it
as `captured − refunded` and writes `refundTotal` alongside it. Subtracting the
refunds again takes them off twice. api-rest's own default did the identical
thing one line at a time (`const remaining = amountPaid - refundTotal`), so the
API and the console agreed on the wrong answer.

**The refusal** —
[order-refund.ts](../../../../wizeworks/services/api-rest/src/lib/order-refund.ts):

    if (!payment?.processorRef) throw badRequest('This order has no captured card payment…');
    …
    result = await paymentService.refund({ chargeId: payment.processorRef, … });

There is no branch for money that never went through a gateway. Worse, the guard
tests whether a **reference** is filled in rather than what the **processor** is —
so O-000004's cheque note was taken for a charge id and sent to a payment gateway.

**And that exact mistake was already found and already fixed — in the other refund
path.** [return-service.ts](../../../../wizeworks/packages/commerce/src/services/return-service.ts)
carries it in as many words:

> A reference alone is NOT proof there is a charge to reverse. Money taken by
> hand — cash, a cheque, a bank transfer — never passed through a gateway,
> **whatever got written in the reference box** … (persona issue 223). The
> PROCESSOR is what decides.

Returns therefore skip the gateway and record the refund. Orders never got the
same treatment, so the $42.00 refunds already on both orders — which came through
returns — are proof that the capability exists and that this one door could not
reach it.

## The fix

**One answer to "is a gateway holding this?", in one place.** `takenByGateway` and
`GATEWAY_PROCESSORS` move to `@wizeworks/payments`, which is where gateways live
and which both refund paths already depend on. return-service now asks it instead
of keeping its own private copy, so there is one set rather than two that drift.

**A refund with no gateway behind it is simply recorded.** `refundOrderThroughGateway`
gains the branch return-service has had since [223]: decide on the processor, call
the gateway only when one is holding the charge, and book the refund either way.
The panel's by-hand wording is now true.

**The amount is the money still held.** `amountPaid`, on both sides. Nothing is
subtracted twice.

## Confirmed by

Both of her cheque orders, re-read and then driven:

- **O-000005** offers **$105.00**, where it offered $63.00.
- **O-000004** offers **$128.00**, where it offered $86.00 — and pressing it
  **worked**, in one press, on a shop with no gateway at all.

The order now reads **Refunded**, and _Money given back_ shows **$128.00** above
the earlier $42.00. In the row:

    O-000004 | status refunded | payment_status refunded | total 170.00 | amount_paid 0.00 | refund_total 170.00
    order_refunds: 42.00 (completed) · 128.00 (completed), processor_ref EMPTY

$170.00 taken, $170.00 returned, and nothing was sent to a gateway — which is
correct, because nobody ever charged a card.

## Not checked

- **What the old arithmetic would have written on a shop that DOES have a
  gateway.** Reading the code, refunding the offered $86.00 would have left
  `amountPaid 42.00` against `refundTotal 128.00`, and the next offer computes to
  zero — so the row hides itself with $42.00 of the customer's money still held
  and no control left to give it back. That is derived from the arithmetic, not
  driven: Juniper Row has no gateway, so every attempt here failed before it
  could write anything. Recorded rather than claimed (CLAUDE.md RULE #4).
- **A card refund end to end.** Still blocked on a Stripe test key, same as [026].
- **`issue_return_refund` against the corrected order lines**, which [298] left
  open and this does not touch.
