# 553 — "Every unit on hand has a cost behind it", over 393 units that have none

**Status:** fixed and proven
**Severity:** high
**Found by:** Devi, on the screen her accountant will ask her to open
**Surface:** `wizeworks/packages/inventory/src/services/cost-reports.ts`
**Filed:** 2026-09-16
**Family:** [[feedback_never_present_absence_as_measurement]] · [[project_defaults_written_by_a_machine]] · [[feedback_a_fix_leaves_its_neighbour_behind]]

## What she saw

Stock → Stock versus your books. Two rows, four lines apart:

> **What we make it**
> _What your stock is valued at here, from your deliveries and sales_
> 491 units on hand · **$967.92**
>
> **Every unit on hand has a cost behind it**
> — · **$0.00**

$967.92 across 491 units is $1.97 a garment, in a shop whose shirtdresses sell
for $145. The second row is the one that should have said so. Instead it ruled
the question out.

And one pane away, on **What your stock cost you**, the console already knew:

> 68 things on your shelves, 375 units in all, have never had a cost recorded,
> so they count as nothing in every figure about what your stock is worth.

Two screens, one fact, opposite answers.

## Measured

```sql
select source_type, count(*) as layers, sum(quantity) as units,
       count(*) filter (where unit_cost_cents = 0) as at_zero,
       min(unit_cost_cents), max(unit_cost_cents)
from inventory_cost_layers where tenant_id = '<juniper row>' group by 1;
```

| source    | layers | units | at zero | min  | max   |
| --------- | ------ | ----- | ------- | ---- | ----- |
| `count`   | 72     | 427   | **72**  | 0    | 0     |
| `return`  | 4      | 4     | **4**   | 0    | 0     |
| `receipt` | 5      | 102   | 0       | 3.84 | 18.63 |

Every count-sourced layer and every return-sourced layer is exactly zero. Not
most: all of them, on every tenant. That is a machine writing a placeholder into
a NOT NULL column, not a shop saying its stock was free
([[project_defaults_written_by_a_machine]]).

## The cause

`valuationAsOf` asks whether a unit is COVERED by a cost layer, and answers yes
for a layer that says nothing:

```sql
SUM(GREATEST(0, l.quantity - COALESCE(c.taken, 0))) AS units_covered
```

`uncostedUnits` is then `totalUnits - totalUnitsCovered`, so with 491 units held
and 491 units "covered", the answer is zero and the screen states it as fact.

A stock count knows the quantity and cannot know the price. A return puts a unit
back on the shelf with no purchase behind it. Both are exactly the case this
report exists to report, and both were being counted as answered.

The file's own header already had the rule right:

> _The report says how many rather than quietly valuing them at zero or silently
> dropping them — a valuation that does not admit its own gaps is the kind an
> audit finds for you._

The SQL did not implement it, and a doc comment on `uncostedUnits` read "Zero is
the normal answer", which is how the reassurance survived being read. Both are
refreshed: zero is now described as a claim worth checking rather than the
resting state.

## Not one shop

| tenant                     | units | says uncosted | actually uncosted | value      |
| -------------------------- | ----- | ------------- | ----------------- | ---------- |
| **Juniper Row**            | 491   | **0**         | **393**           | $967.92    |
| WizeWorks LLC              | 939   | 0             | 160               | $25,474.23 |
| Ironclad Fleet Supply      | 94    | 0             | **94**            | **$0.00**  |
| Sable Thyme                | 77    | 0             | 53                | $132.00    |
| Circuit & Byte Electronics | 46    | −1 → 0        | **46**            | **$0.00**  |
| Forge Fitness Studio       | 30    | 0             | **30**            | **$0.00**  |
| Thistle & Rye              | 12    | −5 → 0        | **12**            | **$0.00**  |

Eight tenants were told every unit had a cost behind it. For four of them that
sentence sat beside a stock value of **$0.00**, which together reads "your stock
is genuinely worth nothing" rather than "nobody has said what it cost" — the
precise distinction [[feedback_never_present_absence_as_measurement]] exists for.

## The fix

One shared SQL fragment, `LAYER_CARRIES_A_COST`, used by both walks:

```ts
const LAYER_CARRIES_A_COST = Prisma.sql`l.unit_cost_cents <> 0`;
```

Shared rather than written twice on purpose. The per-row walk and the totals walk
are separate queries over the same ledger, and a rule living in one of them is a
rule that disagrees with itself the first time somebody edits one — which is the
shape of [[feedback_a_fix_leaves_its_neighbour_behind]], five times this session.

**The layer is still written.** A count genuinely knows that units arrived, and
the layer is the truthful record of the arrival and still orders the FIFO queue
correctly. What it must not do is make the stock look valued. `writeCostLayer`
now carries a comment pointing at the read rule, so the zero it writes is not
mistaken for a bug later.

**A genuinely free unit now reports as uncosted.** That is the safe direction: it
admits an unknown rather than asserting a worth, and the unit appears on the
uncosted screen where its owner can confirm the zero.

## Proven

Her screen now reads:

> **Units with no cost behind them**
> _393 units counted with no purchase behind them. They are valued at nothing
> here; an opening balance in your books may not have_
> 393 units · **Not known**

393 is the measured figure, and "Not known" is an amber badge rather than a
dollar amount, because `amountCents` is deliberately null and not zero.

1 guard added to `costing.test.ts` — a count of 40 beside a delivery of 10 at
$5.00 — proven red by removing the filter: `totalUnitsCovered` came back 50
instead of 10. 15 integration tests pass, 367 inventory tests pass.

## Still open

`uncostedUnits` is `Math.max(0, totalUnits - totalUnitsCovered)`. That clamp was
hiding a real disagreement on two tenants before this fix (Circuit & Byte at −1,
Thistle & Rye at −5): more units sitting in layers than the movement ledger says
are held. Both go positive under the fix and no tenant clamps today, but the
clamp still swallows the next one silently. Surfacing it is a new reconciling
line, which is a decision about the screen rather than a defect in it.
