# 681 — Five stock lists showed a code where a name belongs

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 241
**Surface:** mypiggles — Preorders, Waiting list, Whose stock, Expiring stock, a consignment settlement
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03, on the screen — see below
**Blocked on:** —

## What happened

Devi started a preorder on the **Linen Shirtdress**, picking it from a search
that showed her "Linen Shirtdress · L · Chalk". The row it produced said:

> **LINEN-SHIRTD-L-CHALK**
> Cut and sewn in the spring run, posted the week it comes off the table.

She picked a dress and got a barcode.

## Why

Five services fill a field called `variantName` from `ProductVariant.title`
alone. That field is nullable, and the schema says why:

```prisma
title String? @db.VarChar(255) // computed from options when omitted
```

Nothing computes it on write. MEASURED 2026-09-18 on the local database:

```sql
select count(*) as variants, count(title) as with_own_title
  from commerce_product_variants;
--  variants | with_own_title
--      2548 |           1670
```

**878 of 2,548 — a third of the catalogue — have no title**, so those rows fall
through to the SKU.

**And the two-thirds that HAVE one are no better.** What is in that column:

| variant title | product title                  |
| ------------- | ------------------------------ |
| White / 2XL   | Unisex Jersey Short Sleeve Tee |
| Sky / L       | Still Here T-Shirt             |
| 11oz / Black  | Keep Going Mug                 |

It is the option label. A row reading "White / 2XL" names a size, on a screen
that never says a size of WHAT. Fifteen of them in a list and the only way to
tell a shirt from a mug is the code beside it — and on an imported catalogue the
codes look like `6a2e25d8be63d55ae20b65b9:18544`.

So the field was wrong in both directions at once, and neither ever printed the
one word a shop owner recognises.

**The answer already existed, once.** `uncostedStock` — What your stock cost you
— does it properly, with a lateral join rebuilding the option label and a
three-line cell, and its comment names the exact problem:

> A variant's title is usually null (the schema computes it from the options), so
> without this every one of fifteen Ash Overshirt rows reads "The Ash Overshirt"
> and is told apart only by its code.

One service learned it. Five did not.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## What should have happened

TWO fields, never one. What the thing IS, then which one of them:

> **Linen Shirtdress**
> L / Chalk · LINEN-SHIRTD-L-CHALK

The product alone cannot tell two sizes apart; the version alone does not say
what it is a version of. A row needs both.

## How to reproduce

Before the fix, every time:

1. Sign in as `p03.devi@piggles.test`, Juniper Row.
2. **Stock › Preorders**, start an offer on any product with sizes.
3. The row names it by its SKU.
4. Same on **Waiting list**, **Whose stock**, **Expiring stock**, and the lines
   of a consignment settlement.

## Why it matters

These five screens are all about the AWKWARD stock: what somebody is waiting
for, what is about to go off, what belongs to somebody else, what has been
promised before it exists. Every one of them is read under pressure, and a
column of codes is a column she has to decode before she can act.

The Expiring stock pane is the sharpest case. It lists what is about to be
thrown away, and it was naming each batch by a code.

## Where it lives

| What                         | Where                                                                                                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `variant.title` alone, ×5    | `wizeworks/packages/inventory/src/services/{preorders,consignment,backorders,expiry,stock-ownership}.ts`                                                    |
| The one that got it right    | `…/services/uncosted-stock.ts`                                                                                                                              |
| The six cells that render it | `piggles\|sparx/apps/workbench/surfaces/inventory/{preorders,backorders,backorder-detail,stock-ownership,consignment-settlement-detail,expiring-stock}.tsx` |

## The fix

**One place for the rule, on each side.**

`services/variant-label.ts` holds the SQL fragments (`VARIANT_LABEL_COLUMNS`,
`VARIANT_LABEL_JOINS`) for the three raw queries, the Prisma select for the two
that use one, and the `variantLabel()` helper that composes the same answer from
a Prisma row. The lateral rebuilds the option label in the shop's own option
order, so "Chalk / L" comes out the way she set it up rather than
alphabetically. The helper returns the code alongside the two names on purpose:
a caller that takes only some of them is how a pane ends up with a code and no
name again.

`surfaces/inventory/item-name.tsx` holds the cell. The product name WRAPS where
the version and the code truncate, which is the lesson `uncosted-row.tsx`
learned first: in a narrow pane every row read "Linen Shir…" and told her
nothing, while a size is short enough to survive and a code is a reference
rather than something she reads.

It also handles the two degenerate cases. A product with one unnamed version has
no second line rather than an empty one, and a row whose product has been
deleted promotes the version into the name rather than repeating it underneath.

## Confirmed by

> **Preorders**, after the change: "**Linen Shirtdress** / L / Chalk ·
> LINEN-SHIRTD-L-CHALK / Cut and sewn in the spring run…" and "**The Everyday
> Tee** / L / Clay · THE-EVERYDAY-L-CLAY".
>
> **Expiring stock**: "**Brass belt hardware, antique** / FT-8871-B / Main
> Warehouse · recall cleared" — previously the SKU, then the lot number.
>
> **Waiting list** and **Whose stock** both load clean and are empty for this
> tenant. The new SQL was proved on real rows directly:
>
> ```text
>  sku            | product            | version
>  FIELDTRACK-M   | Field Track Jacket | M
>  TEE-BLK-S      | Classic Tee        | Black / S
>  MODEL-3-RWD    | Model 3            | (none)
> ```
>
> which is the three cases: options only, two options, and a single version.

## Gap to 10

Two of the six services that name an item still send only a SKU and no name at
all — supplier lead times and stock reservations. Neither claims a name it does
not have, so neither is lying, but both would read better with one.

`ProductVariant.title` staying null is the root of it. Either the writer should
compute it, as the schema comment says, or the column should be understood as an
override and the option label derived everywhere. It is currently neither.

## Rating effect

Recorded in [rating.md](../rating.md) on the `inventory.preorders` row and
against the four other panes as they are scored.
