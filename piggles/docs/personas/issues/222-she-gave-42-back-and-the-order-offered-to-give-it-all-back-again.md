# 222 — She gave $42.00 back, and the order offered to give it all back again

**Status:** fixed and confirmed
**Severity:** blocker
**Found by:** P03 · Juniper Row · act 7
**Surface:** mypiggles › Sell › An order
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** P03 · Juniper Row · act 7, on screen — Paid so far $128.00, Given back $42.00, "1 refunded" on the line

## What happened

Jo Kim sent the Everyday Tee back for a refund. Devi took the return all the way
through and gave her $42.00. The return said so:

> **Settled** · Given back **$42.00** · Back to how they paid

Then she opened the order it came from:

```
O-000005 · Jo Kim                    Paid
Items         $138.00
Delivery        $9.00
Order total   $147.00
Paid so far   $147.00

Refund this order
Marks $147.00 as given back. …this cannot be undone.
        [ Refund $147.00 ]
```

**Nothing about the $42.00.** Still marked fully Paid, no money given back, and a
live button offering to hand over the entire $147.00 — on top of the $42.00 that
had left the till a minute earlier.

## What should have happened

A refund settled on a return is a refund **on that order**. The order is where a
shop owner looks to answer "what did this sale actually earn me".

## Why it matters

This is wrong money, on the screen that exists to be right about money.

- **$189.00 could go out on a $147.00 sale**, in two clicks, with nothing warning
  her — the second one calls itself irreversible and it would be.
- Every figure downstream is wrong: the order's own total, her takings for the
  day, what the customer is shown, what a tax return would be built from.
- The line still read `1 × $42.00` with nothing marking it returned, so a second
  return could be opened for the same shirt.

**A settled return and an unchanged order are two records of one event that
disagree**, and the platform believed the wrong one twice over — because the
order's rollup is what the refund button reads.

The mechanism: `orderRefundsService.recordRefund` is the one write path that
keeps `amountPaid`, `paymentStatus`, `refundTotal` and each line's
`quantityRefunded` in step, and publishes `order.refunded` so the CRM decrements
lifetime spend. `returnService.issueRefund` called **none of it** — it wrote four
fields onto the return row and stopped. Everything after the money was left to
somebody else, and there was no somebody else.

## Where it lives

[return-service.ts](../../../../wizeworks/packages/commerce/src/services/return-service.ts)
`issueRefund`. It updated `returnRequest`, restocked the goods, published
`return.refunded`, and never touched the order.

## The fix

**A return's refund is recorded against the order, per line.**

The operator types one figure, and `recordRefund` caps each line at what is left
un-refunded on it — so the figure is apportioned across the lines that came back,
shared by unit price, with the remainder on the last line so the parts sum to the
whole and never a cent more. A refund that is all postage has no line to sit on
and books against the order header, which is the honest answer for shipping given
back.

Post-commit and swallowed on failure, for the same reason the restock is: the
customer HAS their money, and a bookkeeping write that fails must not unwind
that. It logs instead.

The reason line reads **"Sent back: The Everyday Tee"** rather than the return's
id. An id on a shop owner's money screen is a sentence written for a developer.

## What it looked like once fixed

Anneliese's Tee, taken through the same path after the fix:

```
O-000004 · Anneliese Vogt              Part paid
The Everyday Tee    1 × $42.00
1 refunded                                  $42.00
Items                                      $170.00
Delivery                                      Free
Order total                                $170.00
Paid so far                                $128.00
Given back                                  $42.00

Money given back
$42.00 · Aug 25, 2026, 5:46 PM
Sent back: The Everyday Tee
```

`Paid` became **Part paid**, the line says **1 refunded**, and the full-refund
button is gone.

**O-000005 still carries the pre-fix state** — Jo Kim's $42.00 was settled before
the repair and the order was never told. It is left as the before-picture rather
than hand-edited; a real deployment would need a one-off reconciliation of any
return refunded before this shipped.

## Rating effect

`Sell › An order` in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md). Reachable only because
[219](219-there-was-no-way-to-start-a-return.md) opened the door.
