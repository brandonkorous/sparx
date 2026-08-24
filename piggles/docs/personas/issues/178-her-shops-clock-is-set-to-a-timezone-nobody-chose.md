# 178 — Her shop's clock is set to a timezone nobody chose

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 4 (while confirming [108](108-every-booking-made-from-her-website-lands-in-her-diary-seven-hours-late.md))
**Surface:** mypiggles › Scheduling › Places — against Settings › Business details
**Filed:** 2026-08-24
**Fixed:** 2026-08-24
**Confirmed by:** re-run as Devi end to end — see below

## What happened

Devi has never opened the Scheduling section. Her shop sells clothes.

**Settings → Business details → Time zone** tells her the truth about that, and
tells it well:

> **Time zone**
> The clock your business runs on. Working hours, bookings and the dates on
> documents you send are all read in it.
>
> Nothing set, so times are being read as Los Angeles — Pacific Daylight Time
> (GMT-07:00) — whatever clock the computer you are on is set to. Choose it here
> and it stops depending on the device.

Nothing set. Said plainly, with the consequence spelled out and the remedy in the
same breath. This is the screen behaving correctly.

**Scheduling → Places**, in the same console, for the same shop, says something
else entirely:

| Name          | Filed here             | Time zone | State  |
| ------------- | ---------------------- | --------- | ------ |
| Main location | Nothing filed here yet | **UTC**   | In use |

And opening it:

> **Time zone** `UTC`
> The zone this place is in. Each person's working hours are read in their own
> zone, so this is what a customer is shown.

A closed picker sitting on a value, with a sentence asserting that value is where
the place _is_. Devi has never seen this screen before. She did not choose UTC.
Nobody did — it is the column default, printed as though it were an answer.

Note the two screens do not merely differ in confidence. They disagree on the
fact: one says her times are read as Los Angeles, the other says her only place
is in UTC, seven hours apart.

## Why it matters now specifically

Because [108](108-every-booking-made-from-her-website-lands-in-her-diary-seven-hours-late.md)
just gave this value teeth.

Before that fix, a booking's timezone came from nowhere in particular. After it,
a booking follows its place — which is right, and which is exactly why the
place's answer now has to be one somebody gave. The fix moved the decision to a
field, and the field is holding a default.

Every tenant on this database except Nia's is sitting on it:

```
 Bella Salon | UTC        Juniper Row  | UTC       Sable Thyme   | UTC
 Everson Apparel | UTC    Lumen Studio | UTC       Threadline    | UTC
 Forge Fitness Studio | UTC  Harbor & Pine | UTC   Thistle & Rye | UTC (×2)
 …17 of 18 tenants
```

Halo & Hem reads `America/Los_Angeles` because that one was set by hand while
fixing 108. It is the exception that shows the rest are untouched, not chosen.

So the shape of 081 and 108 is still here, one layer up: a person types
"nine o'clock", something stores it against a clock nobody picked, and the
mistake surfaces later as an appointment at the wrong hour. Those two issues
fixed the readers. This is the writer.

## What should have happened

The place should be able to say it has no answer, and defer to the business —
which is what a single-premises shop means anyway. The business time zone screen
already models this correctly; the place should match it rather than contradict
it.

`tenant_businesses.timezone` is `String?` **precisely so it can be absent**. The
platform already has the pattern. `business_locations.timezone` is
`String @default("UTC")`, so absence is not expressible there and every unset
place has to lie.

## How to reproduce

Every time, any tenant that has ever had Scheduling switched on.

1. Sign in, **Settings → Business details**, scroll to Time zone. Read
   "Nothing set…".
2. **Scheduling → Places**. Read `UTC` in the Time zone column.
3. Open the place. The picker shows `UTC` as a chosen value.

Or from the database:

```sql
select t.name, l.name, l.timezone
  from scheduling_locations l join tenants t on t.id = l.tenant_id;
```

## Where it lives

The write, not the render. Both screens print the field honestly given what is
in it.

