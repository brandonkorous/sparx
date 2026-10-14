# 216 — The customer was told "Another courier" instead of the carrier's name

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 11 (dropshipping), on the other side
**Surface:** the Gillett site › an order; the shipping confirmation email
**Filed:** 2026-10-11
**Fixed:** 2026-10-11
**Confirmed by:** P01 on screen, 2026-10-11
**Blocked on:** —

## What happened

S&B Filters shipped Renée's fuel tank by freight. Doty recorded it on the supplier order:
Carrier "R+L Carriers", tracking 41187735. Renée's order page then read:

> On its way · Another courier · Tracking 41187735

The shipping email reads its carrier through the same words.

## What should have happened

"R+L Carriers": the name the owner typed. A customer looking up a PRO number needs to know
whose site to look it up on.

## How to reproduce

1. Record a shipment with a carrier sparx has no code for (R+L Carriers, Estes, a local
   courier).
2. Open the customer's order on the site. Every time: "Another courier".

## Why it matters

The customer cannot track a freight shipment without the carrier's name. The owner typed
it; it was kept (`metadata.carrierOther`) and not shown.

## Where it lives

- `wizeworks/packages/commerce-schemas/src/shipping.ts` `carrierLabel(code)`: the code only.
- Its callers: the site's order timeline (`apps/site/components/order-timeline.tsx`) and the
  email data (`services/api-rest/src/lib/email-data.ts`).
- `packages/commerce/src/services/return-service.ts` has its own `carrierLabel` that does read
  the typed name, for a replacement's shipment: a second copy of the same rule.

## The fix

- `commerce-schemas` `shipping.ts`: `carrierLabel(code, typed?)` uses the typed name for
  `other`; `typedCarrierOf(metadata)` reads it off a fulfillment.
- Passed in by every reader: the site's order timeline (through `carrierOther` on the
  account API's order view, `routes/v1/public/account.ts`), the shipping email's data
  (`lib/email-data.ts`), and both consoles' shipment line (`shipmentHeadline`, Piggles'
  `order-words.ts`).

Shared: every brand. Tests, red first: `carrier-label.test.ts` (+1). Lint clean.

## Confirmed by

P01, 2026-10-11, as Renée: O-000024's page reads "Part of it is on its way · Estes Express
Lines · Tracking 0218845570"; the workbench order's Deliveries reads "Estes Express Lines".
Her real shipping email for O-000026 (`.dev-outbox`, 08:49) reads "Carrier: Salt Lake
Courier · Tracking number: SLC-552190". The first email, sent before the fix, said
"Another courier".

## Rating effect

—
