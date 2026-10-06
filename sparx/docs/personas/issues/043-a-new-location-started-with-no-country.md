# 043 — A new location started with no country

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 2
**Surface:** workbench › Inventory › New location; Scheduling › Add a place (both consoles)
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran P01 act 2: "New location" opens with Country "United States"; closing it untouched asks nothing
**Blocked on:** —

## What happened

Doty added his Main Office as a stock location. The Country field opened on "No
country", and the save was refused: "A street address, a town or city and a
country are needed". Business details already said US, and the location made at
sign-up was US. He had to scroll an A-to-Z list of 250 countries to find his own.

## The fix

- New `lib/business-country.ts` (both consoles): the Business details country,
  shared cache key with Business details.
- New stock locations and new scheduling places open with it in the field, shown
  before anything is saved, so the owner sees it and can change it. Suppliers and
  order addresses stay empty: those can be anywhere.
- The stock-location form compared "has anything changed?" against an EMPTY form,
  so the pre-filled country counted as typing: the leave-guard fired on an
  untouched form and the "address needs more" note showed at once. It now compares
  against the starting values (`location-detail.tsx` in sparx,
  `location-validity.ts` in Piggles). Scheduling places already did.

Checks: both workbenches tsc 0, eslint 0, parity green.

## Rating effect

—
