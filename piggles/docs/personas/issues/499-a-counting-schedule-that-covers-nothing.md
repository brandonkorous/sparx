# 499 — The counting schedule form offered her a setup that covers nothing, and did not say so

**Status:** fixed and proven on screen, both consoles
**Severity:** major
**Found by:** Devi, taking the empty state's advice and setting up a routine
**Surface:** Counting schedules, both consoles + `@wizeworks/inventory` + api-rest
**Filed:** 2026-09-09

## What she saw

The empty state is good. It says what a schedule is for and offers **Set one
up**. She pressed it and got a form already filled in:

| field           | pre-filled with          |
| --------------- | ------------------------ |
| What to call it | Top-value stock, monthly |
| Which location  | **Fulfillment Center**   |
| Which stock     | **Top-value stock only** |
| How often       | Every month              |

Both of the bold ones are wrong for her, and neither is wrong in a way the
screen would ever tell her:

```
Main Warehouse       MAIN    73 stock lines
Fulfillment Center   FC-1     0 stock lines

abc_class C   72
abc_class ␀    1     ← nothing in class A at all
```

**The pre-filled setup covers zero items on two separate counts.** Set it up
saves it happily. Nothing appears wrong. The counts simply never arrive.

That is the one failure this whole feature exists to prevent. The model's own
docblock says it out loud:

> A schedule is the difference between "we cycle count" as an intention and as a
> fact.

A schedule covering nothing turns it back into an intention while looking
exactly like a fact.

## Why the defaults land there

Neither is a considered choice. The location is simply the first row of an
alphabetical list:

```ts
warehouseId: activeLocations[0]?.id ?? '';
```

and the class default is the first entry of the ABC ladder, `'A'`. On a small or
new catalogue, ABC is computed from a year of usage that does not exist yet, so
**everything lands in C** and "top value" is empty by construction. The business
most in need of a counting habit is the one most likely to be handed a schedule
that does nothing.

## The number that would have caught it already existed

The **saved** schedule's detail pane says:

> Every week · 73 items currently covered

The fact was already computed, already rendered, already in the right words. It
was just shown _after_ the decision instead of _during_ it. That is this
codebase's commonest defect shape and it caught the same trap again.

## What changed

A coverage question that can be asked about a setup that is not saved yet:

```
GET /v1/inventory/count-schedules/coverage?warehouse_id=…&abc_class=…
  → { coveredLevels: n }
```

It is the same `inventoryLevel.count` the saved row already runs, lifted into
`countScheduleCoverage` so both callers use one definition. The form asks it as
the setup is typed, and says one of two things under "What it covers":

**When it covers something:**

> 73 items would be covered by this.

**When it covers nothing** — a warning alert, in the house
`Alert > AlertContent > AlertTitle + AlertDescription` composition:

> **Nothing is covered by this**
> There is no stock at this location in this group, so this schedule would never
> raise a count. Try "Everything at this location", or pick the place your stock
> actually sits.

It names both ways out, because there are two independent ways to get here and
telling her only one would send her round again.

## Proven, both branches

Driven on screen as Devi, not asserted:

| setup                                | screen said                              |
| ------------------------------------ | ---------------------------------------- |
| Fulfillment Center + Mid-value stock | **Nothing is covered by this** (warning) |
| Main Warehouse + Everything          | **73 items would be covered by this.**   |

## Deliberately not changed

**The defaults themselves.** Making the form pre-select the location that holds
the most stock needs a per-location stock count the location list does not
carry, and guessing better is not the same as saying what the guess costs. The
sentence is the fix: it makes any default honest, including a bad one.

## Noticed, not fixed

`coveredLevels` on a saved schedule ignores `zoneName`, so a zone-scoped
schedule over-reports what it covers. Pre-existing, and the same arithmetic now
backs the new preview. It wants the bin join that levels do not have.

## Files

- `wizeworks/packages/inventory/src/services/count-schedules.ts`
- `wizeworks/packages/inventory/src/services/inventory-service.ts`
- `wizeworks/services/api-rest/src/routes/v1/inventory/schedules.ts`
- `piggles|sparx/apps/workbench/surfaces/inventory/planning-data.ts`
- `piggles|sparx/apps/workbench/surfaces/inventory/count-schedule-detail.tsx`
