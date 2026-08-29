# 322 — Her only buyers were at the bottom of a list sorted by recent order

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · the run-wide **Speed at real volume** record
**Surface:** mypiggles › Customers, and the win-back question anywhere it is asked
**Filed:** 2026-08-29
**Fixed:** 2026-08-29
**Confirmed by:** reopened Customers as Devi — her buyers now lead the list, newest order first

## What happened

Opening **Customers** to see how the list feels at her volume, the sort control
already read **Recent order** — the sensible default, and the one Devi wants:
who bought, most recently.

The first screen was ten people, every one of them:

| Name            | Stage | Total spent | Last order |
| --------------- | ----- | ----------- | ---------- |
| Rafael Duarte   | Lead  | $0.00       | —          |
| Ingrid Cole     | Lead  | $0.00       | —          |
| Beatriz Salgado | Lead  | $0.00       | —          |
| … seven more    | Lead  | $0.00       | —          |

Scrolling to the end of all 30, the **last row** was:

| Ravi Naidoo | **Customer** | **$138.00** | **Aug 27, 2026** |

The one person on the list who has actually bought something is in position 30
of 30, under a sort called "Recent order".

## What should have happened

"Recent order" puts the most recent order first. People who have never ordered
come last, because they have no order to be recent.

## How to reproduce

Every time, on any business with a mix of buyers and leads.

1. Open **Customers**.
2. Leave the sort on its default, **Recent order**.
3. Everyone with a dash in the Last order column is listed before everyone with
   a date in it.

## Why it matters

**The default sort buries the answer to the question the screen exists for.**
Devi has 340 orders a year and a list of 1,900 people; her buyers will always be
the minority. A sort that puts every non-buyer first means the customers list
opens, permanently, on the people who have never given her any money. At 1,900
contacts she would never scroll far enough to find one.

**It silently empties the win-back tool.** This is the sharper half.
`get_inactive_customers` — "customers who have ordered before but not in the last
N days, useful for win-back campaigns" — asks for the first 50 rows sorted by
`lastOrderAt`, then discards the ones with no order:

```ts
const { items } = await customerService.list(ctx, { take, sortBy: 'lastOrderAt' });
return items.filter((c) => c.lastOrderAt !== null && c.lastOrderAt < cutoff);
```

Sorted nulls-first, those 50 rows **are** the people who have never ordered, so
the filter throws all 50 away. On Juniper Row, with 29 non-buyers, it returns
**zero every time**. A business asks who it should win back and is told nobody —
which is [[feedback_never_present_absence_as_measurement]] with a marketing
campaign attached: an empty win-back list reads as "everybody is still active."

**And the filter is wrong even after the ordering is fixed.** Filtering in JS
after `take` means the query returns the 50 MOST recent buyers, and the cutoff
then discards exactly the ones who are still active — so a business with more
than 50 buyers gets an empty or arbitrary list regardless. The condition belongs
in the query.

## Where it lives

[wizeworks/packages/crm/src/services/customer-service.ts](../../../../wizeworks/packages/crm/src/services/customer-service.ts)
— one line:

```ts
orderBy: { [sortField]: 'desc' },
```

PostgreSQL sorts `DESC` **NULLS FIRST** — a null is treated as the largest value
— so any nullable sort column puts its empty rows at the top. Of the five sort
fields only `lastOrderAt` is nullable (`DateTime?`); `score` and `totalSpent`
carry `@default(0)` and `createdAt` / `updatedAt` are required, which is why this
is invisible on every other sort and why nobody caught it.

[wizeworks/packages/crm/src/mcp/read-tools.ts](../../../../wizeworks/packages/crm/src/mcp/read-tools.ts)
— `get_inactive_customers`, quoted above.

## The fix

**Two changes, both in shared platform code, so every consumer of this list gets
them at once** — the console, REST, GraphQL and MCP all wrap `customerService`.

**1. Nulls last, on every sort.**

```ts
orderBy: { [sortField]: { sort: 'desc', nulls: 'last' } }
```

Applied to all five fields rather than special-casing `lastOrderAt`. Only that
one is nullable today, and writing the rule once means the day somebody makes
another field optional the list does not quietly reorder itself.

**2. The win-back cutoff becomes a `WHERE`.** `ListCustomersFilter` gains
`lastOrderBefore?: Date`, applied as `lastOrderAt: { lt: cutoff }`. A SQL
comparison never matches a null, so never-ordered customers are excluded by the
comparison itself — there is no second filter and no page spent on rows that were
always going to be discarded. `get_inactive_customers` now passes the cutoff and
returns what comes back.

**Checked the siblings.** `automation-triggers.ts` already writes
`lastOrderAt: { not: null, lt: cutoff }` into its own `where`, so the scheduled
win-back automation was never affected — it was the on-demand tool and the list
that were.

## Confirmed by

Driven as Devi on 2026-08-29, on the same screen, with the sort control left
exactly where it was.

**Juniper Row Archive** — the list that found it. Ravi Naidoo, the only person on
it who has bought anything, moved from **row 30 of 30** to **row 1**, with the 29
never-ordered leads behind her.

**Juniper Row (primary)** — 34 customers, which proves the ordering among several
dates rather than one date against nulls:

| #   | Name               | Stage    | Total spent | Last order   |
| --- | ------------------ | -------- | ----------- | ------------ |
| 1   | Marguerite Adeyemi | Customer | $72.00      | Aug 28, 2026 |
| 2   | Anneliese Vogt     | Customer | $0.00       | Aug 28, 2026 |
| 3   | Ravi Naidoo        | Customer | $138.00     | Aug 27, 2026 |
| 4   | Rowan Ellery       | Customer | $0.00       | Aug 26, 2026 |
| 5   | Jo Kim             | Customer | $105.00     | Aug 25, 2026 |
| 6   | Tessa Wren         | Customer | $0.00       | Aug 24, 2026 |
| 7   | Saoirse Nolan      | Lead     | $0.00       | —            |

Six buyers, newest first, then everybody who has never ordered. That is what the
control has always said it does.

**It also made a second defect visible**, which is the point of putting the
buyers where they can be seen: three of the six — Anneliese, Rowan and Tessa —
show **$0.00 spent** beside a real order date. Filed separately as [323].

## Rating effect

To be recorded against `Customers › list` once re-scored.
