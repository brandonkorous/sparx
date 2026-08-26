# 227 — The column naming the goods was the one squeezed to nothing

**Status:** fixed and confirmed
**Severity:** design
**Found by:** P03 · Juniper Row · act 7 — the RULE #6 check at 360px
**Surface:** mypiggles › Sell › Returns › A return › What happens to the goods
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** P03 · Juniper Row · act 7, in a 360px frame — reads "The Everyday Tee" over three lines, table still scrolls inside itself

## What happened

Scoring the return pane at 360px, as RULE #6 requires. The decision table:

```
Item   Qty   Condition   De…
T…      1    like new    ●
```

**`T…`** — one letter and an ellipsis. Devi is being asked to choose between
Back on sale, Quarantine, Repair and Scrap for a garment the table will not
name. Qty and Condition kept their room; the column that says WHAT is being
decided about got none.

It was not much better on a wide screen, where it read `THE-EVER…`.

## What should have happened

The thing being decided about is the one item on the row that must be readable.

## Why it matters

Every other choice on that row is meaningless without it. Scrap is a write-off
and Quarantine takes stock off sale — decisions a person should not be making
against a blank.

And the pane **contradicted itself**: the card directly above says "The Everyday
Tee", and the table underneath calls the same garment `THE-EVER…`. Two names for
one thing, four inches apart.

## Where it lives

Two separate causes stacked.

**The cell was told to be as narrow as possible and then to truncate.**
[return-disposition-panel.tsx](../../../../piggles/apps/workbench/surfaces/commerce/return-disposition-panel.tsx):

```tsx
<td className="max-w-0">
  <span className="truncate">{row.variantName ?? row.variantSku ?? 'A free-text line'}</span>
```

`max-w-0` lets a table give the column nothing, and `truncate` then eats
whatever is left. Together they guarantee the longest name loses.

**And the name it was falling back to was a code.** `variantName` comes from
`v.title`, which is blank on most catalogs — including every product Devi has —
so the fallback to the SKU was not an edge case, it was the normal path.

## The fix

- The cell **wraps instead of truncating**, with a floor of `7rem`. A product
  name over three lines at 360px is readable; one letter is not. The table keeps
  its own horizontal scroll, so the page still does not overflow —
  `scrollWidth === innerWidth` at 356px, before and after.
- The query reads `COALESCE(v.title, oi.name)`. The order line's frozen name is
  what the rest of the pane already uses, so the two now agree.

## What it looked like once fixed

```
Item        Qty   Condition
The          1    like new
Everyday
Tee
```

## Rating effect

`Sell › A return` in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
