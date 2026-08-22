# 097 — Her Bookings said two places were in use by people she had deleted

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · act 5
**Surface:** mypiggles › Bookings › Places
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** P02 · Nia · on screen 2026-08-22

## What happened

Nia opened Bookings › Places to tidy up, and read this:

| Name          | Filed here                     | State  |
| ------------- | ------------------------------ | ------ |
| Main location | 1 person or thing · 4 services | In use |
| Maison Élan   | 3 people & things · 7 services | In use |

Four people and eleven services, filed across two places. She has **two** people
and **ten** services, and not one of them is filed at either place.

Every number on that screen counted records she had **deleted** — the starter
site's demo stylists (Ava Bennett, Maya Cole, Noor Rahim and a resource literally
called "Stylist") and its demo menu (Balayage, Bridal styling, Manicure, Men's
cut and the rest), all removed by her in act 4.

Read back from the database, for the place claiming three people and seven
services:

```
resources   0 live   3 deleted
services    0 live   7 deleted
```

## The part that would have stopped her

She pressed **Remove** on the place named after somebody else's salon, and the
confirmation said:

> **Remove Maison Élan?**
> **10 of your people, things and services are filed here.** They are kept, but
> they stop being tied to a place until you re-file them. This cannot be undone.

Ten of _her_ people and services, about to be untied from a place, permanently.
None of that is true — all ten are rows she deleted — but she has no way to know
that, and the sentence is written to make her stop. The likely outcome is
**Keep it**, and another business's name stays in her Bookings for good.

This is the shape that costs most ([[feedback_one_outcome_two_causes]]): a warning
that is confidently wrong steers the owner away from the correct action.

## Why it matters

Three separate harms from one bad count:

1. **The delete she should make, she does not make**, because the confirmation
   frightens her off it.
2. **"In use" is a lie about her business.** A place she never uses reads as one
   she serves from.
3. **A soft delete stops meaning anything.** She removed those services precisely
   so they would stop appearing; they carried on being counted somewhere she
   could see.

## How to reproduce

Every time, on any business that has deleted a service or a person.

1. Bookings › Services or People, delete one that has a place on it.
2. Bookings › **Places**. Read the "Filed here" column.
3. Open the place and press **Remove**.

## Where it lives

[wizeworks/packages/scheduling/src/locations.ts](../../../../wizeworks/packages/scheduling/src/locations.ts):

```ts
const INCLUDE = {
  siteLinks: { select: { propertyId: true } },
  _count: { select: { resources: true, services: true, bookings: true } },
};
```

An unfiltered `_count`. `SchedulingResource` and `SchedulingService` both carry
`deletedAt` and both soft-delete, so every list, every detail header and the
delete confirmation were counting rows that are gone everywhere else in the
console. One `INCLUDE`, read by all three screens, which is why all three agreed
with each other and disagreed with the truth.

## The fix

Filtered counts, in the one place they are declared:

```ts
_count: {
  select: {
    resources: { where: { deletedAt: null } },
    services: { where: { deletedAt: null } },
    bookings: true,
  },
},
```

`bookings` stays unfiltered on purpose — a `Booking` has no `deletedAt`; it has a
status, and a cancelled booking is still history filed at that place. That is the
one of the three that was always right.

## Confirmed by

Re-run as Nia on 2026-08-22:

- Places now reads **Nothing filed here yet** for both, and the detail header
  reads `0 people & things · 0 services · 0 bookings`.
- The delete confirmation now reads, correctly: **"This takes the place off your
  list. This cannot be undone."**
- Removed **Maison Élan** ([098](098-a-place-in-her-bookings-was-called-maison-elan.md)),
  which is what she had been trying to do.

## Rating effect

`Bookings › Places` is scored in [rating.md](../rating.md).
