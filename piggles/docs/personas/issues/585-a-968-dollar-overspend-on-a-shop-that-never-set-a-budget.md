# 585 — A $968 overspend on a shop that never set a budget

**Status:** fixed and proven on screen
**Severity:** high
**Found by:** Devi, on Stock → Cost vs plan
**Surface:** `wizeworks/packages/inventory/src/services/cost-reports.ts` · `piggles|sparx/apps/workbench/surfaces/inventory/cost-variance.tsx`
**Filed:** 2026-09-16
**Family:** [[feedback_never_present_absence_as_measurement]] · [[feedback_a_fix_leaves_its_neighbour_behind]]

## What she saw

| What you planned to pay  | What it actually cost                          | The difference        |
| ------------------------ | ---------------------------------------------- | --------------------- |
| **$0.00**                | **$967.92**                                    | **$967.92**           |
| Across 98 units received | Goods plus everything it took to get them here | **More than planned** |

In danger red. Below it, the screen's own warning band:

> **98 units have nothing to compare against**
> Those items have no planned cost set, so they are **left out of the figures
> above**. Set a cost on the product, or on its stock at a location, and they
> join the comparison.

The two cannot both be true. Either the 98 unplanned units are left out, in which
case the actual is not $967.92, or they are counted, in which case the band is
wrong. And in the table underneath, every row read **Planned each —** with a
**No plan set** badge and a variance of nothing.

**The headline said she had overspent by $967.92. The table under it added up to
$0.00.**

## Why

```ts
totalUnits += units;
totalActualCents += actual;                        // EVERY unit
if (hasStandard) totalStandardCents += standard;   // only the planned ones
else unitsWithoutStandard += units;

const varianceCents = hasStandard ? actual - standard : 0;   // the ROW is careful
…
totalVarianceCents: totalActualCents - totalStandardCents,   // the TOTAL is not
```

Two sides of one subtraction over **two different sets**. The per-row figure is
exactly right — `hasStandard ? actual - standard : 0`, and the interface comment
above it even says _"a variance against no standard is not a number, it is a
gap"_. The total takes the gap and calls it an overspend.

So the report's own rule was written down, applied per row, and dropped one
function later. The band was added to cover the gap and describes behavior the
totals do not have.

## Measured

```sql
select t.name, count(*) variants, sum(case when v.cost_cents is null then 1 else 0 end) no_plan
from commerce_product_variants v join tenants t on t.id = v.tenant_id
where v.deleted_at is null group by 1 order by 2 desc;
```

| tenant          | variants | no planned cost |
| --------------- | -------- | --------------- |
| WizeWorks LLC   | 1414     | 220             |
| Threadline      | 457      | 6               |
| **Juniper Row** | **108**  | **105**         |
| Warm Delta 7239 | 64       | **64**          |
| Harbor & Pine   | 54       | **54**          |

Three businesses have a planned cost on almost nothing. Every delivery they book
in becomes a red overspend the size of the delivery.

## The fix

Both halves of the comparison over the same units:

```ts
if (hasStandard) {
  comparedUnits += units;
  totalStandardCents += standard;
  totalActualCents += actual; // ← the change
} else {
  unitsWithoutStandard += units;
}
```

`totalVarianceCents` is now equal to the sum of every row's own `varianceCents`,
by construction rather than by luck.

The money does not disappear: a new `allActualCents` carries the whole window's
spend, and the warning band names it, which is where it belongs.

**Now**, verified in the browser:

| What you planned to pay           | What it actually cost                        | The difference                                 |
| --------------------------------- | -------------------------------------------- | ---------------------------------------------- |
| $0.00                             | $0.00                                        | $0.00                                          |
| Across **0 of 98 units** received | Goods plus freight, **for those same units** | **Nothing here had a plan to compare against** |

> **98 units have nothing to compare against**
> Those items have no planned cost set, so they are left out of the figures
> above. **Everything that arrived cost $967.92, and there is no plan to weigh it
> against.** Set a cost on the product, or on its stock at a location, and they
> join the comparison.

"Exactly what you planned for" is also gone from the zero case, because a
business that planned nothing did not plan exactly this.

## Proven

**`costing.test.ts`** — a delivery of two variants, one with a planned cost and
one without, bought exactly at plan. The property is the one the screen broke:
**the headline equals the sum of the rows.**

```ts
const rowSum = report.rows.reduce((sum, row) => sum + row.varianceCents, 0);
expect(report.totalVarianceCents).toBe(rowSum);
```

Putting the actual total back over every unit:

```
× never turns "nobody set a plan" into an overspend
    AssertionError: expected 10000 to be +0
```

The phantom overspend, in its plainest form.

The test asserts by VARIANT rather than by line order — the first draft assumed
`submittedOrder` hands lines back in the order it was given, which it does not,
and the test was measuring the fixture rather than the report.

|                 |                                 |
| --------------- | ------------------------------- |
| inventory       | **371 pass** (32 files)         |
| piggles console | **480 pass**                    |
| sparx console   | **382 pass**                    |
| typecheck       | inventory, both consoles exit 0 |
| lint / prettier | clean                           |

## A note on the file

`cost-reports.ts` already carried an uncommitted fix from an earlier sitting, on
`uncostedUnits` and zero-cost layers in a different function. This change is
additive to `priceVarianceReport` and does not touch it; both are in the tree
together and the file's 16 tests pass as one.
