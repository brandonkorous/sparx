# 534 — Two tabs told her opposite things about the same five bills, and both were false

**Status:** fixed and proven
**Severity:** high
**Found by:** Devi, checking what she owes before the weekend
**Surface:** `piggles|sparx/apps/workbench/surfaces/finance/bills-to-pay.tsx`, `finance/format.ts`
**Filed:** 2026-09-16
**Family:** [465](issues) — the first half of this same screen's honesty about dateless costs

## What she saw

Money → Bills to pay. Five unpaid costs, $2,158.70, every row badged **No due
date**. She clicked the two other tabs:

> **Late**
> Nothing is late
> _Every bill you owe is still within its due date. Switch to All to see them._

> **Coming up**
> Nothing coming up
> _Everything outstanding is already past its due date. Switch to All to see the lot._

Three seconds apart. The two sentences contradict each other, and neither is
true: not one of her bills has a due date, so none of them is inside one and none
is past one.

**The Late one is the damaging half, because it reads as reassurance.** Devi owes
$2,158.70 that nothing on this platform will ever flag, and the screen told her
every bill she owes is still in good time. The one screen whose job is to warn
her said there was nothing to warn about.

## Measured first

```sql
select count(*) filter (where due_at is null)     as no_due,
       count(*) filter (where due_at is not null) as with_due
from finance_expenses where paid_at is null group by tenant_id;
```

Two tenants on this platform have unpaid costs. **For both, every single unpaid
cost has no due date** — so the false sentence was reachable 2 times out of 2,
and true 0 times out of 2. It is not an edge case; it is the ordinary state of a
business that records costs the fast way.

## Why

Both tabs filter on `dueAt`:

```ts
if (band === 'overdue') return bills.filter((row) => row.late !== null && row.late > 0);
if (band === 'due_soon') return bills.filter((row) => row.late !== null && row.late <= 0);
```

Each `!== null` is correct. The empty state underneath then guessed its reason
**from the name of the tab it was standing in**, never from the data:

```tsx
title={band === 'overdue' ? 'Nothing is late' : 'Nothing coming up'}
description={band === 'overdue'
  ? 'Every bill you owe is still within its due date. …'
  : 'Everything outstanding is already past its due date. …'}
```

So each tab asserted the only reason it could imagine for its own emptiness. An
empty "Late" has two causes with **different remedies**: nothing is late (good
news, do nothing), or nothing has a date to be late against (a standing gap, and
the tab will stay empty for ever until she opens a cost and sets one). The copy
only knew the first, and the quick-add that produced all five of her costs never
asks for a due date, so the second is the common one.

The screen's header comment already warned about exactly this half of the problem
for the total, from issue 465: _"a cost with no due date is not late, it is simply
unpaid."_ The guard went into the arithmetic and into the aging bar. It did not
go into the sentence. [[feedback_a_fix_leaves_its_neighbour_behind]].

## Fixed

`billsEmptyState(band, { dated, undated })` in `finance/format.ts`, both consoles.
It decides from the counts, not the tab name, and when nothing is dated both tabs
say the **same** thing, because the cause is the same:

> **Nothing has a day to pay it by**
> This tab watches due dates, and none of your 5 unpaid costs has one, so nothing
> will ever show here. Open a cost and fill in "Due by" to have it watched. Switch
> to All to see them.

When bills _are_ dated, the claim is scoped to the rows the tab can actually see:
"Every bill **with a day to pay it by**" rather than "every bill you owe", so it
stays true in the mixed case as well.

A rule inside a React component cannot be tested, which is why this one rotted
through issue 465 untouched. It is now a leaf function with 8 guards in
`bills-empty-state.test.ts`. **All 8 go red** when the shipped copy is put back.

Also corrected: "Switch to All to see the lot" was British idiom.

## Files

- `piggles|sparx/apps/workbench/surfaces/finance/format.ts` — `billsEmptyState`
- `piggles|sparx/apps/workbench/surfaces/finance/bills-to-pay.tsx` — uses it
- `piggles|sparx/apps/workbench/surfaces/finance/bills-empty-state.test.ts` — new, 8 guards each
