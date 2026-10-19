# 276 — "Not selling at all: 0" in danger red, over "Everything is moving"

**Status:** fixed (sparx); Piggles listed as debt
**Severity:** design
**Found by:** P01 · Gillett Diesel Service · rating Stock › Planning › Not selling (after pressing "Work it out now")
**Surface:** Stock › Planning › Not selling, the three tiles, sparx console and Piggles
**Filed:** 2026-10-14
**Fixed:** 2026-10-14
**Confirmed by:** sparx as Doty, 2026-10-14
**Blocked on:** —

## What happened

After the pass ("685 stock lines re-measured"), the tiles read "Cash tied up $0.00" in
warning amber and "Not selling at all 0" in danger red. Under them: "Everything is
moving."

## What should have happened

A zero of bad news is good news, and reads plain. The color comes when there is some.
Issue 251 made the same rule for an email's "Opened 0" in success green.

## How to reproduce

1. Sign in as Doty. Stock › Planning › Not selling. Press "Work it out now".

Every time nothing is idle.

## Why it matters

Red says "look here, something is wrong" about the one figure that is fine.

## Where it lives

`surfaces/inventory/planning-idle.tsx`: the two tones were fixed class names.

## The fix

- `surfaces/inventory/bad-news-tone.ts` (new): `badNewsTone(value, tone)` gives the tone
  only above zero. Both tiles use it.
- Piggles has the same tiles in `planning-idle.tsx` (259 lines, over its 250-line rule),
  so it waits on that split.

Test: `surfaces/inventory/bad-news-tone.test.ts` (2), red when the tone is always on,
then green. Scoped type check and lint clean.

## Confirmed by

sparx as Doty: "$0.00", "$0.00" and "0" read in plain ink.

## Rating effect

inventory.planning.idle: color only where there is bad news.
