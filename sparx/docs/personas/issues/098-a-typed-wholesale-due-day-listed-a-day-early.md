# 098 — A typed wholesale due day listed a day early

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 6 (moving in O'Malley's old bill)
**Surface:** workbench › Wholesale › Raise an invoice, and the due date box on a wholesale invoice (both consoles)
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

Doty raised invoice 4471, due Aug 27, 2026. Its own page said Aug 27. The Wholesale invoices list said Aug 26.

## What should have happened

A day typed is that day on every screen, for every reader.

## How to reproduce

Raise an invoice due on any day, then open the list. Before the fix, for any reader west of Greenwich: the list shows the day before.

## Why it matters

The due date decides when a bill is late, which aging column it sits in, and when the account is put on hold. A day early is a chase sent a day early.

## Where it lives

The create form and the due date box stored the picked day at midnight UTC (`dayStartUtc`), which is the evening before in America. The rest of invoicing stores a due day at midday UTC (`dayMiddayUtc`, `lib/today.ts`), the same calendar day in every zone anybody uses.

## The fix

Both boxes store midday UTC, both consoles. Migration `20270530000025_a_wholesale_due_day_is_its_own_day` moves the three trade bills stored at exactly midnight UTC (4471 here, two at Juniper Row) forward twelve hours, to the day that was typed. Applied locally: 3 rows.

Issue 099 covers the same family for due dates worked out from terms, and the list's own formatter.

## Confirmed by

On screen, 2026-10-06, as Doty: the list reads 4471 "Aug 27, 2026", "Late by 40 days", and Owed to you agrees, "40 days late".

## Rating effect

—
