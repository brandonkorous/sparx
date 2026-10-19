# 170 — A supplier order placed by hand read "failed" and could never be finished

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 11 (dropshipping)
**Surface:** workbench › Dropshipping › Supplier orders; the customer's order and emails; same in Piggles
**Filed:** 2026-10-08
**Fixed:** 2026-10-11
**Confirmed by:** P01 on screen, 2026-10-11 (the shipped half; see below)
**Blocked on:** —

## What happened

Found while setting up Gillett's dropshipping, by reading what the screens lead to;
not yet seen with a real order, because no product could be linked ([171]).

Connect a supplier › "CSV feed" says: "Orders do not go over on their own: you place
each one with them yourself, and no tracking comes back." When a customer buys such a
product, the order to the supplier is recorded as **failed**, with "CSV suppliers do
not support automated order submission. Place this order manually with your
supplier." Nothing on any screen then lets the owner say they placed it, give the
supplier's order number, say it shipped, or type the tracking number.

For a supplier that does send tracking (Printful, Printify, DSers, Spocket), the
shipment is recorded on the supplier order and announced as `dropship.order.shipped`,
but nothing records it on the customer's order. The customer's "your order is on its
way" email hangs off a fulfillment on their order, so a dropshipped customer is never
told, and the order never reads as shipped.

## What should have happened

An order the owner places by hand waits as "to place", not "failed". The owner can
record that it is placed, then that it shipped with its tracking number, and the
customer's order shows it shipped and the customer gets the usual email, the same as
for anything that leaves Gillett's own shelves.

## How to reproduce

1. Connect a CSV-feed supplier, import a product from it, sell it.
2. Supplier orders: the order reads failed. No way to move it on. Every time.

## Why it matters

"Failed" is false: nothing failed, it is waiting for the owner. And the job a
dropshipped sale exists for, getting the part to the customer and telling them, cannot
be finished in sparx.

## Where it lives

- `wizeworks/packages/dropship/src/adapters/csv.ts`, `submitOrder`: returns `failed`.
- `wizeworks/packages/dropship-worker/src/handlers/route.ts`: anything not `failed`
  becomes `submitted`.
- `wizeworks/services/api-rest/src/routes/v1/dropship/orders.ts`: list, read, and
  re-route only; no way to record placed or shipped.
- `wizeworks/services/api-rest/src/lib/dropship-tracking.ts`: records a supplier's
  tracking on the supplier order only.
- `wizeworks/packages/crm/src/services/order-fulfillments-service.ts`,
  `createFulfillment`: the one path that marks an order shipped and publishes
  `order.fulfilled`, which sends the shipping email.

## The fix

Built, not yet proved on screen.

- `wizeworks/services/api-rest/src/lib/dropship-shipment.ts`: `recordDropshipShipment`
  records a supplier's parcel on the customer's order through the same
  `createFulfillment` every other way out uses (so the order moves on and
  `order.fulfilled` sends the shipping email), for that supplier's lines only;
  `dropshipFulfillmentLines`, `carrierOf` (UPS / FedEx / … by name, anything else in
  the person's words) and `nextDropshipStatus` (placed from waiting or failed;
  shipped from anything not yet shipped). `dropship-shipment.test.ts`, 8 tests.
- `PATCH /v1/dropship/orders/:id` (`routes/v1/dropship/orders.ts`): the owner records
  `placed` (with the supplier's order number) or `shipped` (carrier, tracking number,
  tracking link); publishes `dropship.order.submitted` / `dropship.order.shipped`.
- `lib/dropship-tracking.ts`: when a supplier's own tracking says shipped, the
  customer's order is recorded too (it was only written on the supplier order).
- `packages/dropship/src/adapters/csv.ts`: a CSV supplier's order waits ("Send this
  order to the supplier yourself, then record it here as placed.") instead of
  failing; the worker keeps `pending` rather than calling it submitted (Printify's
  "created but not in production" was being shown as sent, too). Five old lint
  errors in that file fixed on the way.
- Both consoles, Dropshipping › a supplier order: "Record what happened", with "I
  placed it with {supplier}" and "It shipped" (carrier, tracking number, tracking
  link).

Lint clean on every changed file; api-rest lib tests 390 pass. Typecheck not run
(Brandon: leave it for now).

## Confirmed by

P01 on screen, 2026-10-11, with S&B Filters (issue 171):

- Supplier order for O-000023 › Record what happened: carrier R+L Carriers, tracking 41187735,
  It shipped. The supplier order read Shipped; the customer's order became fulfilled with a
  shipment (carrier kept as typed); Renée's page read "On its way · Tracking 41187735"; the
  shipping confirmation went to her three minutes later.
- O-000026 the same way with Salt Lake Courier: her real email reads "Your order O-000026 has
  shipped · Carrier: Salt Lake Courier · Tracking number: SLC-552190".
- Found on the way: the panel said "For an order you send to S&B Filters yourself" over an
  order sparx had emailed; it now says what is true of the order's state. The supplier's lines
  show the product's name above the code. The toast promised "Your customer has been sent the
  tracking" minutes before the email went; it says "We are emailing your customer the
  tracking".

The "I placed it with" half, on screen 2026-10-19. Doty connected Bluffdale Bolt Co. as a CSV
feed (served on this machine; the feed guard of [363] allows only loopback outside production),
imported its Exhaust Manifold Bolt Kit and put it on sale at $34.95. Renée bought one on account
(O-000041). Supplier orders read "Waiting to be sent"; the order, "Send this order to the
supplier yourself, then record it here as placed." Doty typed their order number BB-88213 and
pressed "I placed it with Bluffdale Bolt Co." ("Sent to supplier"), then UPS and
1Z999AA10123456787 and "It shipped": "Recorded as shipped. We are emailing your customer the
tracking." O-000041 read fulfilled, and Renée got "Your order O-000041 has shipped" with that
tracking number and the bolt kit. Found on the way: [363], [364].

## Rating effect

—
