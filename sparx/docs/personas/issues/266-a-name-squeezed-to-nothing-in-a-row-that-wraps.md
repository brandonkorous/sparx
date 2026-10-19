# 266 — "Won and lost, by person" drew the person's name 2 pixels wide

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · rating Customers › Reports
**Surface:** 99 rows across both consoles: any row that wraps, whose main words grow and may shrink (`flex-1` with `min-w-0` or `truncate`)
**Filed:** 2026-10-14
**Fixed:** 2026-10-14
**Confirmed by:** sparx as Doty, 2026-10-14
**Blocked on:** —

## What happened

On Customers › Reports, "Won and lost, by person" showed one row: "I", then "0 won",
"1 lost", "0% win rate", "$0". The name was "Unassigned", drawn 2px wide.

## What should have happened

The name reads in full. When the card is narrow, the badges move to a second line.

## How to reproduce

1. Sign in as Doty. Open Customers › Reports in a pane about 730px wide.
2. Scroll to "Won and lost, by person".

Every time the badges fill the line.

## Why it matters

The row says who won and lost, and the who was missing. The same shape sits in 99
places: account contacts, price tiers, product media and pricing, tax exemptions,
SEO checks, social cadence, the search box's status line, and more. Each one hides
its main words when the row gets full.

## Where it lives

Tailwind's `flex-1` is `flex: 1 1 0%`, a starting width of zero. In a `flex
flex-wrap` row the browser decides what fits on a line from those starting widths.
So a `flex-1` name counts as zero, every badge stays on the first line, and the name
gets what is left. `min-w-0` or `truncate` lets it shrink to nothing. Card 262 had
the same cause in its header.

`sparx/apps/workbench/surfaces/crm/reports.tsx:530` was the one seen.

## The fix

- Every grower in a wrapping row that can shrink to nothing now has a starting
  width, `basis-48` (12rem). The other items wrap below it instead. 88 places in 66
  files: all of sparx, and the Piggles files under its 250-line rule.
- `scripts/check-wrap-rows.mjs` (new) reads the JSX structure of both consoles and
  fails on any such row. It was red at 99 files, then green over 1681 files. It was
  red again when one fix was taken out. It is wired as `pnpm check:wrap-rows` and
  into `.githooks/pre-push`.
- 33 Piggles files over 250 lines are listed as `PIGGLES_DEBT` in the script, the
  same policy as 263. An entry that no longer offends fails the check.
- The diff was read back: every changed line only adds `basis-48`, except one line
  the formatter wrapped.

## Confirmed by

sparx as Doty, Customers › Reports: "Unassigned" now measures 218px (light) and 209px
(360px), with the badges on the line below.

## Rating effect

crm.reports and every screen with such a row: main words no longer vanish.
