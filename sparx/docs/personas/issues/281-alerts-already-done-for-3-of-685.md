# 281 — Stock setup said the alerts step was "already done" for 3 of 685 lines

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · rating Stock › Set up your stock
**Surface:** Stock › Set up your stock, step 5 (both consoles read the same API)
**Filed:** 2026-10-14
**Fixed:** 2026-10-14
**Confirmed by:** sparx as Doty, 2026-10-14
**Blocked on:** —

## What happened

Under "Set the level at which an item counts as running low, and who hears about it":

> You have already done this somewhere else: tick it off.

Reorder, one screen away: "682 of your 685 stock lines have no reorder level".

## What should have happened

The step is done when the lines have levels. Until then, say how far it has got: "3 of
your 685 stock lines have a level so far."

## How to reproduce

1. Sign in as Doty. Open Stock › Set up your stock.

Any business with at least one level set.

## Why it matters

It tells the owner to tick off a job she has barely started, and two screens disagree.

## Where it lives

`wizeworks/packages/inventory/src/services/setup-progress.ts`: the alerts step counted as
satisfied when ANY stock line had a reorder level.

## The fix

- The alerts step is satisfied when every stock line has a level. With some set, it says
  "N of your M stock lines have a level so far."
- `readWorld` counts all stock lines (`stockLines`), the same lines Reorder counts, so
  the two screens use one number.
- `buildView` is exported for the test.

Test: `src/services/setup-alerts-done.test.ts` (3), red, then green; inventory services
165/165. Package type check and lint clean.

## Confirmed by

sparx as Doty, Set up your stock: step 5 reads "3 of your 685 stock lines have a level
so far." Steps 1 and 2 still say "already done", which is true (two places, 653 items).

## Rating effect

inventory.setup: a checklist that does not overclaim.
