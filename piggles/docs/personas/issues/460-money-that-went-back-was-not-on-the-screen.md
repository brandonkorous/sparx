# 460 — Money that went back to the customer was not on the screen

**Status:** fixed
**Severity:** major
**Found by:** Devi opening Money for the first time — Payments, the module's landing
**Surface:** `finance.payments.list` (both consoles)
**Filed:** 2026-09-09

## What was wrong

The Payments list shows each payment and, beneath it, how much of it went back.
Two of Devi's rows were wrong:

| order    | screen said                 | actually went back |
| -------- | --------------------------- | ------------------ |
| O-000004 | $170.00 · **−$128.00 back** | **$170.00**        |
| O-000005 | $147.00 · **(nothing)**     | **$42.00**         |

She was told she had kept $84 more than she had.

## Why

The refund total was grouped by `paymentId`:

```ts
where: { paymentId: { in: ids }, status: { not: 'failed' } }
```

`orderRefund.paymentId` is **nullable**, and a refund with no payment matches
nothing — so it vanishes rather than erroring.

Which refunds have no payment? The two writers differ, and both are right about
their own case:

- The **order refund button** (`api-rest/lib/order-refund.ts`) reverses a specific
  charge and records it: _"Record it against the SAME payment, stamped with the
  gateway's refund id so the charge.refunded webhook can find this row."_
- The **returns flow** (`return-service.ts`) refunds an ORDER. There is no single
  payment to name, so it passes none.

Measured platform-wide before fixing:

|                          | refunds | value         |
| ------------------------ | ------- | ------------- |
| linked to a payment      | 2       | $549.28       |
| **no payment (returns)** | **10**  | **$7,767.08** |

**The screen was showing 7% of the money that had gone back.**

## The platform already had the right answer

`orders.refundTotal` was correct on both rows — 170.00 and 42.00 — because the
rollup that maintains it reads refunds **by order**:

```ts
// recomputeOrderPaymentRollup — "the single chokepoint, so every payment path
// observes the transition identically"
const refunds = await tx.orderRefund.findMany({
  where: { tenantId, orderId, status: 'completed' },
});
```

So this is [[feedback_a_fix_leaves_its_neighbour_behind]] in its "second place
holding a fact the platform already displays" form: one query answered the
question at a documented chokepoint, and a second answered it worse.

## The fix

Read refunds **by order**, then attribute:

- a refund that names its payment belongs to that payment;
- one that does not belongs to the ORDER, and comes off that order's payments in
  the order they were taken, each capped at its own amount.

Never invents a link, never attributes more back than came in, and reduces to
"all of it" for a single payment — which is 27 of 29 orders here. The funding
payments are read for the whole order rather than the current page, so a row's
share does not change with pagination.

Measured before choosing that rule: **zero** orders have both multiple payments
and an unlinked refund, so the ambiguous case is defined rather than guessed at.

## On screen

Before: `$170.00 / −$128.00 back` and `$147.00` with nothing.
After: `$170.00 / −$170.00 back` and `$147.00 / −$42.00 back` — both now agreeing
with the order's own record.

## Not a defect, checked and dismissed

The order numbers render in a monospace face where `O` and `0` look alike, so
`O-000013` reads as `0-000013`. Read out of the DOM the character is code 79, a
capital O, and no order number begins with a digit — so there is nothing for a
person to confuse it with. Left alone.
