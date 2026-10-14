# 180 — A return's condition printed as a code

**Status:** fixed
**Severity:** copy
**Found by:** P01 · Gillett Diesel Service · act 13 (a retail return)
**Surface:** Workbench › Commerce › Returns › a return › What happens to the goods
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P01 on screen, 2026-10-09
**Blocked on:** —

## What happened

Doty recorded Brynn's injector as "As new" in the check dialog. The line above the
table then read "Came back as new". The table under "What happens to the goods" read
"like new": the stored code with its underscore swapped for a space.

## What should have happened

One fact, one word: "As new" everywhere.

## How to reproduce

1. Record a check on any return. Every condition shows its code in the table.

## Where it lives

`sparx/apps/workbench/surfaces/commerce/return-disposition-panel.tsx`:
`row.condition.replace(/_/g, ' ')` instead of `CONDITION_LABELS`. Piggles: the same line
in its `return-disposition-panel.tsx`, though it has `conditionLabel()` in
`returns-words.ts`.

## The fix

Both consoles' `return-disposition-panel.tsx` print `conditionLabel(row.condition)`, the
same words as the check dialog. Test: `surfaces/commerce/return-goods-words.test.ts` in
each console, red first.

## Confirmed by

P01 on screen, 2026-10-09 (Commerce › Returns › O-000004): the table reads "As new", the
same as "Came back as new" above it. Piggles not opened; its test passes.

## Rating effect

—