- [wizeworks/packages/scheduling/src/provisioning.ts:36](../../../../wizeworks/packages/scheduling/src/provisioning.ts#L36)
  — module activation seeds the place with `timezone: 'UTC'`, hardcoded. This is
  the row every tenant above is showing.
- [wizeworks/packages/db/prisma/schema/78-scheduling.prisma:523](../../../../wizeworks/packages/db/prisma/schema/78-scheduling.prisma#L523)
  — `timezone String @default("UTC")`, not nullable, so "nobody said" has nowhere
  to live.

Worth naming: the console's own **create a place** path is already right.
[location-detail.tsx:134](../../../apps/workbench/surfaces/scheduling/location-detail.tsx#L134)
reads `useBusinessTimezone()` and holds the form until it resolves rather than
stamping a placeholder. And the helper it uses says outright why it exists:

> One reader rather than a default per form: three scheduling forms already
> wanted this, and each had written `'UTC'` by hand.

Three were found and fixed. `provisioning.ts` is the fourth, on the server side,
and it is the one that runs for everybody before they ever open a form.

## The fix

**A place can now say it has no clock of its own.**

`scheduling_locations.timezone` becomes `String?`, matching
`tenant_businesses.timezone`, which is nullable for exactly this reason. NULL
means "follow the business" — which is what a single-premises shop means by
never touching it, and which stays true if the business zone later changes.

Four layers, because the value crosses all four:

1. **The writer.**
   [provisioning.ts](../../../../wizeworks/packages/scheduling/src/provisioning.ts)
   no longer passes a timezone at all. Activation happens before anybody has
   said where they work, so it has nothing honest to write.
2. **The rows already written.**
   [20270407000000_a_place_can_say_its_clock_is_the_businesss](../../../../wizeworks/packages/db/prisma/migrations/20270407000000_a_place_can_say_its_clock_is_the_businesss/migration.sql)
   drops the NOT NULL and the default, then clears only the places that were
   provably never chosen. See the guard below — it is the interesting part.
3. **The reader.** `findBookingPlaceTx` and `findServicePlaces` in
   [booking-receipt.ts](../../../../wizeworks/packages/scheduling/src/booking-receipt.ts)
   resolve `place.timezone ?? business.timezone ?? 'UTC'` and hand every
   downstream surface a plain string. Resolving at the boundary is deliberate:
   `booking-service.ts`'s `input.timezone ?? place?.timezone ?? 'UTC'` is
   unchanged, and no consumer has to invent a fallback of its own — inventing
   one four separate times is how this happened.
4. **The two screens.** The list column and the picker now distinguish the three
   states instead of printing whatever string was in the column.

### The migration's guard, which is the part worth reading

`timezone = 'UTC'` alone is NOT evidence that nobody chose it: a business
genuinely running on UTC looks identical. So the guard is the full fingerprint of
the seeder's own write — its exact name, its exact value, no site links, and
`updated_at = created_at`. Prisma's `@updatedAt` stamps both on create, so that
equality holds until the first save and never again.

It behaved exactly as intended across 19 places on this database:

| Place                                 | Before                | After                  | Why                                                        |
| ------------------------------------- | --------------------- | ---------------------- | ---------------------------------------------------------- |
| 17 × untouched seeded `Main location` | `UTC`                 | NULL, follows business | never opened, never saved                                  |
| Halo & Hem                            | `America/Los_Angeles` | unchanged              | set by hand while fixing 108                               |
| Thistle & Rye's `Kettle & Crumb`      | `UTC`                 | **unchanged**          | a place somebody created and named, so its value is theirs |

That third row is the one that matters. It still says UTC, and it still should:
the guard cannot prove nobody chose it, so it did not touch it.

It also loops tenants and sets `app.tenant_id` per tenant, for the reason 108's
backfill does: `scheduling_locations` is FORCE RLS and `sparx_owner` is a
non-superuser in production, so an un-scoped pass updates zero rows there while
passing locally as superuser.

## Confirmed by

> Re-run as Devi on 2026-08-24, all three states, plus the round trip.
>
> **Nothing set anywhere.** Scheduling → Places read `Not set` in warning color
> rather than `UTC`. Opening it, the picker read **"Same as your business (not
> set yet)"** with:
>
> > Your business has no time zone set either, so times here are being read as
> > Los Angeles: whatever clock the computer you are on is set to. Set it once in
> > Settings › Business details and this place follows it.
>
> Which is the remedy, on the screen that has it, named — the thing the old
> field could not say because it was busy asserting UTC.
>
> **Set it once.** Settings → Business details → Time zone → Denver → Save.
> Deliberately NOT the device's zone, so "the place followed" could not be
> confused with "the place guessed".
>
> **The place followed, with no second edit.** Places immediately read:
>
> ```
> Main location | Nothing filed here yet | Denver             | In use
>                                        | from your business |
> ```
>
> and the picker read **"Same as your business (Denver)"**, warning gone. The two
> share the `['tenant','business']` query key, so it updated without a refetch.
> The row is still NULL in the database — followed, not copied:
>
> ```
>     name      |         place_tz          |  business_tz
> --------------+---------------------------+----------------
> Main location | (null - follows business) | America/Denver
> ```
>
> **The override, and clearing it again.** Set the place to New York and saved:
> the column stored `America/New_York` and the list dropped the "from your
> business" line. Set it back to "Same as your business (Denver)" and saved: the
> column is NULL again. That round trip is the half a nullable field usually gets
> wrong — a `?? undefined` anywhere in the update path would have silently kept
> New York — so it was checked rather than assumed.

## Rating effect

Counted against `Scheduling › Places` in [rating.md](../rating.md).
