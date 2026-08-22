# 080 - An invoice two weeks late said "Due today", next to a chip saying "Late"

**Status:** fixed
**Severity:** major
**Found by:** P01 · Thistle & Rye · standing checks - dates, immediately after [079](079-the-invoice-she-sends-a-cafe-has-no-way-to-say-when-its-due.md)
**Surface:** mypiggles › Invoices, the Due column
**Filed:** 2026-08-21
**Fixed:** 2026-08-21
**Confirmed by:** P01 · Marisol · on screen 2026-08-21

## What happened

The moment an invoice could have a due date in the past ([079](079-the-invoice-she-sends-a-cafe-has-no-way-to-say-when-its-due.md)),
one row of her list said two different things about it:

| Number     | Customer         | Due           | Status   | Balance |
| ---------- | ---------------- | ------------- | -------- | ------- |
| INV-000002 | The Reading Room | **Due today** | **Late** | $624.00 |

It was due **2026-08-07**. That is fourteen days earlier.

## Why it matters

Of the two, **"Due today" is the damaging one**: it reads as nothing-to-do-yet,
on $624 that a cafe has owed for a fortnight. The Due column is the one she sorts
by, and it is the default sort, so the column that decides what looks urgent is
the column that was lying.

Two columns on one row disagreeing also costs more than either being wrong alone.
She has no way to tell which to believe.

## The cause

`overdue_days` is a **stored integer column with a default of `0`**, and nothing
recomputes it as time passes. Saving the past due date flipped
`status` to `overdue` (a live comparison, done at write time) and left
`overdue_days` at `0`:

```
number     | status  | due_at                 | overdue_days
INV-000002 | overdue | 2026-08-07 12:00:00+00 |            0
```

`describeDue()` trusted it:

```ts
if (overdueDays > 0) { ...'N days late'... }
const days = Math.ceil((due.getTime() - Date.now()) / 86_400_000);
if (days <= 0) return { label: 'Due today', ... };   // ← fell through to here
```

The intent was sound and documented: _"`overdueDays` is computed server-side, so
the UI never re-derives 'how late is this' and can't disagree with the AR report
about it."_ The flaw is that a **default zero is indistinguishable from a measured
zero** - [[feedback_never_present_absence_as_measurement]]. The UI could not tell
"nobody has counted" from "counted, and it is nought", so it rendered the second.

This is not specific to a hand-typed date. INV-000003 is due 2026-09-04 with
`overdue_days = 0`; the day it goes past, it says "Due today" too.

## The fix

The count comes from the DATE, which is a fact, and the stored value is used only
when it is larger, so the server stays authoritative wherever it has actually
counted:

```ts
const elapsed = Math.floor((Date.now() - due.getTime()) / 86_400_000);
const late = Math.max(overdueDays, elapsed);
if (late > 0) { ...`${late} days late`... }
```

## Confirmed on screen - 2026-08-21

Same row, same data:

| before               | after                       |
| -------------------- | --------------------------- |
| Due today · **Late** | **14 days late** · **Late** |

And the **Late** filter returns it: _Showing 1-1 of 1_.

## Still worth Brandon's call

`overdue_days` remains stale in the database, so anything reading it directly -
the AR report, aging buckets, any dunning that ships later - still sees `0`. The
console no longer depends on it, which stops the visible lie, but the column
either wants recomputing where it is read or removing in favour of the date.
That is `wizeworks/packages/crm`, shared with sparx.
