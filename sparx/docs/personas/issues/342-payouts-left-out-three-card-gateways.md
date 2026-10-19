# 342 — Payouts left out three card gateways

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · fixing issue 339 (its neighbour)
**Surface:** Workbench › Finance › Payouts, its list and its "source" filter (both consoles); `GET /v1/finance/payouts`
**Filed:** 2026-10-18
**Fixed:** 2026-10-18
**Confirmed by:** P01 on screen as Doty, 2026-10-18 (the filter); the three gateways by test
**Blocked on:** —

## What happened

While fixing 339, the payouts route turned out to keep its own private list of the
processors whose sales settle to a bank: Stripe, PayPal, Square and sparx Pay. The comment
over the route promised a shop on Square or Authorize.net "the vendor-agnostic derived
view". A shop paid through Your own Stripe, Authorize.net or 1stPayGateway saw no deposits
at all, and its "source" filter had no entry for its own gateway.

## What should have happened

Every gateway that holds a card charge settles to the bank, and the payouts page lists its
deposits.

## How to reproduce

1. Take card payments through Your own Stripe, Authorize.net or 1stPayGateway.
2. Open Finance › Payouts. "No payouts yet". Every time.

## Why it matters

The owner is told no money is on its way to the bank while it is. The same list in two
places gave two answers, as in issues 223 and 303.

## Where it lives

`wizeworks/services/api-rest/src/routes/v1/finance/payouts.ts`: `const GATEWAY_PROCESSORS`;
`surfaces/finance/payouts-list.tsx` (both consoles): `PROCESSOR_FILTERS`.

## The fix

The route reads `GATEWAY_PROCESSORS` from `@wizeworks/payments` (issue 339's list, read from
the gateway catalog). Each console's filter adds Your own Stripe, Authorize.net and
1stPayGateway, by their names in the catalog.

Test, red first: `api-rest/src/routes/v1/finance/payouts-sources.test.ts` (3). The route
imports the shared list and keeps none of its own, and each console's filter offers exactly
the sources the route settles. Red against the old route and both old filters (3 failed),
green after. Lint and format clean.

## Confirmed by

P01 on screen as Doty, 2026-10-18: Finance › Payouts' source filter reads All sources, Card,
PayPal, Square, Your own Stripe, Authorize.net, 1stPayGateway, sparx Pay, and Gillett's sparx
Pay deposit still listed. Not checked: a deposit from the three gateways on screen (no
business here takes payment through them). The Piggles console was not opened.

## Rating effect

—
