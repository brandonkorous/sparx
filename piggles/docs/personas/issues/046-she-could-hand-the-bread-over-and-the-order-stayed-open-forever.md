# 046 — She could hand the bread over and the order stayed open forever

**Status:** fixed
**Severity:** **blocker** (no business without a warehouse could ever finish an order)
**Found by:** P01 · Thistle & Rye · act 9 — Rowan collects the bread
**Surface:** mypiggles › Sell › the order pane, "Deliveries"
**Filed:** 2026-08-21 · **Fixed:** 2026-08-21
**Confirmed by:** P01 · act 9 — **O-000001** flipped to Collected

## What happened

Rowan came in, took two sourdough and a box of cardamom buns, and paid cash.
Marisol went to write that down. The order pane says:

> **Deliveries** — Nothing has been sent for this order yet.

And offers no way to say otherwise. The pane's only fulfilment-shaped action was
**Send to the warehouse**, which builds a picking walk — a printed route through
a warehouse she does not have, for an order the customer had already carried out
of the shop. The order stayed **To send** for ever.

## Why it matters

Same shape as [044](044-she-could-take-the-money-and-had-no-way-to-write-it-down.md),
one step further along, and with a wider blast radius: 044 stopped a
manual-payments business finishing an order, this stopped **every** business
without a warehouse finishing one — a bakery with a counter, a studio that posts
from the desk, anyone whose fulfilment is a person handing something to another
person.

Downstream, an order that never leaves `placed` means the Sell screens count
open work that is done, "On the way" and "Delivered" are permanently empty
filters, and `order.fulfilled` / `order.delivered` are never published — so the
activity feed, the customer's own order history and the denormalised customer
stats never hear that the sale completed.

## Why it happened

`POST /v1/orders/:id/fulfillments` has always existed. The pane READ the list —
the card enumerates every shipment and reports the empty case — and **nothing in
either console ever called the write.** Precisely the 044 pattern.

And because nothing called it, the endpoint's "created already finished" path had
never once run. Three defects were sitting in it, invisible:

1. **`delivered` stamped neither clock.** The only writer that had ever existed
   was a shipping integration, which always starts at `shipped` and moves to
   `delivered` later — so `deliveredAt` was only ever set on the UPDATE path. A
   handover would have landed as a delivered fulfillment with no delivered time,
   and the pane would have read back "Created 1:59 AM" for something that was
   handed over — a time nobody recorded, presented as the time it happened.
2. **`delivered` announced nothing.** The create path published `order.fulfilled`
   only for `shipped`, and `order.delivered` only from the update path's
   shipped→delivered transition. A handover makes neither move, so a counter
   business's completed sales would have been silent to every consumer.
3. **The parent order jumped `placed → delivered` leaving `fulfilledAt` null** —
   goods delivered that were never made ready, which reports read as a gap.

## The fix

**`useRecordFulfillment`** in both consoles' order data layer, and a
**`RecordHandover`** control on the card — which now knows which of two things
this order is, because `deliveryPlan(order)` reads the fulfilment method
checkout froze onto it.

**Collected** — one button and an optional note:

> **Anything to note (optional)** `Who picked it up…` · **They collected it**

There is no carrier, no tracking number and nothing to follow, so it asks for
none of it. Records `status: delivered`, `carrier: pickup` — the API's own
existing word, so no vocabulary is invented.

**Posted** — three fields, one of them required:

> **Who took it** `USPS` · **Tracking number (optional)** · **Anything to note
> (optional)** · **Mark it as sent**

Records `status: shipped`, so it is in transit and the tracking number is the
point of the record.

Server-side, all three latent defects are fixed, and the clock logic came out as
a pure `fulfillmentClocks(status, shippedAt, now)` with **6 tests** — the file
had none.

## The wording follows the shopper's own choice

An order nobody is delivering does not have a "Where it goes", and a
**Delivery address** heading over the address a collecting customer typed for
their receipt is how a shop ends up posting something to somebody who was going
to walk in for it. So, driven off the same `deliveryPlan`:

|              | posted                                    | collected                              |
| ------------ | ----------------------------------------- | -------------------------------------- |
| card         | **Deliveries**                            | **Collection**                         |
| empty        | Nothing has been sent for this order yet. | This order has not been collected yet. |
| after        | —                                         | They picked this up.                   |
| address card | **Where it goes** · Delivery + Billing    | **How it leaves** · Their address      |
| row          | `USPS · Priority`                         | `Collect in person`                    |
| row time     | Sent …                                    | Collected …                            |
| badge        | Delivered                                 | **Collected**                          |
| order chip   | To send / Delivered                       | **To collect / Collected**             |

The last row is `shippingState()`, which the orders LIST reads too — so one
change corrected the list's Delivery column as well, rather than the one call
site that happened to notice.

**Send to the warehouse is withheld on a collection order.** It was gated only on
"is anything unfulfilled", which is true of every collection order ever placed.

## Two smaller things it exposed, both fixed

- **The note went into a drawer that does not open.** The control asks "Anything
  to note" and the shipment row never rendered `notes`. Now it does — "Rowan came
  in just after 8" sits on the row.
- **"Mark it off when they do" survived them doing it.** The card's instruction
  is now past tense once nothing is left to hand over. An instruction to do
  something already done reads as the screen not having noticed.

## Confirmed

Marked O-000001 collected with a note. The order chip went **To send →
Collected**, the card reads **Collected in person / Rowan came in just after 8 /
Collected Aug 21, 2026, 1:59 AM** with a **Collected** badge, its description
moved to "They picked this up.", the form withdrew, and the orders list's
Delivery column reads **Collected**.

## Ported to sparx

The sparx console had the identical gap — and, from 044, an unused
`useRecordOrderPayment` its pane never called. Both controls are now on both
panes, along with the `footer` slot on `SubSection` that 044 added to piggles
only.
