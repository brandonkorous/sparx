# 251 — A report printed money as a plain number, two different ways

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · confirming issue 247 (Customers › Build a report, and the "Monday numbers" dashboard, as Doty)
**Surface:** every report or dashboard card that adds up money, sparx console and Piggles
**Filed:** 2026-10-13
**Fixed:** 2026-10-13
**Confirmed by:** sparx as Doty and Piggles as The Marrow Review, 2026-10-13
**Blocked on:** —

## What happened

"Where your deals are" has a "Total value" column. It read:

| Stage              | Deals | Total value |
| ------------------ | ----- | ----------- |
| First call         | 2     | 61250.50    |
| Trial order        | 1     | 9,840       |
| Visited their yard | 1     | 61,380      |

No dollar sign anywhere. And two styles in one column: a whole number got a thousands
separator ("9,840"), a number with cents did not ("61250.50"). The same on the dashboard
card.

The server knows "Total value" adds up a money field (`value`, kind `currency`), but a
result column carries only its key and label, so the screen cannot tell money from a
count. The shared cell formatter then prints whole numbers with `toLocaleString()` and
the rest with `toFixed(2)`, which has no separators.

## What should have happened

"$61,250.50", "$9,840.00": money as money, in the business's currency, and every number
in a column printed the same way.

## How to reproduce

1. Customers › Build a report › "Where your deals are".

## Why it matters

A column of totals is read by comparing sizes. "61250.50" next to "61,380" reads as the
smaller one at a glance, and neither says it is dollars.

## Where it lives

- `wizeworks/packages/crm/src/services/report-compiler.ts`: result columns.
- `formatCell` in `surfaces/crm/report-group-words.ts` (sparx; it moved there for issue 247) and the Piggles report builder and widget.

## The fix

Server: each result column carries a `kind` (`currency` for a sum, average, least or most
of a money field; `number` otherwise), and a result with money in it carries the
business's currency (`tenant_businesses.default_currency`, USD when unset, as the deals
list assumes). Console: the one `formatCell` prints money with `formatAmount` and every
other number with the same separators. Builder table, single number and dashboard card
all pass the column's kind.

Tests: crm `report-money-columns.test.ts` (red, green); sparx and Piggles
`report-group-words.test.ts` (money and plain-number cases, red, green).

## Confirmed by

- sparx: "Where your deals are" reads $61,250.50, $9,840.00, $61,380.00, $15,000.00,
  $86,400.00, in the report and on the dashboard card.
- Piggles: $2,400.00 in the report and on the dashboard card.

## Rating effect

Build a report, one report: money reads as money.
