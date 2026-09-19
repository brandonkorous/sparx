# 670 — The date I typed came back a day earlier

**Status:** fixed
**Severity:** blocker
**Found by:** P03 · Juniper Row · act 240
**Surface:** mypiggles › Stock › Orders to suppliers › (an order) — "When it is expected" and "Order details"
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03, on the screen — see below
**Blocked on:** —

## What happened

Ashcombe had given Devi a new date for PO-000004, so she opened the order and
typed it into **New expected date**:

> `09 / 10 / 2026`

She pressed **Record it**. The console said:

> **New date recorded**
> If they miss this one too, you will hear about it.

The panel three inches above it, on the same screen, at the same moment:

> **Expected**
> **September 9, 2026**

She had typed September 10. The order says September 9.

Nothing failed. Nothing was refused. The date she gave her supplier and the date
her console shows her supplier are one day apart, and the only way to notice is
to read both halves of one screen at once.

## Why

**The order has two controls on one field, and they disagreed about what a day
is.**

| Control                                | Where                            | What it stored for "10 September"                                 |
| -------------------------------------- | -------------------------------- | ----------------------------------------------------------------- |
| **New expected date** (the card below) | `purchase-order-procurement.tsx` | `2026-09-10T00:00:00.000Z` — midnight UTC                         |
| **Expected** (the field on a draft)    | `purchase-order-detail.tsx`      | `2026-09-10T07:00:00.000Z` — midnight where the buyer is standing |

And the thing that PRINTS it, `formatDay`, rendered in the reader's own zone. So
midnight UTC, read in Los Angeles, is five o'clock the previous evening, and the
day loses one.

MEASURED in the browser, 2026-09-18, `America/Los_Angeles`:

```text
new Date('2026-10-09T00:00:00.000Z').toLocaleDateString(undefined, {…})
  → "October 8, 2026"      ← Buying's formatDay
  → "Oct 9, 2026"          ← finance's formatDay, which passes timeZone: 'UTC'
```

`finance/format.ts` has carried that `timeZone: 'UTC'` and a paragraph explaining
exactly this for months. `lib/today.ts` carries the same warning a second time,
on `dayMiddayUtc`, written for invoicing when invoicing met the same bug. Buying
is the third area to meet it and the first not to have been told.
[[feedback_a_fix_leaves_its_neighbour_behind]]

**Which control was right?** Neither, on its own. UTC midnight is the platform's
convention for a day-valued column — it is what finance stores and what
`daysPastDue` counts against — so the WRITER in the card was correct and the
other writer and the reader were not.

## A second day count, in the same act

**Overdue deliveries** then said PO-000004 was **9 days** late against a date of
10 September, read on the evening of the 18th. Her calendar says 8.

The server counts elapsed seconds:

```sql
FLOOR(EXTRACT(EPOCH FROM (now() - o.due_at)) / 86400)::int AS "daysLate"
```

At 18:25 in Los Angeles it is already the 19th in UTC, so the subtraction crosses
a midnight she has not reached. `lib/console/days.ts` exists for precisely this,
opens with **"THE RULE: compare CALENDAR DAYS, never elapsed milliseconds"**, and
says the rule had already been written twice before that file existed. The
overdue list did not use it.

## What should have happened

A day she types is the day she reads back, on any screen, from any chair. A count
of days late is the number she would count off her own calendar.

## How to reproduce

Before the fix, from any zone west of Greenwich:

1. Sign in as `p03.devi@piggles.test`, Juniper Row.
2. Open a placed order, scroll to **When it is expected**.
3. Type a date and press **Record it**.
4. Read **Expected** in the Order details panel above. It is the day before.
5. Open **Stock › Overdue deliveries** after five in the afternoon. The day count
   is one higher than the calendar's.

## Why it matters

**An expected date is a promise a buyer quotes down a phone.** Devi rings
Ashcombe on the 11th to ask where her linen is; her screen says it was due on the
9th, Ellen's paperwork says the 10th, and one of them is wrong about which. It is
a small argument that makes the console the untrustworthy party in every later
one.

It is worse than a display bug because it also feeds the overdue sweep: the order
becomes "late" a day early, every time, for everybody.

And this is the SECOND defect on this field in two acts. [667](667-i-could-not-type-the-date-it-asked-me-for.md)
was that the box would not take a date at all. Fixing the box exposed what
happens once a date gets in. [[feedback_screen_over_a_function_nobody_calls]]

## Where it lives

| What                                | Where                                                                                               |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| Wrote local midnight                | `piggles\|sparx/apps/workbench/surfaces/inventory/purchase-order-detail.tsx` — `date.toISOString()` |
| Read a stored day locally           | `…/purchase-orders-data.ts` — `formatDay` with no `timeZone`                                        |
| Read a stored day into the control  | `purchase-order-detail.tsx` — `new Date(draft.header.expectedArrivalAt)`                            |
| Counted lateness in elapsed seconds | `…/late-orders.tsx`, trusting the server's `daysLate`                                               |

## The fix

**1. One way to store a picked day.** `pickedDayUtc(date)` in `lib/today.ts`,
beside `dayStartUtc` and `dayMiddayUtc` which were already there for the same
reason. It takes the day the person SAW in the control and stores that day.
`dayFromStored(iso)` is its inverse, for handing a stored day back to a date
control without the instant dragging it over a midnight.

**2. `formatDay` reads in UTC, and instants get their own formatter.** The old
one was doing both jobs. A delivery booked in at half past four on Tuesday
happened on Tuesday, for her, so `formatMoment` keeps the reader's clock and
`formatDay` keeps the day. Three call sites moved to `formatMoment` (an order
placed, a delivery received twice) and two stayed on `formatDay` (expected
arrival, twice). One of the two was wrong before and is right now; the other
three were right before and would have broken.

**3. Every day-valued writer in Buying uses it.** The order's Expected field, the
dispatch note's "They say it lands", and a making run's "Planned for" — all three
wrote local midnight through `toISOString()`, and the last one read it back
locally too, so it round-tripped correctly for its author and for nobody else.

**4. Lateness is counted in calendar days, in the shop's zone.** The overdue list
now calls `daysPastDue(row.dueAt, now, businessZone)` — the helper that already
exists, with its own tests — and keeps the server's figure only as the fallback
for a row with no due date to count from.

**Proved red.** Six new guards in `lib/today.test.ts`, built with the LOCAL date
constructor so they say the same thing on every machine including a UTC one.
Putting the old `toISOString()` back fails **3 of them**; the round-trip guard
alone stays green, because a broken writer and a broken reader cancel out — which
is exactly why the absolute assertions are there.
[[feedback_a_test_that_cannot_go_red]]

## Confirmed by

Re-ran act 240 on the screen:

> Typed `09 / 10 / 2026` into **New expected date**, pressed **Record it**. Order
> details now reads **September 10, 2026**.
>
> **Overdue deliveries** reads "PO-000004 · Ashcombe Mills · against the date on
> the order · passed to your other software — **8 days** · **September 10,
> 2026** · 24 · $576.00".

Before the fix the same two screens said September 9 and 9 days.

## Rating effect

Recorded in [rating.md](../rating.md):

- `inventory.purchase-orders.detail` — Ease held at 4 (it is still waiting on the
  silicaui release for [667](667-i-could-not-type-the-date-it-asked-me-for.md));
  this defect is recorded on the row
- `inventory.purchase-orders.late` — Ease 8, the day count corrected
