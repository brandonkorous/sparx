# 698 — Every row was the product name again

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 244
**Surface:** mypiggles + sparx — Stock › How it is performing; and the three exports behind it
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen — before and after quoted
**Blocked on:** —

## What happened

Devi opened **How it is performing** and read the sell-through table:

> | Item                                       | Where | Sold | Left |
> | ------------------------------------------ | ----- | ---- | ---- |
> | The Ash Overshirt<br>`THE-ASH-OVER-M-CLAY` | MAIN  | 4    | 4    |
> | Marlow Knit<br>`MARLOW-KNIT-L-OAT`         | MAIN  | 3    | 4    |

She makes the Ash Overshirt in five sizes and several colors. Every one of them
is a row called **The Ash Overshirt**, and the only thing telling them apart is a
code. She said last act, in her own words, that she does not know her codes.

## Why

```sql
COALESCE(v.title, pr.title) AS title
```

Three queries in `performance-reports.ts` squashed the product and the version
into one string. `ProductVariant.title` is nullable and nothing computes it on
write, so the COALESCE falls through to the product name.

`variant-label.ts` has existed since issue 681 to stop exactly this, and its
header says so in the first line of the shape section:

> **TWO fields, never one.** `productTitle` is what the thing IS and
> `variantName` is which one of them — a row needs both, because the product
> alone cannot tell two sizes apart and the version alone does not say what it is
> a version of. **A caller that squashes them into a single string is the bug
> coming back.**

It came back. This is the fourth module to be found doing it: the stock grid
(686), the recipes and runs (690), and now the performance reports.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## The measurement

```
variants with no title of their own          746 of 2,416   platform
…of those, sitting in a product where two
   or more rows therefore read identically   384 rows across 86 products
Juniper Row                                  108 of 108
```

**Every single one of Devi's variants** is in that set, so every row of every one
of these reports read as a product name plus a code.

## What was changed

- The three queries (sell-through, GMROI, stockout frequency) now use
  `VARIANT_LABEL_COLUMNS` + `VARIANT_LABEL_JOINS`, which rebuild the option label
  in the shop's own option order rather than alphabetically.
- Their row types carry `productTitle` + `variantName` instead of `title`, in the
  service, in both consoles' `reporting-data.ts`, and in the local `Bucket`.
- Three table cells render `<ItemName>` instead of hand-rolled stacked spans.
- The three CSV exports gained a **`version`** column beside `title`, the same
  split the stock export took in 686, so a spreadsheet can tell the rows apart
  too.

**Not changed: the fill-rate table.** Its `title` is `l.name` from the ORDER LINE
— the name the item was sold under, which is a different and correct thing to
show on a report about orders. Converting it would have been the sweep going one
file too far.

## Confirmed

> | Item                                                 | Where | Sold | Left |
> | ---------------------------------------------------- | ----- | ---- | ---- |
> | The Ash Overshirt<br>**M / Clay** · `THE-ASH-OVER-…` | MAIN  | 4    | 4    |
> | Marlow Knit<br>**L / Oat** · `MARLOW-KNIT-L-…`       | MAIN  | 3    | 4    |
