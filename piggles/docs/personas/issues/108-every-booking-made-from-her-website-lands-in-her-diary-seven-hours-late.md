# 108 — Every booking made from her website lands in her diary seven hours late

**Status:** fixed
**Severity:** blocker
**Found by:** P02 · Halo & Hem · act 6
**Surface:** mypiggles › Bookings — and the confirmation email, and the reminder
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** —

## What happened

Margot booked a cut for **Thursday 2:00 PM**. The site said 2:00 PM, the slot she
clicked said 2:00 PM, the confirmation said 2:00 PM.

Nia's own diary — Bookings, in the console — says this:

| Nia's diary shows                                              | The customer booked | The salon is |
| -------------------------------------------------------------- | ------------------- | ------------ |
| Aug 27, **10:00 PM** — Cut and finish                          | 3:00 PM             | shut at 6    |
| Aug 27, **9:00 PM** — Cut and finish · Margot Lindqvist        | 2:00 PM             | shut at 6    |
| Aug 27, **8:15 PM** — Cut and finish                           | 1:15 PM             | shut at 6    |
| Aug 28, **5:30 PM** — Barbering, skin fade · Rob Alvarez       | 10:30 AM            | open         |
| Aug 28, **4:00 PM** — Full head highlights · Priyanka Deshmukh | 9:00 AM             | open         |

Every appointment is exactly **seven hours late** — the offset between Sacramento
and UTC — and three of them sit hours after she has locked up.

## Why this is a blocker

**Her diary is the product.** This is the screen she opens in the morning to find
out what her day is. It is telling her she has nobody until the afternoon and
three clients arriving between 8:15 PM and 10:00 PM. Not one of those five rows
names a time anyone agreed to.

And the same stored value feeds the copy that goes OUT:

- the **confirmation email**'s "When" row,
- the **reminder** email and SMS the day before,
- the **rescheduled** and **cancelled** notices.

So a customer who books 2:00 PM is emailed "Thu, Aug 27 at 9:00 PM", and reminded
of it again the day before. There is no surface on which the right time appears
twice.

It is silent by construction ([[feedback_never_present_absence_as_measurement]]):
`UTC` is not a blank a person would notice, it is a real zone that formats
cleanly, so a wrong time renders exactly like a right one.

## How to reproduce

Every time, on every booking made from a published site.

1. Book anything from the public booking page.
2. Open mypiggles › Bookings.
3. The time is out by the salon's offset from UTC.

Bookings taken in the console are correct, which is why this survived setup: the
console sends the zone it is sitting in, and the website sends nothing.

## Where it lives

[wizeworks/packages/scheduling/src/booking-service.ts](../../../../wizeworks/packages/scheduling/src/booking-service.ts),
one line of `createBooking`:

```ts
timezone: input.timezone ?? 'UTC',
```

`timezone` is documented in the console's own data layer as "the zone the booking
was made in and is what its times should be [read in]" — everything downstream
honours that faithfully. Nothing supplies it. The public route
([routes/v1/public/scheduling.ts](../../../../wizeworks/services/api-rest/src/routes/v1/public/scheduling.ts))
never sends one, because a browser has no business telling a salon what zone the
salon is in — so every website booking took the fallback.

The fallback is the whole defect. `'UTC'` was chosen as a value that always
parses, not as an answer to the question being asked.

## The fix

**An appointment happens where the business is, so the place decides the zone.**

`BusinessLocation.timezone` already exists and already carries this exact meaning
in its own schema comment: "The zone the PLACE is in … this is the fallback and
what a customer is shown." Nothing had ever read it on this path.

```ts
const place = await findBookingPlaceTx(tx, { locationId, serviceId: service.id });
// …
timezone: input.timezone ?? place?.timezone ?? 'UTC',
```

`findBookingPlaceTx`
([booking-receipt.ts](../../../../wizeworks/packages/scheduling/src/booking-receipt.ts))
resolves the booking's own location, then the one its service is filed under,
then — when the business has exactly ONE active place — that one. The last step
is what makes it work for a real small business: a two-chair salon never picks a
location anywhere, because there is only one, so `location_id` is null on every
row she owns. With two or more places and none chosen it returns null and the
booking keeps `UTC`, because sending somebody to the wrong branch's clock is
worse than the honest fallback.

An explicit `input.timezone` still wins — a caller who genuinely knows the zone
(the console, an integration) is making an assertion, not taking a default.

## The rows already written

A fix from here forward would have left Nia's five existing appointments wrong on
a screen she cannot correct, so
[20270404000000_bookings_read_in_the_zone_of_the_place](../../../../wizeworks/packages/db/prisma/migrations/20270404000000_bookings_read_in_the_zone_of_the_place/migration.sql)
repairs them, by the same rule the engine now follows. It touches only rows still
sitting on `'UTC'`, and only where the place says something else, so a business
genuinely running on UTC is left alone.

It **loops tenants and sets `app.tenant_id` per tenant**: `bookings` and
`scheduling_locations` are both FORCE RLS and `sparx_owner` is a non-superuser in
production, so an un-scoped pass updates zero rows there while passing locally as
superuser — a backfill that silently does nothing, which is the failure mode this
run keeps finding ([[feedback_structural_checks_go_blind]]).

## What it does not cover

The booking page still draws its times in the VISITOR's timezone rather than the
salon's, so a customer booking from another state reads the whole grid shifted.
That is a different failure with a different fix, filed as
[109](109-the-booking-page-shows-its-times-in-the-visitors-timezone-not-the-salons.md).

## Rating effect

`Bookings › list` is re-scored in [rating.md](../rating.md).
