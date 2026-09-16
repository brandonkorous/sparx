# 498 — A sale is not a stock check, and the badge that said it was ran backwards

**Status:** fixed and proven on screen, both consoles
**Severity:** major
**Found by:** Devi, opening the Stock list to see her linen land
**Surface:** Stock list + the "where this came from" pane, both consoles + `@wizeworks/inventory`
**Filed:** 2026-09-09

## What she saw

Seventy-three lines of stock. **Sixty-nine of them wore a colored warning
badge, fifty-six of those red.** A dressmaker who had done nothing wrong.

| what the row said | what the badge said |
| ----------------- | ------------------- |
| In stock          | 26 hours old        |
| In stock          | 35 hours old        |
| In stock          | 16 days old         |
| In stock          | 17 days old         |

No tooltip. No legend. No column header explaining it. Just an amber or red
pill saying a number of hours, next to a quantity.

## What it actually measured

The component's own docblock said the badge showed **"how long since anybody
checked"**. It read `ageSeconds`, which is derived from `inventory_levels.as_of`
— _when the quantity was last established_.

**A sale establishes the quantity.** So does an allocation:

```ts
// assembly-orders.ts
data: { allocated: { increment: hold.quantity }, asOf: new Date() },
```

Nobody looks at a shelf when an order is placed. The book number moves and the
badge calls that a check.

## The consequence is an exact inversion

Measured against Devi's ledger — `recount` movements are the only real checks:

```
THE-ASH-OVER-M-SLATE   green, no badge     really counted 16 days ago
THE-ASH-OVER-M-CLAY    green, no badge     really counted 16 days ago
MARLOW-KNIT-L-OAT      green, no badge     really counted 16 days ago
```

**Three lines with no warning at all had gone sixteen days unchecked.** They
sold that day, so they looked fresh.

And the loudest badges were on stock that simply was not selling — the stock at
_least_ risk of having drifted, because nobody had touched it.

What makes a book number drift from the shelf is handling. Handling is what
selling **is**. The badge was silent on exactly the rows that earn a warning and
shouted at the ones that do not.

## The thresholds were invented

```ts
if (ageSeconds < 60 * 60 * 24) return 'success'; // under a day: fine
if (ageSeconds < 60 * 60 * 24 * 7) return 'warning'; // under a week: amber
return 'danger'; // over a week: red
```

Nobody promised to count weekly. Devi had **no counting schedule at all** — the
`inventory_cycle_count_schedules` table held zero rows for her. She was being
marked against a deadline she never set.

The same file already gets this right one function above, for data feeds:

> Returns null when the source never declared a promise to be held to — an
> exempt source with a reassuring green tick would be a lie.

A red badge against a promise nobody made is the same lie pointing the other
way.

## What changed

**A verdict now needs a promise.** `stockAgeTone` is replaced by
`countVerdict(lastCountedAt, intervalDays)`, which returns **null** when no
cycle-count schedule covers the line. No cadence, no deadline, no badge.

**The true fact is now carried.** Two new fields on the stock row and on the
provenance pane:

- `lastCountedAt` — the last `recount` or `sync` movement. Only those two
  re-establish a quantity from something other than the book's own arithmetic.
  A `receive` is deliberately **not** a check: it verifies what came through the
  door, not what is on the shelf.
- `countIntervalDays` — the tightest active schedule covering that warehouse and
  ABC class. Zone-scoped schedules are excluded: a zone covers part of a level,
  so it cannot speak for the whole row.

**The pane states the fact whether or not it judges it:**

> Last counted against the shelf 2 weeks ago.

and the header badge that used to be red is now colorless, because "17 days
since this last moved" is a fact about how fast a line sells, not a fault.

## Proven, both directions

The rule is that a guard which cannot go red is not proven. So it was driven
both ways on screen.

**Silent when it should be.** With no schedule, all 69 badges vanished and the
list read cleanly.

**Red when it should be.** Devi then set up a real routine through the UI —
_Everything at Main, weekly_ — and the badges came back, correctly this time:

| row                     | old badge | truth               | new badge             |
| ----------------------- | --------- | ------------------- | --------------------- |
| Linen, natural (38m)    | _nothing_ | **never counted**   | Never counted         |
| 4× The Ash Overshirt    | **amber** | counted 1 day ago   | _nothing_             |
| Marlow Knit, Shirtdress | red       | counted 16 days ago | Count due 10 days ago |

The pane reads:

> Last counted against the shelf 2 weeks ago. · **Count due 10 days ago**
> You count this every 7 days. It was last counted 17 days ago.

Every row was checked against the database and matched.

## A bug of my own, caught only because it was driven

The first run put **"Count due NaN days ago"** on every row.

`intervalDays === null` is not the test. The field crosses a network boundary
TypeScript cannot see, and a response that does not carry it hands back
`undefined` — which is not `null`, is not `<= 0`, and multiplies into NaN. The
guard now tests for what the value **is**, and an unparseable date returns null
rather than claiming "never counted", because not-known and never are different
sentences.

## Files

- `wizeworks/packages/inventory/src/services/public-api.ts`
- `wizeworks/packages/inventory/src/services/provenance.ts`
- `piggles|sparx/apps/workbench/surfaces/inventory/integrity-data.ts`
- `piggles|sparx/apps/workbench/surfaces/inventory/data.ts`
- `piggles|sparx/apps/workbench/surfaces/inventory/provenance-data.ts`
- `piggles|sparx/apps/workbench/surfaces/inventory/provenance.tsx`
- `piggles/apps/workbench/surfaces/inventory/stock-list-table.tsx`
- `sparx/apps/workbench/surfaces/inventory/stock-list.tsx` (sparx keeps the same
  badge inline rather than in a table component — nearly missed)
