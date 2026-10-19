# 339 — A card refund told the owner to hand the money over himself

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · checking issue 178 (a card-paid return)
**Surface:** Workbench › Commerce › Returns › a return › Give the money back; the order page's refund; a core deposit's refund (`wizeworks/packages/payments/src/processors.ts`)
**Filed:** 2026-10-18
**Fixed:** 2026-10-18
**Confirmed by:** P01 on screen as Doty, Marisol Vega and Dana Whitcomb, 2026-10-18
**Blocked on:** —

## What happened

Marisol Vega paid $640.96 by card through sparx Pay (O-000034, a Stripe test card). She
sent the injector back. Doty approved the return and marked it received. The return page
then said: "Give the money back. Settle the return by recording the refund. You hand the
money over yourself."

That is the wording for cash. Her money was on a card. Had Doty pressed on, sparx would
have recorded a refund and sent nothing back to the card, and the screen would have told
him to pay her out of the till.

## What should have happened

A payment taken through a gateway is refunded through it. The dialog says "This moves
real money", and the money goes back to the card.

## How to reproduce

1. Pay for an order on the site with a Stripe test card (sparx Pay).
2. Ship it. The customer asks to send it back. Approve it and mark it received.
3. The "Give the money back" step says "You hand the money over yourself". Every time,
   on every sparx Pay, Your own Stripe, Square, Authorize.net and 1stPayGateway payment.

## Why it matters

A card customer's refund never reaches her card, and the shop is told to hand over cash
it may never have taken. The order refund and the core deposit refund ask the same
question, so they were wrong in the same way.

## Where it lives

`GATEWAY_PROCESSORS` in `wizeworks/packages/payments/src/processors.ts` held `stripe` and
`paypal`. Checkout writes the gateway's catalog id as the payment's processor
(`checkout-service.ts`, `processor: session.paymentProviderSlug`): `sparx_pay`,
`stripe_direct`, `square`, and so on. None of those was in the list. Three refund paths
read it through `takenByGateway`: the return refund (`refund-source.ts`), the core deposit
refund (`core-service.ts`) and the order refund (`api-rest/src/lib/order-refund.ts`).

## The fix

The list is read from the gateway catalog: every gateway whose `capabilities.refunds` is
true, plus `stripe` and `paypal` for payments written before checkout used the catalog id.
`manual` and `custom` cannot refund, so they stay by hand.

Test, red first: `wizeworks/packages/payments/src/processors.test.ts`. Every catalog gateway
that can refund is taken by a gateway, none that cannot is, the older names still are, and
cash, cheque, wire, a card on the shop's own terminal, terms and gift card are not. Red
against the old list ("sparx_pay: expected false to be true"), green after. Payments 138,
commerce `refund-source` and `core-service` 39 pass. Lint and format clean.

## Confirmed by

P01 on screen, 2026-10-18. Marisol's return (O-000034) after the fix: "Settle the return by
refunding the customer. This moves real money and cannot be undone." The dialog: "Marisol
Vega gets this back the way they paid", $490.96 with $33.19 of sales tax plus $150.00 in
core deposits, button "Give back $640.96". Doty pressed it: "Settled · Given back $640.96 ·
Back to how they paid". Stripe test mode made refund `re_3URpYdFY8gqB2fvj1M7EtLD2`, kept on
the order's refund row. Dana Whitcomb's return (O-000035) went the same way, refund
`re_3URqObFY8gqB2fvj1n7GGuSr`. On the site, each read "Refunded · Your money has gone back"
and "Refunded to you $640.96". Both injectors went back on sale.

Not checked: Your own Stripe, Square, Authorize.net and 1stPayGateway refunds on screen (no
business here takes payment through them; the catalog test covers them). The Piggles
consoles were not opened; the payments package is shared.

## Rating effect

—
