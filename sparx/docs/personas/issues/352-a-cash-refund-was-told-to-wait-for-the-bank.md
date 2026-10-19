# 352 — A cash refund was told to wait for the bank

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · confirming issue 350, in the dev outbox
**Surface:** the "Order refunded" email (`builder-schemas/src/default-emails-silica.ts`)
**Filed:** 2026-10-19
**Fixed:** 2026-10-19
**Confirmed by:** P01 in the dev outbox, 2026-10-19
**Blocked on:** —

## What happened

Brynn paid cash at the counter for O-000033. When Doty gave $793.50 back, her email ended
"Refunds are returned to your original payment method and usually take 5–10 business days
to appear."

## What should have happened

A card refund says it can take days at the bank. Money taken by hand says the shop gives it
back the way it was paid.

## How to reproduce

1. Refund an order paid by hand.
2. Read the email. It promises a bank delay for money that never went near a bank.

## Why it matters

A customer handed cash back over the counter is told to watch her bank for a week, and calls
the shop when nothing arrives.

## Where it lives

The email had one closing line for every refund. Nothing told it how the refund was settled.

## The fix

The order refund path writes how it settled on the refund row, `settledBy: 'gateway'` or
`'hand'` (`api-rest/src/lib/order-refund.ts`). The resolver turns it into a pair, `refund.toACard`
and `refund.byHand`, exactly one filled (`refundGoesTo`). The email shows the bank line only
for a card, and "Gillett Diesel Service gives this back to you the same way you paid them."
otherwise. A row with no `settledBy` (recorded as already settled elsewhere) reads as by hand.

Tests, red first: `api-rest/src/lib/order-refund.test.ts` (2: by hand and by gateway, each
written on the row) and `refund-source.test.ts` (`refundGoesTo`, 2). The refresh list has the
outgoing body. Lint and format clean.

## Confirmed by

P01, 2026-10-19, in the dev outbox after the email reconcile ran for Gillett. O-000001 (a card
on Gillett's own machine, refund row `{"settledBy": "hand"}`): "Gillett Diesel Service gives this
back to you the same way you paid them.", with no bank line. O-000037 (paid online by test
card, refunded through Stripe test, `re_3USJkGFY8gqB2fvj1b84BUCj`, `{"settledBy": "gateway"}`):
"Refunds are returned to your original payment method and usually take 5–10 business days to
appear.", with no by-hand line.

## Rating effect

—
