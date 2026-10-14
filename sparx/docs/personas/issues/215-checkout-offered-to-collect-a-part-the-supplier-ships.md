# 215 — Checkout offered to collect a part the supplier ships

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 11 (dropshipping), on the other side
**Surface:** the Gillett site › checkout › Delivery
**Filed:** 2026-10-11
**Fixed:** 2026-10-11
**Confirmed by:** P01 on screen, 2026-10-11
**Blocked on:** —

## What happened

Renée had one thing in her cart: the S&B 68 gallon tank, which S&B Filters ships straight
to the customer (issue 171). At checkout, "Where should we send it?" offered "Rather pick
it up? Collect it from us, free", and under "How you'll get your order", "Collect in
person · Free" beside UPS Ground.

The tank is never at Gillett. S&B holds it. A buyer who chose to collect would drive to
Bluffdale for a part that is not there, and the order sent to S&B would have no address.

## What should have happened

A cart holding anything a supplier ships straight to the customer is delivered: collecting
is not offered for it.

## How to reproduce

1. A product set to ship from a supplier (the tank, from S&B Filters).
2. Add it to the cart and go to checkout's Delivery step.
3. Every time: "Collect in person" is offered.

## Why it matters

An order nobody can fulfill, and a customer who makes a wasted trip. And a supplier order
with no ship-to: it waits for the owner (171), who has to ring the customer.

## Where it lives

`wizeworks/packages/commerce/src/services/shipping-service.ts` `rateShipment` adds
collection when the site offers it (sparx persona issue 129), knowing nothing of what is in
the cart. `quoteForLines` (the one quote both the checkout's question and the price it
charges go through) knows the variants.

## The fix

- `packages/commerce/src/services/collection-option.ts` `forWhatShips`: no collection for a
  cart a supplier ships any of.
- `shipping-service.ts` `quoteForLines` reads each variant's `dropshipSourceId` and applies
  it. It is the one quote behind the checkout's question AND the price it charges
  (`submitShipping`), so a collection cannot be chosen around the page either.

Shared: every brand's checkout.

Tests, red first: `collection-option-supplier.test.ts` (4): taken away, kept for the shop's
own goods, nothing rather than an impossible collection, and that `quoteForLines` applies
it. Lint clean.

## Confirmed by

P01 on screen, 2026-10-11, as Renée: a cart with S&B's cleaning kit (which S&B ships) and
Gillett's Stanadyne additive offered only "UPS Ground · 5 days, $15.00": no "Rather pick it
up?", no "Collect in person". A cart with only the additive offered both, as it should
(O-000025).

## Rating effect

—
