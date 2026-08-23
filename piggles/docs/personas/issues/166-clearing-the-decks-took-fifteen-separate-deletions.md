# 166 — Clearing the decks took fifteen separate deletions

**Status:** open
**Severity:** minor
**Found by:** P03 · Juniper Row · act 1
**Surface:** mypiggles › Sell › Products
**Filed:** 2026-08-23
**Fixed:** —
**Confirmed by:** —
**Blocked on:** scope — a selection column and a bulk bar the workbench does not have yet

## What happened

Act 1 is Devi clearing the decks before her own catalogue arrives. **Practice
data → Remove sample data** took the practice pack out in one press, which is
right. What it left behind was the fifteen products the starter and the boutique
template had put there — six branded for another company ([165]) and nine from
the template.

There is no way to remove more than one at a time. Fifteen products meant fifteen
rounds of: open the product, scroll to the bottom of its Overview, press **Delete
this product**, read the dialog, confirm, wait to be returned to the list. Sixty
deliberate actions to empty a shop she had not put anything into yet.

The list has no checkboxes at all — no select column, no select-all, no bulk bar,
no shift-click range.

## What should have happened

Pick several, act once. This is the first list a new owner meets and the first
thing many of them will want is "not these".

## How to reproduce

Every time.

1. Console → **Sell** → Products with more than one product listed.
2. Look for a way to select two of them. There is not one.

## Why it matters

For Devi specifically, this is the complaint she arrived with. Her whole reason
for leaving the marketplace was the per-item grind, and she is the owner who
"will notice if a variant grid makes her enter 22 prices by hand". Fifteen
one-at-a-time deletions in the first ten minutes is that same feeling, before she
has added anything of her own.

Beyond her, it is bounded friction rather than a broken job — she did finish, and
each individual delete is excellent: the dialog names the product, says what goes
and what survives, warns it is immediate on the website, and offers **Retire it**
as the reversible alternative. Nothing about one deletion is wrong. There are just
fifteen of them.

## Where it lives

The products list pane in `piggles/apps/workbench`. The capability exists below
it — the API already carries bulk product operations (`bulk_update_product_status`
is an addressable tool) — so what is missing is the selection UI, not the
operation.

Worth noting for whoever picks this up: `@wizeworks/ui`'s `SelectionList` and
`BulkActionBar` were **deleted** in the workbench cutover, so there is no
composition to reach for. It has to be built in the workbench's own idiom, and
then it wants to serve every list rather than this one.

## The fix

Not made. `Blocked on: scope` — a selection model for list panes is a feature, not
a defect repair, and it is the kind of thing that should be designed once for all
of them rather than bolted onto Products because that is where it was noticed.

Re-tested in act 3, where the same question arrives with more force: 60 variants,
one price, and whether they can be set together.
