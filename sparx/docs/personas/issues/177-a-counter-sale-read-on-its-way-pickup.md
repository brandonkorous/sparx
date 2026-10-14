# 177 — A counter sale read "On its way · pickup" to the customer

**Status:** fixed
**Severity:** copy
**Found by:** P01 · Gillett Diesel Service · act 13 (the retail shopper finds their order)
**Surface:** the Gillett site › Your account › an order; anywhere a fulfillment's carrier is named
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P01 on screen, 2026-10-09 (the Gillett site, as Brynn)
**Blocked on:** —

## What happened

Brynn O'Hara-Løvdal made an account on Gillett's site and found her seven counter
orders. O-000001, an injector she took at the counter on Oct 1, reads:

- Order placed · Payment confirmed
- **On its way** · **pickup**
- Delivered

and lower down "How you'll get it: Taken at the counter". Nothing went anywhere, and
"pickup" is a code.

## What should have happened

"Collected", once, on the day she took it. And a carrier code is never printed as
itself.

## How to reproduce

1. Sign in on the site as a customer with a counter sale or a collect order.
2. Open it. Every time.

## Why it matters

The order page is the record the customer keeps. It tells her a parcel was sent.

## Where it lives

- `wizeworks/apps/site/components/order-timeline.tsx`, `buildTimeline`: every order
  gets "On its way" and "Delivered", whatever `order.collecting` says.
- `wizeworks/packages/commerce-schemas/src/shipping.ts`, `CARRIER_LABELS`: no entry for
  `pickup`, so `carrierLabel` returns the code.

## The fix

- `wizeworks/apps/site/lib/order-handover.ts`: `handoverSteps`, one "Collected" step for
  an order the customer took or fetched; "On its way" and "Delivered" for one that is
  sent. The timeline (`components/order-timeline.tsx`) draws from it.
- `wizeworks/apps/site/lib/order-status-words.ts`: `orderStatusLabel(status,
collecting)` says "Collected" for a delivered or fulfilled collected order. The order
  list now carries `collecting` (`GET /v1/public/commerce/account/orders`), so the
  list and the order page say the same.
- `wizeworks/packages/commerce-schemas/src/shipping.ts`: `pickup` reads "Collected in
  person"; `carrier-label.test.ts` checks every carrier a fulfillment can carry has
  words.

Red then green: the carrier test, the handover wiring test, the status words test.
Site 21 and schemas 611 tests pass; lint clean (account.ts edited around another
session's changes).

The trade portal too: `isCollectedOrder` moved to
`wizeworks/services/api-rest/src/lib/collected-order.ts`, and the portal's order list,
its recent orders and its order page carry `collecting`; the three site pages pass it
to `orderStatusLabel`.

## Confirmed by

P01 on screen, 2026-10-09 (the Gillett site, as Brynn O'Hara-Løvdal): Orders lists her
seven counter sales as "Collected" (O-000003, still to collect, "Placed"); O-000001's
timeline reads "Order placed · Payment confirmed · Collected", with "Refunded to you
−$150.00" and "You paid $600.00".

And the trade portal, as Renée: she ordered O-000021 again from O-000014 ("Collect in
person"); when Doty clicked "They collected it", her Wasatch Front page listed
O-000021 "Collected", $377.52.

## Rating effect

—
