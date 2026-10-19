# 178 — A counter refund said it moved real money

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 13 (a retail return)
**Surface:** Workbench › Commerce › Returns › a return › Give the money back
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P01 on screen, 2026-10-09
**Blocked on:** —

## What happened

Brynn O'Hara-Løvdal sent back the injector from O-000004. She paid $750.00 at the
counter ($600.00 part, $150.00 core deposit), and Doty recorded that payment by hand.
Doty approved the return, marked it received, checked it and put it back on sale. Then
he clicked "Give money back…". The dialog said:

- "Brynn O'Hara-Løvdal gets this back the way they paid. This moves real money and
  cannot be undone."
- "Give as store credit instead of back to their card"

The page under it said "Settle the return by refunding the customer. This moves real
money".

Nothing moves. The payment was taken at the counter, so there is no card or gateway
to send it to. The click only records the refund. Doty must hand Brynn $750.00 himself,
and nothing on the screen tells him so.

## What should have happened

For money taken by hand, the screen says so: this records the refund, and you hand the
money over yourself. That is what the order page's own refund already says ("You hand
the money over yourself. Nothing is sent anywhere"). For money a gateway holds, "back
to their card" is still right.

## How to reproduce

1. Take an order paid at the counter (payment recorded by hand, cash or cheque).
2. The customer returns it. Approve, receive, check.
3. Click "Give money back…". Every time.

## Why it matters

Doty believes her card was refunded and hands her nothing. Brynn is out $750.00, and
the records say she was paid.

## Where it lives

- `sparx/apps/workbench/surfaces/commerce/return-actions.tsx`, `RefundReturnModal`: one
  wording for every payment.
- The same page's "Give the money back" step text.
- `wizeworks/packages/commerce/src/services/return-service.ts`: `issueRefund` decides
  with `takenByGateway(payment.processor)`; `get` sends the screen nothing about it.
- Piggles: `piggles/apps/workbench/surfaces/commerce/return-refund-modal.tsx`, the same
  sentence.

## The fix

One answer, read by both sides. `issueRefund` already chose "gateway or by hand" with
`takenByGateway`; the return detail sent the screen nothing about it.

- `wizeworks/packages/commerce/src/services/refund-source.ts`: `gatewayChargeOf(payment)`,
  the charge a refund can reverse or null. `return-service.ts` reads the captured payment
  once (`capturedPayment`) for both `issueRefund` and `get`, and the detail now carries
  `refundsByHand`.
- `shopperRefundRoute(issuedAs, refundsByHand)` in the same file: `payment`, `by_hand` or
  `store_credit`. The shopper's return (`GET /v1/public/commerce/account/returns/:id`)
  carries it as `refundedAs`.
- Workbench, both consoles: `surfaces/commerce/return-refund-words.ts` words the dialog,
  the step text and the settled line from `refundsByHand`. By hand: "paid you by hand, so
  nothing goes back on its own... you hand the money over yourself", button "Mark $750.00
  as given back", settled "Given back by hand". Through a gateway the old words stay.
  Store credit now says "Give $750.00 as store credit".
- The site: `components/returns/return-status.ts` `refundedLine` and `returnState(status,
route)`. Her page said "Sent back"; now "Given back to you", or "Added to your account"
  for store credit.

Tests, each proved red first: `refund-source.test.ts` (commerce, 10), the words test in
each console (6 and 8), `return-status.test.ts` (site, 7). Commerce 511, sparx commerce
449, Piggles commerce 485, site 427 and api-rest public 90 pass. Lint and format clean on
every touched file.

## Confirmed by

P01 on screen, 2026-10-09 (Commerce › Returns › O-000004): the dialog read "Brynn
O'Hara-Løvdal paid you by hand, so nothing goes back on its own. This records the refund,
and you hand the money over yourself"; the button "Mark $750.00 as given back". Doty
clicked it: "Settled", "Given back $750.00 · Given back by hand". The database holds two
refund rows, $600.00 for the part and $150.00 for the core deposit, and the order reads
refunded. The injector went back on sale: on hand 1 → 2.

The other side, as Brynn on the Gillett site: "Refunded · We gave your money back to you."
and "Refunded to you $750.00 · Given back to you October 9, 2026".

A gateway-paid return was not checked then: no business this run could sign in to took
cards. The Piggles screens were not opened; their tests pass.

**The gateway side, 2026-10-18.** Gillett now takes cards through sparx Pay (act 9).
Checking it found issue 339: every sparx Pay payment read as taken by hand, so Marisol
Vega's card return (O-000034) said "You hand the money over yourself". After 339's fix,
as Doty: "Settle the return by refunding the customer. This moves real money and cannot
be undone."; the dialog "Marisol Vega gets this back the way they paid", button "Give
back $640.96"; settled "Given back $640.96 · Back to how they paid", Stripe test refund
`re_3URpYdFY8gqB2fvj1M7EtLD2`. Dana Whitcomb's O-000035 the same, refund
`re_3URqObFY8gqB2fvj1n7GGuSr`. As each of them on the site: "Refunded · Your money has
gone back." and "Refunded to you $640.96". The same check found issues 338, 340 and 341.

## Rating effect

—
