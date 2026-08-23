# 135 — A booking calls its customer "A customer"

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · act 10
**Surface:** mypiggles › Bookings — the list and the diary
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** see below

## What happened

Margot's Friday cut in the bookings list: **"Appointment · Margot Lindqvist"**.
Margot's missed Thursday, two rows down: **"Appointment · A customer"**.

Same person, same record, two rows apart. The difference is that one booking had
an attendee row with a name typed into it and the other did not — and
`bookingWhoLabel`'s last rung was:

```ts
return booking.customerId ? 'A customer' : 'No one assigned';
```

The id is right there. The name was never fetched.

The diary was worse: a block showed the service and the CHAIR — "3:00 PM / Cut
and finish / **Nia Okafor**" — and in Day view the chair is the column heading
directly above it. Every block in a two-chair shop repeated the words above it
and never once named the client, which is the one thing on a block that is not
somewhere else on the screen already.

## Why it was not just a missing `include`

`Booking.customerId` is a bare column with **no Prisma relation on it**,
deliberately: the schema's note beside it says a booking is the record of an
appointment a real person made and outlives the site and the account. So the name
cannot be joined. It has to be fetched — and nothing was fetching it.

## Where it lives

- [packages/scheduling/src/booking-queries.ts](../../../../wizeworks/packages/scheduling/src/booking-queries.ts) — `customersFor`, `whoFor`
- [services/api-rest/.../scheduling/bookings.ts](../../../../wizeworks/services/api-rest/src/routes/v1/scheduling/bookings.ts) — `bookingView`
- [surfaces/scheduling/bookings-data.ts](../../../apps/workbench/surfaces/scheduling/bookings-data.ts) — `bookingWhoLabel`
- [surfaces/scheduling/calendar-event-block.tsx](../../../apps/workbench/surfaces/scheduling/calendar-event-block.tsx) (new)

## The fix

**One extra read per page**, keyed by id, stitched onto the rows: `getBooking`,
`listBookings` and `getCalendar` all carry the customer now. `bookingWhoLabel`'s
ladder runs from the most specific thing anyone wrote down to the least — a name
typed on the booking, then the linked customer's own name, then a count, then the
honest admission that nobody was recorded.

**The diary block leads with the person.** `getCalendar` resolves the name
server-side (the fallback ladder is a fact about the data, not about any one
grid) and the block's third line is who is coming. The chair stays as the
fallback for a block with nobody recorded, where it is at least new information.

The event block moved into its own file on the way past, which took
calendar-timegrid.tsx back under the 250-line rule.

## Confirmed by

> Re-ran act 10 as Nia. The Aug 20 no-show reads "Appointment · **Margot
> Lindqvist**". The 3 PM block in the diary reads "3:00 PM · Cut and finish ·
> **Yusuf Karadeniz**" where it used to say Nia Okafor, which is the name of the
> column it sits in.
