# 357 — A packed box could never be sent, and the form under it sent the rest

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · checking issue 184, as Doty on O-000008
**Surface:** workbench › Selling › Orders › an order › Deliveries, in both consoles; `PATCH /v1/orders/:id/fulfillments/:id`
**Filed:** 2026-10-19
**Fixed:** 2026-10-19
**Confirmed by:** P01 on screen as Doty and in the dev outbox, 2026-10-19
**Blocked on:** —

## What happened

Doty packed 2 of Wasatch's 6 injectors and both O-rings at the bench and sealed the box. The
order showed it as "Delivery · Being packed" with one control, "Add a tracking number". Nothing
could send it. Under it was the order's own form, "Who took it · Tracking number · Mark it as
sent". He filled it in to send the box. It made a second delivery, USPS, of the other 4
injectors: the ones nobody could find on the shelf. The order read "On the way" for all 6, and
Renée got "Your order O-000008 has shipped" listing 6 injectors. The box stayed "Being packed".

## What should have happened

A packed box has its own "Who took it" and "Mark this box as sent". The order's form says what
it sends before it is pressed, and says it is not the box.

## How to reproduce

1. Pack part of an order at the bench and seal it.
2. Open the order. The box cannot be sent; the form under it sends everything else.

## Why it matters

Parts nobody found are recorded as shipped, the customer is told they are coming, and the box
that is packed never leaves on the record.

## Where it lives

The bench seals a box as a `pending` delivery with no carrier. `UpdateFulfillmentInput` had no
carrier, `updateFulfillment` announced nothing on `pending` → `shipped`, and neither console
offered it. `RecordHandover` sent "all of it" without naming it, though its own note promised
"Mark it as sent never claims more than it sends".

## The fix

- Server: `UpdateFulfillmentInput` takes `carrier`, `carrierOther` and `service`;
  `updateFulfillment` writes them and, when a box leaves (`leftTheBuilding`: `pending` to
  `shipped` or `delivered`), publishes `order.fulfilled`, so the customer is told then.
- Both consoles: `SendPackedBox` on a waiting box (`boxIsWaiting`): "Packed and waiting. Say who
  took it to send it.", "Who took it", tracking, and "Mark this box as sent".
- Both consoles' handover form says what it sends (`handoverSends`): "This sends 1 × Stanadyne
  Diesel Fuel Additive…", and with a box waiting, "A box is packed and waiting above; send it
  from there. This sends what is not in it: …".

Tests, red first: `fulfillment-transitions.test.ts` (crm, 2) and `packed-box.test.ts` in both
consoles. crm 602 and both consoles' commerce tests pass; crm, commerce, inventory and api-rest
`tsc` clean. Lint and format clean.

## Confirmed by

P01 as Doty, 2026-10-19. O-000008's box read "Packed and waiting. Say who took it to send it.";
with UPS and 1Z999AA10123456785, "Mark this box as sent" made it "UPS · Sent Oct 19 · On the way",
and Renée got "Your order O-000008 has shipped" with that tracking number. O-000024's form read
"This sends 1 × Stanadyne Diesel Fuel Additive…" before it was sent. O-000018's box was sealed
and sent the same way. Piggles not seen on screen; its tests pass.

Left as it happened: O-000008's USPS delivery of the 4 injectors nobody found, made by the old
form during this check. There is no screen to undo a delivery, and the run does not edit rows
by hand.

## Rating effect

—
