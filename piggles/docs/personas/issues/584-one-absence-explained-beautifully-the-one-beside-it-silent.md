# 584 — One absence explained beautifully, the one beside it silent

**Status:** fixed and proven on screen
**Severity:** low
**Found by:** Devi, on Stock → Cost to keep
**Surface:** `piggles|sparx/apps/workbench/surfaces/inventory/{cover-note.ts,planning-holding.tsx}`
**Filed:** 2026-09-16
**Family:** [[feedback_never_present_absence_as_measurement]] · [[feedback_a_fix_leaves_its_neighbour_behind]]

## What she saw

Cost to keep is one of the best screens in the console. It counts the stock
levels with no cost price and says so, in a warning band above the figures:

> **68 items have no cost price**
> They are left out of everything on this screen, so what your stock is really
> worth (and what it really costs to keep) is higher than these figures say.

Then, in the table underneath, a **Cover** column that is a dash on every single
row, with nothing anywhere saying why.

| Item                   | In stock | Worth   | Cover | Costs a year |
| ---------------------- | -------- | ------- | ----- | ------------ |
| Linen, natural, 200gsm | 40       | $745.20 | **—** | $186.30      |
| Linen Shirtdress XS    | 6        | $348.00 | **—** | $87.00       |
| Brass belt hardware    | 58       | $222.72 | **—** | $55.68       |

The dash is correct — `daysOfCover === null ? '—'` is the house rule working
exactly as intended, and a number would have been the defect. What was missing is
the sentence the screen already knows how to write.

## Measured

Cover needs `inventory_demand_velocity.forecast_per_day`, which only exists once
an item has actually sold.

```sql
select count(*) from inventory_levels where on_hand > 0;                 -- 600
select count(*) from inventory_demand_velocity where forecast_per_day>0; --  13
```

| tenant            | stocked levels | can show cover |
| ----------------- | -------------- | -------------- |
| Threadline        | 434            | **0**          |
| Juniper Row       | 73             | 5              |
| Atlas Supply Co   | 16             | **0**          |
| Harvest Pantry    | 14             | **0**          |
| WizeWorks LLC     | 14             | 7              |
| Wildroot Flowers  | 12             | **0**          |
| The Marrow Review | 8              | **0**          |
| Lumen Studio      | 7              | **0**          |

**Six of the eight businesses with stock cannot show a cover figure on a single
row.** For them the column is a wall of dashes that reads as a broken column
rather than as a thing that needs sales history first.

So the same screen explains one absent measure carefully and is silent about the
other, two columns to its right. The neighbour left behind, on one card.

## The fix

> **23 of these have no cover figure.** Cover is how long the stock would last at
> the rate it has been selling, so an item needs some sales behind it before
> there is anything to work it out from.

Counted from the rows already on screen rather than from a new field on the
response: the answer is in the component's hand, and a count taken anywhere else
could disagree with what the reader is looking at
([[feedback_fetched_but_never_rendered]]).

Three sets of words — some, exactly one, and none at all — because "1 of these
have no cover figure" reads fine in source and only breaks on screen.

Verified in the browser, both consoles.

## Proven

**`cover-note.test.ts`** — 6 tests, both consoles, including a property: every
branch that appears at all must say WHAT cover needs, because a count on its own
reads as a fault in the product rather than as a thing waiting on sales.

Two of them assert the note stays **silent**: a table where every row has a
figure, and an empty table, where the screen's own empty state is doing that job.
Removing the note entirely:

```
× counts the rows that cannot, and stays plural
× says one rather than "1 of these have"
× says so plainly when not one row can show it
× always explains WHY, not just how many
    [{"daysOfCover":null}]: expected null not to be null
```

**4 of 6 red.**

|                 |                         |
| --------------- | ----------------------- |
| piggles console | **480 pass** (57 files) |
| sparx console   | **382 pass** (48 files) |
| typecheck       | both exit 0             |
| lint / prettier | clean                   |
