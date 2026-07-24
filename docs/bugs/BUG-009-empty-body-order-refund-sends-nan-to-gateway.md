# BUG-009 — Refunding an order without an explicit amount sends `NaN` to the gateway

Status: **FIXED (code) 2026-07-24 — awaiting deploy**
Severity: Medium — the workbench UI is unaffected (it always sends an amount); the
hole is any API/MCP/script caller that POSTs the documented "refund the whole order"
shape (an empty body), which fails at the gateway with a cryptic error
Found: 2026-07-24, production payments E2E — refunding `O-000002` via the API with `{}`
Surfaces: `services/api-rest/src/lib/order-refund.ts`,
`services/api-rest/src/routes/v1/orders.ts`

## Symptom

`POST /v1/orders/:id/refunds` with an empty body on a paid order returned:

```json
{ "code": "BAD_REQUEST", "message": "Refund failed at the payment gateway: Invalid integer: NaN" }
```

The customer was NOT refunded, and the error reads like a Stripe/gateway fault
rather than a bad request the caller can fix.

## Root cause

The route coerced the amount unconditionally: `amount: Number(body.amount)`. With
no `amount` in the body that is `Number(undefined)` → **`NaN`**, passed straight
into `refundOrderThroughGateway`. Its guard —

```ts
const amountCents = Math.round(input.amount * 100); // Math.round(NaN) = NaN
if (amountCents <= 0) throw badRequest('Refund amount must be greater than zero.');
```

— does **not** catch it: every comparison with `NaN` is `false`, so `NaN <= 0`
is false and the guard is skipped. `NaN` cents then reach `paymentService.refund()`
and Stripe rejects it as `Invalid integer: NaN`.

Why it hid until now: the only caller in practice is the workbench order pane, which
always computes and sends an explicit `amount` (`amountPaid − refundTotal`). The
endpoint's own contract — POST with no amount to refund the full remaining balance —
had simply never been exercised until an API-level test hit it. (BUG-007 is what made
this endpoint settle real money at all; this is the next layer down.)

## Fix

Make "no amount" mean "refund everything still outstanding", and make the guard
reject non-finite amounts so a bad value fails cleanly here, never at the gateway.

- **`refundOrderThroughGateway`**: `amount` is now optional. It loads the order's
  `amountPaid` + `refundTotal` alongside the target payment and defaults the amount
  to `amountPaid − refundTotal` (the full remaining refundable) when none is given.
  The resolved amount — not `input.amount` — is what gets recorded, so the
  `order_refunds` row is never written with an undefined amount.
- **Guard hardened**: `if (!Number.isFinite(amountCents) || amountCents <= 0)` →
  a clean `There is nothing left to refund on this order.` A genuinely
  fully-refunded order now gets that message instead of a gateway NaN.
- **Route**: forwards `amount` only when the caller supplied a finite number,
  otherwise omits it so the helper's default applies. No more blind
  `Number(body.amount)`.

## Verify after deploy

- `POST /v1/orders/:id/refunds` with body `{}` on a paid order → refunds the full
  remaining amount (real gateway refund), no `Invalid integer: NaN`.
- The same call on an already-fully-refunded order → clean 400 "nothing left to
  refund", no gateway round-trip.
- Workbench refund (explicit amount) is unchanged.
