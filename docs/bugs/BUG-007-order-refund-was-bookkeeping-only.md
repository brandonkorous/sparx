# BUG-007 — Refunding an order recorded a refund without moving any money (and had no UI)

Status: **✅ FIXED — VERIFIED IN PRODUCTION 2026-07-24**
Severity: **Critical** — a refund could be recorded on the books while the customer was never paid back
Found: 2026-07-24, production payments E2E (trying to refund `O-000002`)
Surfaces: `wizeworks/services/api-rest/src/lib/order-refund.ts` (new),
`wizeworks/services/api-rest/src/routes/v1/orders.ts`, `sparx/apps/workbench/surfaces/commerce/order-detail.tsx`

## Symptom

Two problems, found together while trying to refund a paid order:

1. **No UI at all.** The order pane's "Money in" list is read-only — no refund control
   anywhere, even though the Cancel-order copy right below it says _"Any money already
   taken stays until you refund it."_ There was no way for a merchant to refund a sale.
2. **The API wouldn't have moved money anyway.** `POST /v1/orders/:id/refunds` called
   `orderRefundsService.recordRefund`, which is **bookkeeping only** — it writes an
   `order_refunds` row using a `processorRef` the CALLER supplies and never contacts a
   payment gateway. A merchant using that endpoint would mark an order refunded, see the
   books balance, and the customer would never be paid back.

## Root cause

`recordRefund` being record-only is correct for callers that settle elsewhere first — the
returns flow (`commerce/return-service.ts`) issues a real `paymentService.refund()` and
then records it, and an offline refund is recorded the same way. The order-level endpoint
simply skipped the settlement half and went straight to recording.

The gateway capability was never missing: `paymentService.refund()` exists and is already
used correctly by returns and by booking deposits. Only the order path was wired wrong.

## Fix

**Settle first, then record** — mirroring return-service's proven ordering, so a gateway
failure leaves the order untouched and staff can retry, instead of a phantom refund.

- **New `lib/order-refund.ts` → `refundOrderThroughGateway()`**: resolves the newest
  captured `OrderPayment`, calls `paymentService.refund()` against its `processorRef`,
  maps gateway/config failures to clean 400s, then calls `recordRefund` stamped with the
  gateway's own refund id — which is the join key `charge.refunded` later reconciles by.
- **`POST /v1/orders/:id/refunds`** now settles through the gateway by default. A caller
  that has already settled elsewhere still passes its own `processorRef` and gets the
  record-only path, unchanged (returns + offline refunds are unaffected).
- **Workbench order pane**: a "Refund this order" row (same treatment as Cancel —
  irreversible, so a plain row under a divider, not a card), offered only when
  `amountPaid − refundTotal > 0`, behind a confirm naming the exact amount and warning
  that stock is NOT restocked (use a return for that). Full remaining amount only;
  partial + line-level refunds remain the returns flow's job, which already does them.

## Verify after deploy

- Refund a paid order → Stripe shows a real refund on the charge, the order flips to
  refunded/partially-paid, and the refund appears under the order.
- The button disappears once nothing is left to refund.
- A tenant with no gateway configured gets the clean "refund manually / issue credit"
  message and **no** refund row is written.

## Verified in production 2026-07-24

Refunded **O-000003** ($30) from the workbench order pane. The confirm named the
exact amount + destination email and warned stock is not restocked. Result:

- **Real Stripe refund** `re_3Twp7xFY8gqB2fvj1o77reev` — `amount: 3000`,
  `status: succeeded`, against charge `ch_3Twp7x…`. Not a bookkeeping-only row.
- Order flipped to **Refunded** (`paymentStatus: refunded`, `amountPaid: 0`,
  `refundTotal: 30`).
- The sparx `order_refunds` row carries `processorRef: re_3Twp7x…` — the
  gateway's own id, i.e. the exact join key `charge.refunded` reconciles by.
- The "Refund this order" row disappeared once nothing remained to refund.

One follow-on defect surfaced (not a regression in this fix): the CRM consumer of
the resulting `order.refunded` event threw because the publisher omitted
`customerId` — see [BUG-008](./BUG-008-order-refunded-event-missing-customer-id.md).
The refund + Stripe settlement were unaffected; only the downstream CRM
lifetime-value bookkeeping failed.
