# 222 — Checkout chose "Collect in person" for a buyer who had asked to have it sent

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 11, on the other side
**Surface:** the Gillett site › checkout › Delivery
**Filed:** 2026-10-11
**Fixed:** 2026-10-11
**Confirmed by:** P01 on screen, 2026-10-11
**Blocked on:** —

## What happened

Renée, buying a Stanadyne additive, was on "Where should we send it?". She had passed by
"Rather pick it up? Collect it from us, free", chose "Main office · your usual one" and
pressed "See your options". Under "How you'll get your order" the option already chosen
was **Collect in person · Free**, above UPS Ground · 5 days · $15.00.

## What should have happened

She asked to have it sent, so the first way of sending it is chosen. Collecting stays on the
list and behind its own button for a buyer who changes their mind.

## How to reproduce

1. A shop that delivers and also hands over in person (Gillett does).
2. Check out a cart the shop holds; choose an address; See your options.
3. Every time: Collect in person is chosen, because it is free and the list is cheapest
   first.

## Why it matters

A buyer who presses Continue without reading places a collection order to an address they
typed: the parcel never goes, and they find out when it does not arrive.

## Where it lives

`wizeworks/apps/site/components/checkout/checkout-flow.tsx`: after quoting the address,
`setChosenRate(result.rates[0])`; the list is sorted by price.

## The fix

- `apps/site/lib/delivery-default.ts` `deliveryDefault`: the first way of sending it; collecting
  only when it is all there is.
- `checkout-flow.tsx` uses it after quoting an address, and as the fallback when nothing was
  chosen. A collection-only shop is unchanged.

Tests, red first: `lib/delivery-default.test.ts` (4). Lint clean.

## Confirmed by

P01 on screen, 2026-10-11, as Renée with Gillett's additive: Main office, See your options:
"UPS Ground · 5 days · $15.00" chosen, "Collect in person · Free" still listed above it.

## Rating effect

—
