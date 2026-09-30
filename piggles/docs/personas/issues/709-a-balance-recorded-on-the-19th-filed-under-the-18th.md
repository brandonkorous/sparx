# 709 — A balance recorded on the 19th, filed under the 18th

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 249
**Surface:** mypiggles + sparx — Stock › Stock versus your books
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen, plus a test proved red
**Blocked on:** —

## What happened

Devi typed what her accountant's stock account says, with the pane's date picker
reading **09 / 19 / 2026**, and pressed **Record it**. The row it saved:

| As at      | Account            | Where it came from | Balance   |
| ---------- | ------------------ | ------------------ | --------- |
| **Sep 18** | 1200 Stock on hand | Typed in           | $1,390.89 |

The database was right. `as_of` is `2026-09-19`. The screen was wrong.

## Why it matters

On this pane the day is the row's **identity**. The table is unique on
`(tenant_id, as_of, account_name)`, and the copy under the form promises it:

> Recorded per date, so last year's reconciliation keeps saying what it said.

So a person looking at "Sep 18" and correcting it is editing the 19th. Two
reconciliations a day apart are one row. A year-end figure filed under the wrong
side of the year end is a year-end figure in the wrong year.

**Both halves were wrong, in opposite directions.**

_Coming back_, a `@db.Date` arrives from Prisma as midnight UTC and was sent as
`2026-09-19T00:00:00.000Z`, then drawn by `<Timestamp>`, which renders a moment
where the reader is. Seven hours behind UTC, that is the 18th. `<Timestamp>` is
not at fault: it is for moments, and a calendar date is not one.

_Going out_, the picker sent `new Date(picked).toISOString()`. A shop owner in
London recording a balance at 00:30 filed it under **yesterday**; one in Los
Angeles recording one at 6pm filed it under **tomorrow**.

```
@db.Date columns on the schema      32
```

Every one of them is a day somebody chose: an expected close date, a holiday, a
shift worked, a certificate's expiry, a contract's effective-from, a rollup's
bucket. Every one shifts a day for half the world the moment it travels as an
instant.

## What was changed

**A calendar date travels as `YYYY-MM-DD` and nothing parses it into a local
time.** `calendar-date.ts` in `@wizeworks/inventory` holds the server half
(`calendarDate`, `calendarDateOrNull`, `calendarDateToUtc`,
`calendarDayEndUtc`); `components/calendar-date.tsx` holds the console half, a
`<CalendarDate>` that formats with `timeZone: 'UTC'` so no shift is possible.

The API takes a day instead of a timestamp, and still accepts a full timestamp
from a client written before it did.

**And "as at" now means the end of the day.** The first cut of this fix sent
`2026-09-19` and the route read it as midnight, which silently dropped
everything that happened on the 19th — the reconciliation went from **It
reconciles** to **$197.37 is unexplained** on figures that had not changed. An
accountant means the close of business on the 30th, not the instant it began.
`calendarDayEndUtc` is that, and it is a separate function from
`calendarDateToUtc` so a caller has to say which it wants.

## Also on this pane: what the top figure covers

> **What we make it** · 498 units on hand · **$1,064.49**

375 of Devi's 498 units have no cost recorded against them, so the figure is
built from 123 of them. The screen says so, in the uncosted line, five rows
further down and after the total has already been read. The top row is where a
reader forms the impression of what her stock is worth.

It reads **123 of 498 units on hand** now.
[[feedback_never_present_absence_as_measurement]]

## Guarded

`calendar-date-words.test.ts` asserts the day SURVIVES rather than asserting a
formatted string, which would only pass in one zone and hide the bug in every
other. Dropping `timeZone: 'UTC'`:

```
× draws the day that was stored, whatever zone the reader is in
    AssertionError: expected 'Sep 18, 2026' to contain '19'
× does not slip on the first of a month, which is where it slips
× does not slip on the last of a month either
```

`gl-reconciliation-lines.test.ts` gained the covering-cell case; reverting it:

```
× names the units actually behind it when some have no cost
    AssertionError: expected '498 units on hand' to be '123 of 498 units on hand'
```

## Raised upstream

`<Timestamp>` has `relative` and `absolute`, both of which are about moments.
There is no `day`. Every console with a date-only column will reach for
`absolute` and get this bug, and the fix that propagates is a silicaui variant
rather than a component per console. Same shape as
[696](696-the-new-guard-cried-wolf-on-a-cold-start.md): an ask, not a patch.
