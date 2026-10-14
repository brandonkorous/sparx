# 228 — An invoice printed a tax rate nobody charged

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · proving 226 on screen (Renée opens INV-000029)
**Surface:** the invoice raised for a web order (on account, and by "Make an invoice"); every printed copy of it
**Filed:** 2026-10-12
**Fixed:** 2026-10-12
**Confirmed by:** P01, 2026-10-12, Renée's INV-000030 on the site
**Blocked on:** —

## What happened

INV-000029 said:

> Tax (7.24%) · $1.81

Gillett charges Utah sales tax at 7.25%, and the checkout quoted 7.25%
(`rateBasisPoints: 725` on the quote). The invoice did not use that rate. It worked one
out backwards from cents: $1.81 ÷ $25.00 = 7.24%. Any rate from 7.22% to 7.26% gives
$1.81 on $25.00, so the guess is often wrong, and it prints as fact.

The order did not keep the rate; it kept only the tax in cents.

## What should have happened

The invoice prints the rate the checkout charged: 7.25%.

## How to reproduce

1. As Renée, buy two Stanadyne additives on account.
2. Open the invoice. "Tax (7.24%)".

## Why it matters

A sales tax rate on an invoice is a statement to the buyer and to the state. Wasatch
books sales tax by rate; a rate Utah does not have is one more reason the invoice gets
queried. The number is a guess shown as a measurement.

## Where it lives

- `wizeworks/packages/crm/src/services/ar-invoice-lines.ts` `taxRateFrom`: divides
  the taxed lines' tax by their subtotal. Used by `itemizedFromOrder` (the invoice for an
  order on account) and by `billing-from-order-service.ts` ("Make an invoice").
- `wizeworks/packages/commerce/src/services/checkout-service.ts` `complete()`: the
  order is written with the session's tax in cents and no rate. The session's
  `taxBreakdown` holds the rate per line (`jurisdictions[].rateBasisPoints`).

## The fix

The order keeps the rate the checkout charged, and its invoice prints that rate.

- `commerce/src/services/order-line-tax.ts` `quotedRateBasisPoints`: the one rate the
  quote charged (each taxed line's places added up, a state and a city), or null when
  it charged none or more than one. An exempt line is left out.
- `checkout-service.ts` `complete()` writes it on the order as
  `metadata.taxRateBasisPoints` (725 = 7.25%). No migration; the order's metadata
  already holds the checkout's other facts.
- `crm/src/services/ar-invoice-lines.ts` `invoiceTaxRate`: the kept rate, when it gives
  every taxed line its tax to the cent; otherwise the rate worked out from the lines.
  Used by both invoice paths: `itemizedFromOrder` (an order on account) and
  `billing-from-order-service.ts` ("Make an invoice").
- The neighbor: `taxRateFrom`, the worked-out rate, divided by the line's price before
  its discount, while the invoice taxes the price after it. A discounted taxed line
  could never add up, so its invoice fell back to one line. It now divides by what the
  line sold for.

Not changed: INV-000029, issued before the fix, keeps its 7.24%. It was sent; its
amounts are right.

Tests, red first: `commerce/src/services/order-line-tax.test.ts` (+5),
`checkout-line-tax.test.ts` (+2, the real `complete()`; red with the metadata line
taken out), `crm/src/services/ar-invoice-from-order.test.ts` (+4; 3 red before, the
fourth is the old behavior kept). commerce 562, crm 557 pass. Lint clean. Typecheck
not run.

## Confirmed by

P01, 2026-10-12, as Renée on the site. O-000031, one additive on account: the order
kept 725, and INV-000030 reads "Tax (7.25%) $0.91". Worked out from cents it would
have read 7.28%.

## Rating effect

—
