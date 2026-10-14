# 255 — An empty report said to loosen a filter it did not have

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · confirming issue 247 (Piggles as The Marrow Review)
**Surface:** Customers › Build a report › one report, sparx console and Piggles
**Filed:** 2026-10-13
**Fixed:** 2026-10-13
**Confirmed by:** Piggles as Thistle & Rye (sparx: tests only), 2026-10-13
**Blocked on:** —

## What happened

The Marrow Review had no deals yet. Rosalind opened "Where your deals are", a ready-made
report with no filter and the period "All time". The answer said: "Nothing matches yet.
Loosen a filter, or widen the period."

There was no filter to loosen and no wider period than all time. The report was empty
because the business had no deals. One sentence covered two causes with different
fixes, and it gave the advice for the one that was not true.

## What should have happened

- With a filter or a period set: "Nothing matches yet. Loosen a filter, or widen the
  period."
- With neither: say there is nothing of that kind to count yet, in the object's own word:
  "There are no deals to count yet."

## How to reproduce

1. In a business with no deals: Customers › Build a report › "Where your deals are".

## Why it matters

The owner goes looking for a filter that does not exist, on the screen meant to teach
how reports work.

## Where it lives

The empty branch of the result view in `surfaces/crm/report-builder.tsx` (sparx) and
`report-result-view.tsx` (Piggles).

## The fix

`emptyAnswer` in `surfaces/crm/report-group-words.ts` (both consoles) picks the sentence.
When a filter or a period narrows the report, it says "Nothing matches yet. Loosen a
filter, or widen the period." When nothing narrows it, it says "There are no {records}
to count yet", in the object's own plural word. The result view takes that sentence
from the report builder (sparx `report-builder.tsx`; Piggles `report-builder.tsx` and
`report-result-view.tsx`).

Tests: `report-group-words.test.ts` (both sentences) and `report-builder-result.test.ts`
(the builder uses it) in both consoles, red then green.

## Confirmed by

- Piggles, Marisol (Thistle & Rye has no deals): Customers › Build a report › "Where your
  deals are" says "There are no deals to count yet."
- sparx: not seen on screen. Every sparx business I can sign in as has deals. The code is
  the same and its test is green.

## Rating effect

Report (one report), first use: an empty answer gives the true reason.
