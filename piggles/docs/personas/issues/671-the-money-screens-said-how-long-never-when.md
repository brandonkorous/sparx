# 671 — The money screens said how long, never when

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 240
**Surface:** mypiggles › Stock › What suppliers billed you, and a supplier invoice
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03, on the screen — see below
**Blocked on:** —

## What happened

Devi opened **What suppliers billed you** to work out what to pay this week. Four
invoices, $1,626.72 owed. The Due column said:

> in 11 days · in 20 days · in 20 days · in 21 days

She opened the queried one. The three figures across the top said:

> **They are asking for** $684.00 · **The check** 1 line(s) do not agree ·
> **Due** in 3 weeks — _Invoiced last week_

**There is no date anywhere on either screen.** Not on the list she works the
payment run from, and not on the invoice she is deciding whether to pay.

`dueAt` and `billedAt` were on the row the whole time. Nothing drew them.
[[feedback_fetched_but_never_rendered]]

## The other screen already does it

**Money › Bills to pay** does the same job for costs, and its Due column has
always carried both: the countdown badge AND `formatDay(bill.dueAt)` underneath.
Two screens, one job, and only one of them can be used to write a check.

## What should have happened

A countdown is the right way to SORT a payment run and the wrong way to record
one. "In 20 days" read on Tuesday is wrong by Thursday, and it is not something
anybody can put on a check, quote to a supplier, or set a reminder for.

Both, then: the badge keeps the urgency and its color, and the date sits under
it.

## How to reproduce

Before the fix, every time:

1. Sign in as `p03.devi@piggles.test`, Juniper Row.
2. **Stock › What suppliers billed you** — the Due column is a badge and nothing
   else.
3. Open any invoice — "Due: in 3 weeks", "Invoiced last week", no dates.

## Why it matters

Paying a supplier late costs a relationship and sometimes a discount; paying
early costs cash flow. Both decisions need the day, and the screen that exists to
make them was the one screen that would not say it.

Same shape as [668](668-it-told-me-how-late-but-never-what-day.md), one surface
along: two restatements of "how long" and no "when". That one was on the overdue
list; this one is on the money.

## Where it lives

| What                            | Where                                                                      |
| ------------------------------- | -------------------------------------------------------------------------- |
| Due column, badge only          | `piggles\|sparx/apps/workbench/surfaces/inventory/supplier-bills-list.tsx` |
| Three figures, no dates         | `…/supplier-bill-detail.tsx`                                               |
| The date was already on the row | `…/supplier-bills-data.ts` — `dueAt`, `billedAt`                           |

## The fix

**The list.** The countdown badge keeps its place and its color — `dueTone` is
the only thing on the row that says "this one is overdue" at a glance — and the
day sits under it, in the same two-line shape the Invoice column beside it uses.

**The invoice.** The headline stays the countdown, because that is the right
thing to read first. Its sub-line carried "Invoiced last week"; it now carries
both dates:

> **in 3 weeks**
> October 9, 2026 · invoiced September 9, 2026

A paid invoice says when it was paid instead, which was also missing: the value
read "Paid" and nothing said when.

**Both use `formatDay`**, which reads a stored day in UTC —
see [670](670-the-date-i-typed-came-back-a-day-earlier.md), fixed in the same
act. A due date printed on the reader's own clock would have been a day early
here too.

**And the overdue list stopped using a Timestamp for a date.**
`<Timestamp format="absolute">` renders "5:00 PM" for anything less than a day
old, which is not a date at all, and prints a stored day on the reader's clock.
The column now picks its formatter from what the value IS: the date on an order
is a day, a date worked out from how long a supplier usually takes is an instant.

## Confirmed by

> **What suppliers billed you** now reads, per row: "in 11 days / **September
> 30, 2026**", "in 20 days / **October 9, 2026**", "in 21 days / **October 10,
> 2026**".
>
> **AM-2231** reads "**in 3 weeks** — October 9, 2026 · invoiced September 9,
> 2026".

## Rating effect

Recorded in [rating.md](../rating.md):

- `Stock › What suppliers billed you — Design 8 · Ease 7`, first scored this act
- `inventory.supplier-bills.detail` — Ease 8, the dates recorded on the row
