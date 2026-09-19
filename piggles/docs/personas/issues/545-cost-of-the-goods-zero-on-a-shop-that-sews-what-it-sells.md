# 545 — "Cost of the goods: $0.00", on a shop that sews what it sells

**Status:** fixed and proven
**Severity:** high
**Found by:** Devi, reading why she lost money this month
**Surface:** `piggles|sparx/apps/workbench/surfaces/finance/profit.tsx`
**Filed:** 2026-09-16
**Family:** [[feedback_never_present_absence_as_measurement]]

## What she saw

Money → What you kept:

> **You lost $1,432.70** · 197.3% of everything that came in
>
> | line                  | figure    |
> | --------------------- | --------- |
> | Money in              | $726.00   |
> | **Cost of the goods** | **$0.00** |
>
> _"What the stock you sold actually cost you, from your inventory records."_

She cuts and sews everything she sells. The clothes did not cost her nothing.

## Measured

```sql
select count(*) as levels, count(*) filter (where unit_cost_cents is not null) as with_cost
from inventory_levels where tenant_id = '<juniper row>';
```

| stock lines | with a cost recorded |
| ----------- | -------------------- |
| 74          | **0**                |

The sum is over an empty set, and the screen printed the result with the same
confidence it would print $400.

## The platform already knew

Two screens away, Stock → Costing → what has no cost, says it plainly:

> **68 things on your shelves, 375 units in all, have never had a cost recorded,
> so they count as nothing in every figure about what your stock is worth.** Put
> in what one of each cost you and those figures become real.

That is the right sentence. It is on the screen she has no reason to open. The
screen she does open said $0.00.

## Not a wrong number

Her materials are not missing from the report: they are in **Cost of the work**
($308.70), because she records them as costs rather than as stock valuations, and
the rent is in **Running costs** ($1,850.00). The bottom line is right.

What was wrong is the SHAPE. A confident $0.00 against "what the stock you sold
actually cost you" tells a clothes maker that the clothes cost her nothing to
make, and invites her to conclude her materials are pure overhead.

## Fixed

`costOfGoodsNote` in `cogs-note.ts`, both consoles. The line reads the uncosted
count, because only the STOCK can tell a measured zero from an empty one:

| cost of goods | uncosted items | what the line says                                                                                                                                                                     |
| ------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| > 0           | any            | "What the stock you sold actually cost you…"                                                                                                                                           |
| 0             | **> 0**        | **"Nothing here has been measured yet: 68 things on your shelves, 375 units in all, have never had a cost recorded. Until they do, what you make on each sale cannot be worked out."** |
| 0             | 0              | unchanged — a business that sells its time really does have no cost of goods                                                                                                           |

The counts come from the endpoint the costing screen already uses, asked for one
row, since only the totals are wanted.

4 guards per console, including the one that keeps a real $0.00 alone.

## Files

- `piggles|sparx/apps/workbench/surfaces/finance/cogs-note.ts` + `.test.ts` (new)
- `piggles|sparx/apps/workbench/surfaces/finance/profit.tsx`
