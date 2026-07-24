# BUG-008 — The `order.refunded` event omitted `customerId`, crashing the CRM consumer

Status: **FIXED (code) 2026-07-24 — awaiting deploy**
Severity: Medium — the refund itself succeeds (money moves, order flips to
refunded); only the downstream CRM bookkeeping fails, silently and after the fact
Found: 2026-07-24, production payments E2E — the FIRST real order-level refund
(BUG-007's fix made order refunds fire for the first time, which is what exposed this)
Surfaces: `packages/crm/src/services/order-refunds-service.ts` (publisher),
`packages/crm/src/consumers/order-events.ts` (consumer)

## Symptom

Immediately after a successful refund of `O-000003` (real Stripe refund
`re_…`, order correctly flipped to **Refunded**), api-rest logged:

```
[crm-consumer] order.refunded PrismaClientValidationError:
Invalid `prisma.customer.update()` invocation:
{ where: { id: undefined, … } }
```

The refund was real and complete — this is purely the CRM side-effect
(activity row + lifetime-spend decrement) blowing up because it had no customer
to attach to.

## Root cause

`recordRefund` published `order.refunded` with a payload of only
`{ orderId, refundId, refundAmount, currency }` — **no `customerId`**. The
consumer (`registerOrderEventConsumers` → `order.refunded`) reads
`payload.customerId` for two writes:

- `tx.crmActivity.create({ data: { customerId: payload.customerId, … } })`
- `tx.customer.update({ where: { id: payload.customerId }, … })` ← throws on `undefined`

`Order.customerId` is **non-null** in the schema, so the id was always available
at publish time — the publisher just never put it in the payload. The mismatch
went unnoticed because order-level refunds never actually reached the publisher
until BUG-007 wired the gateway-settled path + UI today; the only prior refund
path (returns) publishes its own events.

## Fix

The publisher now captures `order.customerId` inside the transaction (the order
is already loaded there) and includes it in the event payload. One line of data,
plus the capture:

```ts
let orderCustomerId = '';
// … inside the txn, after loading the order:
orderCustomerId = order.customerId;
// … in the publish payload:
customerId: orderCustomerId,
```

No consumer change: `OrderRefundedPayload extends OrderLifecyclePayload`, which
already declares `customerId: string`, so the consumer was correct all along —
the publisher simply wasn't honoring the contract.

## Verify after deploy

- Refund a paid order → no `order.refunded PrismaClientValidationError` in
  api-rest logs.
- The customer's CRM activity feed shows an "Order refunded" entry.
- The customer's `totalSpent` drops by the refunded amount.
