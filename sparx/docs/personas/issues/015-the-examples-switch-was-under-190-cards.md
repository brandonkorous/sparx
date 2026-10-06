# 015 — The examples switch was under 190 cards

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 1
**Surface:** workbench › first-run setup › step-by-step › "Pick a starting point"
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran P01 act 1 — "Bring its examples" and "Start from a blank canvas" sit directly under the search, above the first card
**Blocked on:** —

## What happened

Doty wanted the Garage design without its example products: his real catalog of
653 parts comes in by import. The switch for that, **Bring its examples**, was
below all 190 design cards, about 22,000 pixels down. So was **Start from a
blank canvas**. Nothing on the first screen said either existed.

## What should have happened

The two choices that change what gets installed sit where he is looking: right
under the search, above the gallery.

## Why it matters

An owner who never finds the switch installs six sample products (tote bags and
t-shirts) into a diesel parts store, then has to find and delete them. Someone
who wants a blank site has no idea it is an option.

## Where it lives

`surfaces/onboarding/wizard/step-blueprint.tsx` in both consoles: the switch and
the blank row came after the grid.

## The fix

- Both consoles: the examples switch (only when a design is chosen) and the blank
  row now render above the grid; the empty-search message says "above".
- sparx: the "Start blank" button no longer names `neutral` (a colorless button;
  RULE #4), and "build headless against our API" became "have a developer build
  on top of it". Piggles: the same `neutral` removal.

## Confirmed by

> Re-ran P01 act 1. "Pick a starting point": search, then "Bring its examples"
> with its switch, then "Start from a blank canvas", then the Garage card.

Checks: sparx and Piggles workbench `tsc --noEmit` exit 0; eslint 0; prettier
clean; `check:console-parity` green.

## Rating effect

Recorded with the first-run setup row.
