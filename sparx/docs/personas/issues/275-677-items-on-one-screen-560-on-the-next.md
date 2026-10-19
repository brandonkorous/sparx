# 275 — "677 items have no cost price" on one screen, "560 things" on the next

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · rating Stock › Planning › Cost to keep
**Surface:** Stock › Planning › Cost to keep (both consoles read the same API)
**Filed:** 2026-10-14
**Fixed:** 2026-10-14
**Confirmed by:** sparx as Doty, 2026-10-14
**Blocked on:** —

## What happened

Cost to keep said "677 items have no cost price". "What your stock cost you" said "560
things on your shelves … have never had a cost recorded". Same business, same moment,
same fact, two numbers.

## What should have happened

One count. Both screens say items, so both count items.

## How to reproduce

1. Sign in as Doty. Open Stock › Planning › Cost to keep, then Stock › What your stock
   cost you.

Every time an item is kept in more than one place.

## Why it matters

Two counts for one fact make the owner doubt both.

## Where it lives

`wizeworks/packages/inventory/src/services/planning-reports.ts`: the holding report
counted stock LINES (an item in two places counts twice), and its screen calls them
items. Measured: 677 lines, 560 distinct items. The slow-movers report counts lines
too, but its summary says "Lines", so it is right and stays.

## The fix

`uncostedItemCount` (new, same file) counts each item once; the holding report uses it.

Test: `src/services/holding-uncosted-items.test.ts` (2), red when the helper counts
lines, then green. Package type check and lint clean.

## Confirmed by

sparx as Doty: Cost to keep reads "560 items have no cost price".

## Rating effect

inventory.planning.holding: one count for one fact.
