# 278 — "Why this number" said "0.7143 a day … across 1 days" under a red "Not measured"

**Status:** fixed
**Severity:** copy
**Found by:** P01 · Gillett Diesel Service · rating Stock › Planning › Why this number (Bosch Fuel Rail 0445226044, after "Work it out now")
**Surface:** Stock › Planning › Why this number, "What went into it" and the badge in its header (both consoles and the AI tools read the same explanation)
**Filed:** 2026-10-14
**Fixed:** 2026-10-14
**Confirmed by:** sparx as Doty, 2026-10-14
**Blocked on:** —

## What happened

> [Not measured] (red, at the top)
> How fast it sells · 0.7143 a day · Measured over the last 7 days: 5 sold in 90 days
> across 1 days

The reorder point under that red badge was worked out ("20"). The badge was red because
the season input was marked missing: under a year of history there is no last year to
compare, so the sum assumes an average month.

## What should have happened

"0.71 a day", "Worked out from the last 7 days (5 sold). 5 sold in the last 90 days, on
1 day." The header says "Assumed", as it does for an assumed supplier lead time.

## How to reproduce

1. Sign in as Doty. Stock › Planning › At risk, "Work it out now", open a row.

Every time; the badge on every business younger than a year.

## Why it matters

The screen exists to make a number checkable. A raw four-place decimal, a garbled
sentence and a red verdict that contradicts the figure make it less so.

## Where it lives

`wizeworks/packages/inventory/src/services/planning-provenance.ts` (`describeInputs`).
The console already rounded the figures it formats itself; the table shows the
server's strings as they come.

## The fix

- The rate is rounded to two places; the source sentence names one window per clause
  and says "1 day".
- Season with under a year of history is `assumed`, not `missing`; the "after a year of
  trading" advice follows the new level.
- `describeInputs` and `worstConfidence` are exported for the test.

Test: `src/services/why-this-number-words.test.ts` (3), red, then green; inventory
services 159/159. Package type check and lint clean.

## Confirmed by

sparx as Doty: the header badge reads "Assumed" (amber); "How fast it sells · 0.71 a day
· Worked out from the last 7 days (5 sold). 5 sold in the last 90 days, on 1 day."

## Rating effect

inventory.planning.explain: a checkable number, in readable words.
