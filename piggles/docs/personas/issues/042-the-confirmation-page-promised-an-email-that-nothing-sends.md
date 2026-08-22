# 042 — The confirmation page promised an email that nothing sends

**Status:** the false promise is fixed. **The missing email is a design decision — Brandon's call, not a patch**
**Severity:** major (the customer's only written record of an order they have not paid for)
**Found by:** P01 · Thistle & Rye · act 8 — after placing **O-000001**
**Surface:** the tenant's live `/checkout` confirmation
**Filed:** 2026-08-21

## What happened

> 🎉 **Order confirmed**
> Thank you! Your order **O-000001** has been placed. A confirmation email is on
> its way.

No email is on its way. Nothing will send one for this order, ever.

## Why it happened

`order-confirmation` is sent from the **payment webhook**
(`api-rest/src/lib/payment-webhook-reconcile.ts:422`). That is a deliberate
design — the seed file says as much, describing the other order emails as _"the
counterparts to order-confirmation"_ — and it works for a card order.

It sends nothing for an order that never takes a card payment. That is:

- a shop on **manual payments** (this one — [#041](041-a-shop-that-takes-payment-at-the-counter-could-not-take-an-order.md)),
- a **B2B order billed to account** on net terms,
- anything settled in person or by arrangement.

The seeded system automations cover `order.paid`, `order.delivered`,
`order.cancelled` and `order.refunded`. **There is no `order.placed` one.**

## Why it is not simply "add the automation"

A naive `order.placed` rule sends a card customer **two** emails — one at
placement and one from the payment webhook minutes later.

There is no condition available that separates them. `order.paymentStatus` is
exposed to the automation resolver, but a card order is _also_ `unpaid` at
placement (it flips on the webhook), and the only statuses in the estate are
`paid` / `unpaid` / `refunded`. So the two cases are genuinely indistinguishable
at `order.placed`.

The real question underneath is a design one: **is order-confirmation a
confirmation of the ORDER or a receipt for the PAYMENT?** Today it is both, which
is why it has no home for an order that is not a payment. Splitting them —
confirmation on `order.placed`, receipt on `order.paid` — is the answer that
makes all four cases work, and it is a transactional-email decision, not a bug
fix.

## What IS fixed

The page no longer promises what it cannot deliver. For an in-person order it
says what is actually true and useful:

> Thank you! Your order **O-000001** has been placed. Keep this order number —
> you pay when you collect.

Telling somebody an email is coming when we know none is, is its own defect
regardless of how the underlying one is settled.

## Related, and found on the way

**Her tenant had ZERO system automations.** Every other tenant with modules
active has ~46. The cause is the broker: system automations are seeded on
`module.activated`, and before there was a broker in dev that event was published
into the `log` transport and dropped — so every tenant ever created on a laptop
missed the lot, silently. The daily reconcile pass exists for exactly this and
could not run either, because the cron endpoints refuse without
`SPARX_INTERNAL_CRON_TOKEN`, which no local `.env` carried.

With the broker up and the token set, `POST /internal/cron/reconcile-seeds`
installed **1,651 automations across 142 tenants**, 50 of them hers. The
self-heal worked exactly as designed the moment it could reach anything.
