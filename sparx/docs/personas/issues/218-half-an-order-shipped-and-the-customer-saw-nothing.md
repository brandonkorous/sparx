# 218 — Half an order shipped, and the customer saw nothing of it

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 11 (dropshipping), on the other side
**Surface:** the Gillett site › an order's timeline
**Filed:** 2026-10-11
**Fixed:** 2026-10-11
**Confirmed by:** P01 on screen, 2026-10-11
**Blocked on:** —

## What happened

Renée's order O-000024 had two things: S&B's Precision II cleaning kit, which S&B ships,
and a Stanadyne fuel additive, which Gillett ships. S&B shipped the kit; Doty recorded it
(Estes Express Lines, 0218845570). Renée's order page still read:

> Order placed · In progress · On its way · Delivered

with "On its way" not yet reached and no tracking anywhere on the page. The shipment was
recorded on her order; the page shows a shipment only once the WHOLE order has gone.

## What should have happened

"Part of it is on its way", with the carrier and the tracking for the part that left. The
rest stays in progress.

## How to reproduce

1. An order with two lines; ship one (any way: a supplier's part, or a partial shipment
   from the console).
2. Open it on the site. Every time: no tracking until every line has shipped.

## Why it matters

Any order split across a supplier and the shop's own shelves ships in parts, and so does
any order where one item is late. The customer has a tracking number in her email and
an order page that says nothing has left.

## Where it lives

- `wizeworks/apps/site/lib/order-handover.ts` `handoverSteps`: "On its way" is complete
  only when the order's `fulfilledAt` is set (all of it shipped).
- `wizeworks/apps/site/components/order-timeline.tsx`: the shipment lines are drawn only
  under a complete "On its way".

## The fix

- `apps/site/lib/order-handover.ts`: `partlyShipped` makes the step "Part of it is on its
  way" (not complete) until all of it has gone.
- `components/order-timeline.tsx`: passes it, and draws every shipment that has left under
  the step whether or not the rest has.

Tests, red first: `lib/order-handover.test.ts` (5). Lint clean.

## Confirmed by

P01 on screen, 2026-10-11, as Renée: O-000024 (kit shipped by S&B, additive still at
Gillett) reads "Part of it is on its way · Estes Express Lines · Tracking 0218845570".

## Rating effect

—
