# 081 — Her salon opens at nine, and the diary showed appointments at three in the morning

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · act 3
**Surface:** mypiggles › Bookings › Calendar, People and equipment, Places
**Filed:** 2026-08-21
**Fixed:** 2026-08-21
**Confirmed by:** P02 · Nia · on screen 2026-08-21
**Blocked on:** — (fixed where an owner meets it; the installer's own default is scoped below)

## What happened

Nia added herself and Dara as people, set the salon's real week — Tuesday to
Saturday, 09:00 to 17:30 with a 13:00 lunch — saved it, and opened the diary.

Her week reads:

| Booking             | On screen   |
| ------------------- | ----------- |
| Women's Cut & Style | **2:00 AM** |
| Full Color          | **3:00 AM** |
| Men's Cut           | **6:00 AM** |
| Deep-Tissue Massage | **8:00 AM** |

A two-chair salon that has never opened before nine, showing a full head of
color at three in the morning.

Nothing warned her. The **Time zone** field on the new-person form said `UTC`
and she had no reason to touch it: it was already filled in, and the sentence
under it reads "The zone this works in — the hours you set are read in this
time." She works in her salon, so it looked answered.

## What should have happened

The hours she typed are the hours her clients see. She said nine o'clock; the
diary should say nine o'clock.

Piggles already knows how to do this. **The business has a real time zone
field** on Business details, backed by a proper city-first picker
(`lib/timezones.ts`, "Los Angeles — Pacific Daylight Time (GMT-07:00)"), written
precisely because "America/Denver is jargon and our users are not developers".
Bookings ignores all of it.

## How to reproduce

Every time, on a machine whose clock is not UTC (this one is `America/Los_Angeles`,
PDT, UTC-7).

1. Sign in as `p02.nia@piggles.test`, business **Halo & Hem**.
2. Bookings › Setting it up › People and equipment › **Add one**. Name
   `Nia Okafor`. Leave **Time zone** alone. Create.
3. Bookings › Setting it up › **Availability**, pick `Nia Okafor · A person`.
   Turn Tuesday on, set `09:00`–`13:00`, **Add another block**, `13:45`–`17:30`.
   Repeat Wednesday to Saturday. **Save hours**.
4. Bookings › **Calendar**, Week.

Every appointment sits seven hours earlier than the salon is open.

## Why it matters

**This is the business.** P02 exists to test a shop whose product is time, and
the first screen she looks at is wrong by seven hours. It reaches the customer
too: the public booking page resolves availability from the same zone, so the
slots offered to a client are the ones the salon is shut for.

It is also the worst shape of defect — it looks answered. A blank field gets
filled in; a field already reading `UTC` gets skipped, so the owner never learns
there was a question. [[feedback_absent_behaves_like_fine]].

## Where it lives

Three separate places, one cause: nothing asks what zone the business is in.

1. **[surfaces/scheduling/resource-detail.tsx](../../../apps/workbench/surfaces/scheduling/resource-detail.tsx)** —
   `BLANK.timezone = 'UTC'`, and a hand-written `TIMEZONES` array of eleven
   zones (no Phoenix, no Anchorage, no Dublin, nothing in Asia, Africa or South
   America) instead of the picker the app already ships.
2. **[surfaces/scheduling/location-detail.tsx](../../../apps/workbench/surfaces/scheduling/location-detail.tsx)** —
   the same `'UTC'` default for a place.
3. **The seed** — `marketplace-catalog/blueprints/*/scheduling.json` hardcodes
   `"timezone": "UTC"` on every location, and resources carry no zone at all so
   the installer defaults them. Verified on Nia's tenant: **all 10 seeded people
   and both locations are `UTC`.**

The diary itself is right — it renders in the reader's own clock, which is what
a person wants. It is the stored zone that is wrong.

## The fix

**The console half, fixed here.** A new person or place takes the zone the
business is in, and the picker offers every zone in words:

- New `lib/business-timezone.ts` — one reader for "the zone this business works
  in": the business's own `timezone` when it has one, otherwise the zone this
  computer is set to. One place, so a third scheduling form cannot get it wrong.
- `resource-detail.tsx` and `location-detail.tsx` default from it and render
  `timezoneOptions()` — the same city-first list Business details and CRM's SLA
  policies already use. The eleven-zone array is deleted.

**The seed half, NOT fixed — `Blocked on: scope`.** Correcting the zone the
installer stamps means `wizeworks/packages/db/src/sample-data/engine/scheduling.ts`
and `POST /internal/tenant/furnish`, both shared with sparx, plus a
`"timezone"` in 191 catalog bundles that would each need a version bump
([073](073-fixing-the-template-never-reached-the-bakery-that-already-used-it.md)).
That is larger than the surface under test. What it would take: thread the
tenant's zone through furnish and default the bundle field to it rather than to
the literal `UTC`.

**What this means for Nia today:** her own two people are right, and the sample
staff she never hired keep their 2 AM bookings until she deletes them.

## Confirmed by

Re-run as Nia on 2026-08-21.

**The new-person form now opens on her own clock.** Bookings › People and
equipment › Add one reads:

> **Time zone** — Los Angeles — Pacific Daylight Time (GMT-07:00)

City first, in words, exactly as Business details already offered it. The eleven
hand-written zones are gone; every zone the browser can format is in the list.

**Her two people were corrected through the same screen**, one at a time, and
re-read from the database:

| name       | timezone            |
| ---------- | ------------------- |
| Nia Okafor | America/Los_Angeles |
| Dara Bell  | America/Los_Angeles |

**What is still wrong, as scoped above:** the ten sample staff the install
created are still `UTC`, so the sample bookings attached to them still sit at
2 AM in her diary. Those are not her people and she will delete them. Correcting what the
installer stamps is the scoped follow-up recorded under **The fix** above, not a
second attempt at this one.

## Rating effect

`Bookings › People and equipment — Ease 5 → 8`, recorded in
[rating.md](../rating.md).
