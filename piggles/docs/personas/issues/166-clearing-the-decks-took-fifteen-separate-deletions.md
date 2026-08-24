# 166 — Clearing the decks took fifteen separate deletions

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · act 1
**Surface:** mypiggles › Sell › Products
**Filed:** 2026-08-23
**Fixed:** 2026-08-23
**Confirmed by:** not on screen — no browser attached (see below)
**Blocked on:** nothing

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

**Built as a workbench primitive, not as a Products feature**, which is what the
note above asked for.

**`useListSelection`** ([lib/workbench/selection.ts](../../../apps/workbench/lib/workbench/selection.ts))
is the model. Three decisions in it that are easy to get wrong:

- **The whole ROW is kept, not its id.** A selection outlives the page it was
  made on: tick four, page forward, tick two more, act on six. Keeping ids would
  mean looking rows up again in a window that no longer contains them.
- **Shift-click is a range**, anchored on the last plain click. That is the
  difference between "pick these fifteen" being one gesture and being fifteen,
  which is the entire complaint in this issue.
- **`canChoose` makes a row unselectable rather than selectable-then-rejected**,
  so the count in the bar is always the count that will act.

**`BulkBar`** and **`SelectAllCell` / `ChooseCell`** are the shared UI. The
header box goes indeterminate when part of the page is chosen — a plain unticked
box beside four ticked rows reads as "nothing chosen" — and a checkbox inside a
clickable row stops its click and its Space key at the cell so it never also
opens the row.

**On Products** the bar offers **Retire** then **Delete**: reversible first,
irreversible last, and only the second is red, because two danger buttons side by
side make neither of them mean anything.

**The bulk confirm says everything the single one says.** Deleting one product
warns that its price, codes and versions go with it, that it leaves the website
immediately, that past orders keep their record, and that retiring is the
reversible alternative. All four are still true of fifteen, and a bulk dialog
that drops them because it is talking about a number rather than a name is how a
bulk action becomes the dangerous one.

### The API half

There was no bulk delete — `bulk-status` and `bulk-tag` existed, delete did not.
`productService.bulkSoftDelete` applies the **same** tombstone as `softDelete`,
per product, in one transaction: product and its live variants together, because
a live variant under a deleted product is an orphan whose SKU stays reserved and
blocks a later reinstall. Capped at 200 rather than the 1000 the status/tag bulks
allow — every one of these is irreversible.

Products already gone are **skipped and counted**, not errored. Somebody who
ticked fifteen and had one deleted in another tab wants the fourteen removed and
a truthful count, and the toast says so rather than folding it into the total.

### Reorder was rewritten onto it

The reorder worklist had grown its own selection during act 3's fixes. That is
now deleted and pointed at the shared hook, so there is one implementation rather
than two that drift — and reorder gained shift-click ranges for free.

### Files

`products-list.tsx` 509 → 242, plus `products-list-table` (188),
`products-list-notices` (125), `products-list-toolbar` (95),
`products-bulk-actions` (133), `products-list-empty` (51),
`products-list-shared` (57), `products-bulk` (48). The bulk hooks are their own
file because `products-data.ts` is 2,934 lines and touching it would oblige
splitting all of it.

## Confirmed by

**Nothing on screen — no browser was attached when this was built.** It
typechecks across commerce, api-rest and workbench, lints clean and formats
clean, but nobody has ticked a box.

**What to check when there is a browser**, in this order:

1. Tick two rows, shift-click a third further down — the span between fills.
2. Tick some, page forward, tick more, read the count. It should be the sum.
3. Change a filter with rows chosen — the selection clears, deliberately, because
   chosen rows that no longer match would act invisibly.
4. Delete two and read the toast against what is left.

## Rating effect

`Sell › Products` — not re-scored until the above is done.
