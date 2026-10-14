# 173 — Words ran together after a number: "$1,900.00in core deposits"

**Status:** fixed
**Severity:** copy
**Found by:** P01 · Gillett Diesel Service · act 11 (finance: the month's numbers)
**Surface:** workbench › Selling › Reports; Stock item; Provenance; same in Piggles
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P01 on screen, 2026-10-09 (sparx)
**Blocked on:** —

## What happened

Selling › Reports, under the revenue: "$1,900.00in core deposits is still waiting on
old parts to come back."

The space is in the source (`{formatCents(…)} in core deposits is`). The build drops
it: the compiled page holds `"in core deposits is still waiting…"`. It happens when a
sentence starts right after a value, wraps onto the next source line, and contains an
HTML entity (`&rsquo;`, `&rdquo;`, …). The same sentence without an entity keeps its
space (" was refunded in this period", " An email you send here …" compile with it).

Measured in the compiled pages: the Reports line, and Stock item's "… yet, so it has
to be found by name every time." Five places in the two consoles have this shape.

## What should have happened

"$1,900.00 in core deposits …".

## Why it matters

It reads as a typo on the screen that explains money. Cosmetic, but on every report
with a held deposit.

## Where it lives

- The compiler used for the consoles drops the leading space of a multi-line JSX text
  that contains an entity. Not ours to change.
- `sparx/apps/workbench/surfaces/commerce/reports.tsx`,
  `surfaces/inventory/stock-item.tsx`, `surfaces/inventory/provenance.tsx`; Piggles'
  `surfaces/commerce/report-sections.tsx` and `surfaces/inventory/provenance.tsx`.

## The fix

- In the five texts, the entity is written as the character itself (’ ” “), by a
  script that rewrote only those text nodes (found with the TypeScript parser).
- `lib/jsx-entity-space.test.ts` (both consoles) parses every `.tsx` in the console
  and fails on a JSX text that starts with a space right after a value, wraps, and
  holds an entity. Red before (sparx: reports, provenance, stock-item; Piggles:
  report-sections, provenance), green after. Lint clean.

## Confirmed by

P01 on screen, 2026-10-09 (sparx): Selling › Reports reads "$1,900.00 in core deposits
is still waiting on old parts to come back."

Not checked on screen: Stock item, Provenance, Piggles.

## Rating effect

—
