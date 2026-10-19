# 283 — Invoice 4459, paid in full, sat in the list as "15 days late"

**Status:** fixed (sparx); Piggles listed as debt
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · rating Money › Invoices
**Surface:** Money › Invoices, the Due column, sparx console and Piggles
**Filed:** 2026-10-14
**Fixed:** 2026-10-14
**Confirmed by:** sparx as Doty, 2026-10-14
**Blocked on:** —

## What happened

> 4459 · Wasatch Front Utility Contractors, LLC · **15 days late** (red) · Paid · $2,119.60 · $0.00

The row's own Status said Paid and its balance was $0.00. The summary band rightly left it
out of "Late: $1,699.20, 2 invoices".

## What should have happened

A paid invoice shows when it was due, in plain ink.

## How to reproduce

1. Sign in as Doty. Open Money › Invoices.

Every invoice paid after its due day.

## Why it matters

Red "late" on a settled bill sends the owner to chase money she already has.

## Where it lives

`surfaces/invoicing/types.ts` `describeDue` counted days past the due date without
knowing the invoice was settled; `invoice-list.tsx` called it for every row.

## The fix

- `describeDue` takes `settled`: a settled invoice shows its date, muted, with "Was due
  …. Nothing is owed." as its title.
- The list passes `settled` for an invoice with nothing owed (`owedOn` ≤ 0); quotes keep
  their own wording.
- Piggles has the same function and list in `types.ts` (435 lines) and
  `invoice-list.tsx` (514 lines), both over its 250-line rule, so it waits on those splits.

Test: `surfaces/invoicing/due-when-settled.test.ts` (2), red, then green; invoicing
155/155. Scoped type check and lint clean.

## Confirmed by

sparx as Doty, Invoices: "4459 · Wasatch Front Utility Contractors, LLC · Sep 29, 2026 ·
Paid · $2,119.60 · $0.00". 4471 and 4466 still read "48 days late" and "28 days late".

2026-10-16: `surfaces/invoicing/due-when-settled.test.ts` read the real clock, so two days
later it said "17 days late" and went red. It now fixes today at Oct 14, 2026, midday in
Denver; invoicing tests 155/155.

## Rating effect

invoicing.invoices.list: late means owed.
