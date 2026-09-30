# 690 — A recipe that cost nothing to make

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 242
**Surface:** mypiggles — Making things › Recipes, list and detail
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen — see below
**Blocked on:** —

## What happened

Devi wrote her first recipe: **The Ash Overshirt**, L / Ink, one antique brass
belt hardware per garment. The card at the top of the saved recipe said:

> **You could make** 0 · from what is free at Fulfillment Center
> **Runs out first** BRASS-BELT-1 · Order this to make more
> **Costs about** $0.00 · each, at today's part prices

Three numbers. One was a barcode. One was a lie.

## Why the cost was wrong

```ts
const costByVariant = new Map(bom.components.map((c) => [c.variantId, c.variant?.costCents ?? 0]));
```

`costCents` is nullable. `?? 0` turns "nobody has told us what this costs" into
"this costs nothing", and the two sum identically.

MEASURED 2026-09-19, Juniper Row: **229 of 232 variants have no cost recorded.**
So for 98.7% of her catalog this screen says her garments cost $0.00 to make, in
a stat headed "Costs about", on the screen she prices against.

This is [[feedback_never_present_absence_as_measurement]] exactly. The platform
already knows the pattern and says it well one pane away, in stock value:

> 4 units have no cost recorded, so the figure above is short by whatever those
> cost.

## Why the name was wrong

"Runs out first" printed `limitingSku`. It is the single most actionable figure
on the card — it is what she goes and buys — and it read `BRASS-BELT-1`. The
component row it comes from carries the product title and the version; issue 681
put them there and this band was not updated.

## A third thing, found while fixing the second

The recipes LIST has a column headed **Costs about** too. It was printing
`laborCostCents`:

```tsx
<th …>Costs about</th>
…
<td …>{formatCents(bom.laborCostCents)}</td>
```

That is the TIME cost, per run. The detail card's "Costs about" is parts plus
labor, per finished unit. Two different numbers about two different things,
under the same words, on two screens in the same app. Both read $0.00 for Devi
today, so the contradiction was invisible and would have appeared the moment she
filled either one in.

The list already loads the components — it counts them for the "Parts" column —
so the honest figure costs no extra query. `componentRows()` is now shared, the
estimate moved from `BomDetail` up to `BomRow`, and both screens read the same
field.

## What changed

- `estimateCost` keeps `null` as `null` and returns `uncostedComponentCount`
  beside the total.
- A recipe with uncosted parts and nothing else to add up says **Not known**,
  with what to do about it. A partly-costed recipe shows the figure and says what
  it is short by.
- "Runs out first" names the product and puts the version and code underneath.
- The list and the detail read the same estimate.
- The version now appears on recipes, their ingredients, runs, run lines, the
  buildable report and the recipe picker's option labels — issue 681 reaching the
  Making-things module, which it had not.

## Confirmed

> **Runs out first** — **Brass belt hardware, antique** / BRASS-BELT-1. Order this
> to make more.
>
> **Costs about** — **Not known** / No part on this recipe has a cost recorded, so
> there is nothing to add up. Put a cost on the parts and this fills itself in.

And on the list, under "Costs about": **Not known**, the same answer as the card.

## Not a defect, checked

"You could make 0" is correct. Fulfillment Center holds one brass belt and it is
flagged unsellable, so nothing free is there. Main Warehouse has 59. The location
picker sits in the header of "What the shelves allow" further down the pane, and
the stat says which location it counted, so the screen is honest — the number
just defaults to whichever location comes first rather than the one with the
stock. `commerce_products.default_warehouse_id` would be the natural default and
is set on 0 of Devi's 52 products and 8 of the platform's 641, so it is not one.

## Files

- `wizeworks/packages/inventory/src/services/boms.ts`
- `wizeworks/packages/inventory/src/services/assembly-orders.ts`
- `wizeworks/packages/inventory/src/services/supplier-variants.ts`
- `piggles|sparx/apps/workbench/surfaces/inventory/bom-detail.tsx`
- `piggles|sparx/apps/workbench/surfaces/inventory/boms-list.tsx`
- `piggles|sparx/apps/workbench/surfaces/inventory/assembly-detail.tsx`
- `piggles|sparx/apps/workbench/surfaces/inventory/assemblies-list.tsx`
- `piggles|sparx/apps/workbench/surfaces/inventory/assembly-data.ts`
