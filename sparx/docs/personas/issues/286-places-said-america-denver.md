# 286 — Places said "America/Denver", and its forms offered eleven zone codes and no Arizona

**Status:** fixed
**Severity:** copy
**Found by:** P01 · Gillett Diesel Service · rating Scheduling › Places
**Surface:** Scheduling › Places (list), a place's form, a person or equipment's form (sparx)
**Filed:** 2026-10-14
**Fixed:** 2026-10-14
**Confirmed by:** sparx as Doty, 2026-10-14
**Blocked on:** —

## What happened

- Places listed Gillett's shop as "America/Denver, from your business".
- The place form's time zone picker said "Same as your business (America/Denver)" and
  listed eleven raw zone names. The person or equipment form listed the same eleven.
  Neither had Phoenix, the one US zone with no daylight time.
- Response times, Chat and Business details already used a searchable city picker, and
  the Piggles places list already said the city.

## What should have happened

"Mountain time, from your business"; a picker of cities, searchable, with every zone.

## How to reproduce

1. Sign in as Doty. Scheduling › Places, then open the place.

Every time.

## Why it matters

A zone is something the owner says ("Mountain time"); a code is something the computer
reads. And an Arizona business could not pick its own zone.

## Where it lives

`surfaces/scheduling/locations-list.tsx`, `location-detail.tsx`, `resource-detail.tsx`,
and `setup-data.ts` (`followBusinessLabel`, `TIMEZONE_OPTIONS`).

## The fix

- `components/timezone-select.tsx` (new): one zone picker for forms, built on the house
  city list (`timezoneOptions`), with an optional "follow the business" choice.
- The place and resource forms use it; both eleven-name lists are deleted.
- Places and `followBusinessLabel` say the zone with `zoneWords` ("Mountain time").
- Piggles has none of these lists and already says the city.

Tests: `surfaces/scheduling/zone-said-in-words.test.ts` (4, red, then green) and
`place-zone-label.test.ts` (its expectation moved to "Mountain time", red, then green);
scheduling 104/104. Scoped type check and lint clean.

## Confirmed by

sparx as Doty: Places reads "Mountain time, from your business"; the place form's picker
reads "Same as your business (Mountain time)".

## Rating effect

scheduling.locations.list and its forms: zones in her words.
