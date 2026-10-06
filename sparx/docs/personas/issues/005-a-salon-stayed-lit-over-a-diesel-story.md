# 005 — "A salon" stayed lit over a story that was a diesel shop

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 1
**Surface:** workbench › first-run setup › Your story › the example buttons
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran P01 act 1 — after a reload no example is lit over "I run diesel parts and repair"
**Blocked on:** —

## What happened

Doty's story read "I run a business for businesses…" (from the distributor
example). After the page reloaded, the row of examples showed **A salon** filled
in red, as if his story were the salon one. Earlier, after he typed his own
business, **A distributor** stayed lit too.

## What should have happened

The lit example is the one the story still is. A story in his own words is none
of them.

## How to reproduce

1. Pick any example except the salon, change something, reload.
2. **A salon** is lit. Every time.

## Why it matters

A filled button says "this is what you picked". Here it said salon to a diesel
shop, which makes him wonder what setup will actually build.

## Where it lives

`story-composer.tsx` (both consoles): `const [exampleIdx, setExampleIdx] =
useState(0)`. Remembered state, starting at 0 on every mount, and never updated
by an edit to the story.

## The fix

The index is derived from the story on every render: the example whose
`industry` matches, or none when the story carries the owner's own words
(`industryLabel`, issue 004). The state and its setter are gone. Same edit in the
Piggles console.

## Confirmed by

> Re-ran P01 act 1. Reloaded http://localhost:3011/ with the story "I run diesel
> parts and repair for businesses…": all five examples are outlined, none filled.

## Rating effect

Recorded with the first-run setup row.
