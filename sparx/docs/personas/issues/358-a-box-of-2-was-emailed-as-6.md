# 358 — A box of 2 was emailed as "Shipped: 6 injectors"

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · checking issue 357, in the dev outbox
**Surface:** the "Shipping confirmation" email; the email dispatch tick (`api-rest/src/lib/email-dispatch.ts`)
**Filed:** 2026-10-19
**Fixed:** 2026-10-19
**Confirmed by:** P01 in the dev outbox, 2026-10-19
**Blocked on:** —

## What happened

O-000008 went in two parcels. Each "Your order O-000008 has shipped" email listed the whole
order under its tracking number: 6 injectors, 6 core deposits and 2 O-rings.

## What should have happened

Each email lists what is in its parcel.

## How to reproduce

1. Send part of an order, then the rest.
2. Each shipping email lists every line of the order.

## Why it matters

The customer counts what arrives against the email and thinks parts are missing, or waits for a
second box that is the one they already have.

## Where it lives

- The template drew `order.items`, every line ordered.
- The dispatch tick rebuilt the email's references from the send and dropped `fulfillmentId`,
  `bookingId` and `waitlistEntryId`. So the shipping data read the order's newest parcel, not
  the one the email was for, and booking emails had no live booking.

## The fix

- `recipientRef` (`email-recipient-ref.ts`) reads back every reference the automation queues.
- The shipping source gives `items`: the parcel's own lines at the parcel's quantity, with their
  core deposits (`parcelItemRows`, `email-parcel-items.ts`). The template lists
  `shipping.items`. The money formatters moved to `email-format.ts` so this is testable. The
  outgoing body is on the refresh list.

Tests, red first: `email-recipient-ref.test.ts` (3) and `email-parcel-items.test.ts` (3).
builder 206 and builder-schemas 383 pass; api-rest `tsc` clean. Lint and format clean.

## Confirmed by

P01, 2026-10-19, after the email reconcile ran for Gillett (one email refreshed): O-000024's
second parcel emailed "Item Qty Amount · Stanadyne Diesel Fuel Additive… 1 $12.50", its one
line, where the order has two.

## Rating effect

—
