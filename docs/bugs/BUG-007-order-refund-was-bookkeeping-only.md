# BUG-007 — Refunding an order recorded a refund without moving any money (and had no UI)

Status: **FIXED (code) 2026-07-24 — awaiting deploy**
Severity: **Critical** — a refund could be recorded on the books while the customer was never paid back
Found: 2026-07-24, production payments E2E (trying to refund `O-000002`)
Surfaces: `services/api-rest/src/lib/order-refund.ts` (new),
`services/api-rest/src/routes/v1/orders.ts`, `apps/workbench/surfaces/commerce/order-detail.tsx`

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
