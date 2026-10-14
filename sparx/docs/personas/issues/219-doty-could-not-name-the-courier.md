# 219 — Doty could not name the courier when he marked an order sent

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 11
**Surface:** workbench › an order › Deliveries › Mark it as sent; same in Piggles
**Filed:** 2026-10-11
**Fixed:** 2026-10-11
**Confirmed by:** P01 on screen, 2026-10-11
**Blocked on:** —

## What happened

Gillett sent the fuel additive on O-000024 with a local courier. On the order's
Deliveries, "Who took it" offered USPS, UPS, FedEx, DHL and "Another courier". He chose
"Another courier", and nothing asked which one. The customer would read "Another courier"
(issue 216), with a tracking number for nobody in particular.

A supplier's shipment (Dropshipping › a supplier order) takes the carrier's name in its
own words; the order page, where most shipments are recorded, did not.

## What should have happened

Choosing "Another courier" asks for its name, and the name is what the customer sees.

## How to reproduce

1. Open any order with something still to send.
2. Deliveries › Who took it › Another courier. No name box. Every time.

## Why it matters

Freight, regional and local couriers are how a parts business ships heavy things. A
tracking number is useless to the customer without whose it is.

## Where it lives

`sparx/apps/workbench/surfaces/commerce/record-handover.tsx` (and Piggles' copy): no
`carrierOther` sent. The API takes it (`crm-schemas` `order-fulfillments.ts`,
`carrierOther`, kept as `metadata.carrierOther`).

## The fix

- Both consoles' `record-handover.tsx`: "Another courier" shows "Courier's name", and Mark
  it as sent waits for it ("Say which courier took it"); the name goes as `carrierOther`
  through `useRecordFulfillment` (Sparx `data.ts`, Piggles `order-actions.ts`).
- Found on the way: the shipment kept the service the shopper chose ("UPS Ground") whatever
  carrier took it, so it read "Salt Lake Courier · UPS Ground". `carriers.ts` `serviceFor`
  keeps it only when the carrier is the one it names.

Tests, red first: `courier-name.test.ts` in each console (5). Lint clean; Piggles'
`record-handover.tsx` 199 lines.

## Confirmed by

P01 on screen, 2026-10-11, as Doty: O-000025 › Deliveries › Another courier showed
"Courier's name"; with "Salt Lake Courier" and SLC-552204 it recorded "Salt Lake Courier".
That shipment was made before `serviceFor` and still reads "· UPS Ground"; the rule is
covered by its test, not re-proved on a new shipment.

## Rating effect

—
