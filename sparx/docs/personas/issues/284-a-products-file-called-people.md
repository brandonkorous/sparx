# 284 — A products file said "All 609 are people you already have"

**Status:** fixed
**Severity:** copy
**Found by:** P01 · Gillett Diesel Service · rating Move in › what happened (a practice run of her Shopify products file)
**Surface:** Move in, the run's headline and each card's breakdown, and Past moves; sparx console and Piggles
**Filed:** 2026-10-14
**Fixed:** 2026-10-14
**Confirmed by:** sparx as Doty, 2026-10-14
**Blocked on:** —

## What happened

Over a "Products: 609" card:

> Nobody in this file is new
> All 609 are people you already have. Doing this for real replaces their name, phone and
> tags … Addresses they already have are kept. Anyone who has been taken off marketing
> stays off it.

And under the count: "none of them new: every one is somebody you already have".

## What should have happened

"Nothing in this file is new. All 609 are already here. Doing this for real replaces them
with whatever this file says …", and "every one is already here".

## How to reproduce

1. Sign in as Doty. Move in › Shopify › bring a products file in that is already here
   (practice run).

Every move of anything other than customers whose rows are all already here.

## Why it matters

The one warning that says "this would overwrite what you have" describes the wrong kind of
record, and promises things (addresses kept, marketing choices kept) that mean nothing for
parts.

## Where it lives

`surfaces/migration/run-outcome.ts` (`runHeadline`, `landedBreakdown`), both consoles: they
were written for issue 106's customer file and never told what kind of file it was.

## The fix

- Both helpers take `people` (required, so no caller can forget it). Customers keep their
  words; anything else says "Nothing in this file is new" and "every one is already here".
- Callers pass it: sparx `migration-run.tsx` and `migration-history.tsx`, Piggles
  `migration-progress.tsx` and `migration-history.tsx` (run: every kind in it is
  customers; card: its own kind).

Tests: `surfaces/migration/run-outcome.test.ts` in both consoles (one new, red, then green;
the customer cases pass `people = true`). sparx migration 4/4, Piggles 13/13.

## Confirmed by

sparx as Doty, the products practice run: "Nothing in this file is new. All 609 are already
here …", and under Products "none of them new: every one is already here".

## Rating effect

platform.migrate.run: the warning names the right kind of thing.
