# 917 — A shop on Square, PayPal or Authorize.net could not be paid

**Status:** fixed (act 324), not yet run against a vendor sandbox
**Severity:** blocker (real money, every shop on these gateways)
**Found by:** P03 · Juniper Row · act 324, closing the last open part of [739](739-a-shopper-cannot-subscribe.md)
**Surface:** checkout on her site; mypiggles › Money › How you get paid
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** tests only (see below); a sandbox run per vendor is still owed
**Blocked on:** —

## What happened

Devi takes payment with her own Stripe, so none of this touched her shop. It
came up while closing the one part of 739 still open: Square, PayPal and
Authorize.net marked an order paid only from their webhook, so they needed the
same "ask the gateway" check Stripe got. Building that check meant reading how
each of them takes a payment, and each one was broken further up.

**One reference for every shopper.** Each payment carries a reference the
vendor echoes back. It was built from the order, invoice or booking id, and fell
back to the word `sparx`. Checkout passes none of the three, because the order
is written after the payment. So every shop checkout on Square, PayPal,
Authorize.net, 1stPay and a custom gateway carried the reference `sparx`:

- Authorize.net, 1stPay and a custom gateway stored `sparx` as the payment's
  id. A "paid" message for any shopper found whichever order it met first.
- Square and PayPal used it as their duplicate guard, and both answer a
  repeated guard with the FIRST request's result. A second shopper could be
  sent the first shopper's payment page, or turned away.
- Where an id did arrive (an invoice), Authorize.net's invoice field holds 20
  characters and the id is 36. The id was cut short on the way out, so the
  message coming back could never match what was stored.

**No address to send a webhook to.** The only webhook addresses were Stripe's
two. Square, PayPal and Authorize.net had code to read a webhook and the console
asked for the keys to check one, and there was nowhere for one to arrive. Before
this act nothing marked an order on these gateways paid, ever.

**PayPal never took the money.** The step that takes the money after the shopper
approves on PayPal's page (`captureOrderForTenant`) had no caller. Every PayPal
checkout stopped at "approved", and PayPal lets an approval lapse.

**An unsigned webhook was trusted.** The signing key for each of these was
optional, and with none set the message was read without a check. Anyone who
knew the address could have marked an order paid or refunded.

**PayPal's check could never pass.** It compared a shared-secret code that
PayPal does not send. PayPal signs with its own certificate. An owner who filled
in "Webhook secret" would have had every real message refused.

**No refund could reach the money.** Every refund is sent the reference the
checkout kept. Square refunds a payment and was sent its order; PayPal refunds
a capture and was sent its order; Authorize.net refunds a transaction and was
sent our invoice number, and also wanted the card's last 4 digits, which no
caller passed, so it refused every refund before sending it. Square's duplicate
guard was one key per payment, so a second part refund was refused as a repeat
of the first.

**The console's steps were Stripe's.** Under the webhook address, every
gateway's screen said "In Stripe: Developers → Webhooks".

## What should have happened

A shopper pays on Square, PayPal or Authorize.net, the order turns paid, and
her account keeps the card if she asked for a repeat order. Docs/111 marked the
per-vendor webhook routes as "wired against the adapters"; they were not.

## What changed

- **A reference per attempt.** `paymentReference()` replaces `orderReference`:
  new on every call, 20 characters, so it fits Authorize.net's field uncut.
- **Each gateway can be asked.** `lookupPayment` for Square (the order, then
  its card payment), PayPal (the order and its capture) and Authorize.net
  (unsettled transactions, then the last 4 days of settled batches, matched by
  invoice number, skipping refunds). Checkout completion and the 5-minute
  stranded-payment sweep already call it, through the webhook's own handlers.
- **PayPal takes the money.** When that check finds an order the shopper
  approved, it captures it, with a request id fixed to the order so a second
  ask never charges twice. A refused capture is "failed".
- **Webhook addresses** at `/v1/public/webhooks/{square,paypal,authorize-net,custom}/:tenantId`,
  shown in the console beside Stripe's. A message is read only when signed with
  that tenant's own key; with no key it is refused. PayPal messages are checked
  by handing them back to PayPal with the webhook's id. The PayPal field is now
  **Webhook ID**, not "Webhook secret".
- **Refunds** go to what each vendor refunds. `PaymentService.refund` reads
  the id the order's payment kept when it landed (`transactionRef`), once for
  every caller. Square refunds that payment, or the order's card tender; PayPal
  refunds the order's capture; Authorize.net reads the transaction for the
  card's last 4, and cancels it whole (a void) when it has not settled yet,
  since Authorize.net cannot refund a payment before then. A part refund before
  settlement says to wait until it settles. Square's guard now carries the
  amount.
- **The console** says, per gateway, where the address goes in that vendor's
  own account and which field its answer fills. A custom gateway, which cannot
  be asked about a payment, says plainly that its messages are how an order is
  marked paid, and its webhook secret is now required.
- **Help text** for each signing key now says what it is for: payments show as
  paid without it, refunds and disputes handled in the vendor's own dashboard
  do not reach the console. Authorize.net's says to switch on Transaction
  Details API, which the paid check needs.

## Proof

- `packages/payments/src/gateway-lookup.test.ts`, 35 tests against each vendor's
  documented request and answer shapes. Run against the old gateways, 34 fail.
  The one that passes reads a correctly signed Square message, which already
  worked.
- `held-card.test.ts`: a refund through `paymentService` is sent the payment
  id the order's payment kept. Switching that read off reddens it.
- `services/api-rest/src/routes/v1/webhooks/payments.test.ts`, 6 tests: a
  signed Square message reaches the order, an unsigned one is refused with 403
  and touches nothing, and all four addresses exist. All 6 fail on the old
  route file.
- Payments: 133 tests, typecheck and ESLint clean. api-rest typecheck and
  ESLint clean. Both consoles typecheck; ESLint, plain-words, em-dash, American
  spelling, brand and console-parity checks clean.

## Still owed

- **A sandbox run per vendor.** These tests prove we send what each vendor
  documents. Only a run in Square's, PayPal's and Authorize.net's sandboxes
  proves they accept it. Each needs a sandbox account.
- **1stPay** is left as it was, apart from the shared reference. Its adapter
  says its hosted page and webhook field names were never confirmed against
  1stPay, so there is no honest format to build an address for. It has no
  paid check either, so an order there is still never marked paid.

## Rating effect

Not scored: Devi's own shop takes payment with Stripe. Recorded in the run log
of [03-juniper-row.md](../03-juniper-row.md).
