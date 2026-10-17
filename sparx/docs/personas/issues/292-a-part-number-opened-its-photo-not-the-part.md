# 292 — A part number opened its photo, not the part

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · confirming [086] item 15 (finding the O-ring by its number)
**Surface:** workbench › Search everything, sparx console and Piggles (shared search package)
**Filed:** 2026-10-16
**Fixed:** 2026-10-16
**Confirmed by:** sparx as Doty, 2026-10-16
**Blocked on:** —

## What happened

Doty typed the O-ring's part number, 4062328, into "Search everything". The first row,
the one Enter opens, was under "Media": "4062328_1.png". The O-ring itself was second,
under "Products". Typing "injector" also put a photo,
"Aliant_Powerstroke_Injector_updated_1_we…", above every injector Gillett sells.

## What should have happened

The part number opens the part. A photo is found by its file name when that is what
was typed; when a record also matches, the record comes first.

## How to reproduce

1. Search everything › "4062328". The photo is first. Every time.

## Why it matters

Doty and the parts counter look things up by part number all day; Enter opened a
picture instead of the part. Minor: the part was one row down.

## Where it lives

- Gillett's photos are named for the part on them, and a photo's search title is its
  file name (`mediaProjector` in `wizeworks/packages/commerce/src/universal-projection.ts`).
- `searchAll` in `wizeworks/packages/search/src/search.ts` sorted on text match first,
  and the title is the field weighted highest.
- The console re-ranks records against what was typed (`rankRecords` in
  `components/launcher-match.ts`): a title that starts with the typed number outranks
  a title with no number in it.

## The fix

- `search.ts`: `UNIVERSAL_SORT` puts a photo below any record before comparing text
  match: `_eval([(entity_type:media):0,(entity_type:!=media):1]):desc,_text_match:desc,
  updated_at:desc`. Tried on the dev index first: "4062328" gave product then photo;
  "injector" gave the shelf, the service and the injectors with no photo on top;
  "4062328_1" still gave the photo.
- Both consoles: a record row carries `supporting` (true for a photo,
  `launcher-entries.ts`) and `rankRecords` sorts supporting rows below the rest
  (`launcher-match.ts`). One rule each side; nothing else changes order.
- Tests: search `photos-below-records.test.ts` (red with the old sort, green); both
  consoles' `launcher-match.test.ts`, two new cases (the part-number case red without
  the supporting rule, green with it). Search package 41/41 and `tsc` clean; both
  consoles' launcher tests 19/19; ESLint and Prettier clean.

## Confirmed by

sparx as Doty: "4062328" lists Products › "Cummins Fuel Injection Crossover Tube
O-Ring" first and Media › "4062328_1.png" under it. "injector" lists Shelves ›
"Injector rack, second bay, fourth shelf", Services › "Injector replacement, set of 6",
then the injectors. Piggles: not checked on screen.

## Rating effect

—
