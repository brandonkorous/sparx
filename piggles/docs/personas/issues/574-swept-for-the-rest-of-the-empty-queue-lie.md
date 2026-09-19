# 574 — Swept for the rest of the empty-queue lie, and found three more

**Status:** fixed and proven
**Severity:** high
**Found by:** a source scan, after finding the same defect four times by clicking
**Surface:** `wizeworks/packages/inventory/src/services/backorders.ts` · `piggles|sparx/apps/workbench/surfaces/inventory/backorders.tsx` · `piggles|sparx/apps/workbench/surfaces/commerce/checkout-list.tsx`
**Filed:** 2026-09-16
**Follows:** [569](569-told-my-orders-would-be-held-by-a-limit-i-had-switched-off.md) · [570](570-every-request-has-been-answered-over-a-queue-nobody-has-ever-used.md) · [572](572-two-more-empty-queues-that-said-the-work-had-been-done.md)
**Family:** [[feedback_never_present_absence_as_measurement]] · [[feedback_a_fix_leaves_its_neighbour_behind]]

## Why a scan

Four screens in one afternoon said the same wrong thing: an empty list means two
opposite facts — **everything was dealt with**, or **nothing was ever asked of
it** — and each stated the first over businesses for which the second was true.
Four by clicking is a pattern, not a coincidence, so the rest were found by
reading the copy instead of opening the panes.

A scan over 716 console files for sentences that ASSERT past work is complete,
excluding sentences about the future ("when someone asks, it appears here"),
returned **8 candidates**. Five were already fixed or were fine; three were not.

Two of the five were post-action toasts — "Nothing was due · Every repeating cost
is already up to date" after pressing a catch-up button. A message reporting the
result of something the reader just did is a different thing from a screen
describing their business, and both are true as written. Measured and dismissed.

## Nobody is waiting on stock

> **Nobody is waiting on stock**
> Every order you have taken was covered by stock on the shelf. A commitment
> appears here the moment one is not.

```sql
select count(*) from inventory_backorders;  -- 3 rows, on 1 tenant
```

**34 of the 48 real businesses on the platform have never taken an order at
all**, and every one of them is told every order they took was covered. It reads
as a clean bill of health on a shop that has not opened.

Now, verified on screen:

> **Nobody has ever waited on stock**
> Nothing has ever had to wait for stock. A commitment appears here the moment
> you take an order the shelf cannot cover.

## And, in the same file, two banners that were structurally dead

Reading the backorder service to add the count turned up a second defect. The
console shows two cross-lens nudges:

```tsx
{undatedCount > 0 && lens !== 'undated'  ? <banner "N people are waiting with no date at all"> : null}
{overdueCount > 0 && lens !== 'overdue'  ? <banner "N commitments are past the date you gave"> : null}
```

They are meant to fire **while you are looking at something else**. Both counts
were computed over the lens's own filtered rows, and both of their tests require
`status IN ('open','partial')`:

| lens                      | undated banner       | overdue banner       |
| ------------------------- | -------------------- | -------------------- |
| Waiting (`status = open`) | works                | works                |
| Everything                | works                | works                |
| Undated                   | suppressed by design | works                |
| **Overdue**               | **always 0**         | suppressed by design |
| **Allocated**             | **always 0**         | **always 0**         |

A row cannot be both undated and overdue, and an allocated row is neither, so on
two of the five lenses the nudges could never appear. The service's own doc
comment says what was intended:

> _Counted separately because it is the buyer's actual work list, and because a
> screen that shows "0 overdue" while 40 rows have no date at all is telling a
> comfortable lie._

That is a description of the bug. **Third time today** a comment stated the rule
and the code beneath it did the opposite (the others: `requestedCount` in the
staff route, and the receiving list's own header in [573](573-a-list-of-deliveries-with-no-dates-on-it.md)).

The counts now come from their own query against the tenant, narrowed by what
you are LOOKING at (one item, one place, one customer) and never by the lens.
Their own query and not the row query's `CROSS JOIN tallies`, because those
counts ride on the first row — so an empty list carried no counts at all.

## Every checkout either went through or timed out

> **Nothing half-finished**
> Every checkout either went through or timed out. Nothing is sitting half-paid.

**40 of 48 real businesses have never had a checkout session.** `total` on the
response is the count matching the filter, so an empty "unfinished" view and a
till that has never rung look identical.

Now: "When a shopper starts paying, their progress shows up here… **Nobody has
started one yet.**"

A `take: 1` probe on the same endpoint rather than a new response field — and
gated, so it only fires when the answer could matter (the list is narrowed and
came back empty). The ordinary case makes no extra request at all. `enabled` is
deliberately kept OUT of the query key: it says whether to ask, not what was
asked.

## Proven

**`demand.test.ts`** — one case against real Postgres. It builds an undated open
commitment, asks for the **Overdue** lens (which cannot contain one), and asserts
the undated count still sees it; then checks a variant nothing has ever waited on
reports `everCount: 0`. Restoring the filtered counts:

```
AssertionError: expected +0 to be 1
```

|                 |                                           |
| --------------- | ----------------------------------------- |
| inventory       | **370 pass** (32 files)                   |
| commerce        | **221 pass**                              |
| piggles console | **426 pass**                              |
| sparx console   | **338 pass**                              |
| typecheck       | inventory, commerce, both consoles exit 0 |

## Still open

The scan lives in the scratchpad, not the repo. Making it a permanent check needs
it to tell a guarded claim from an unguarded one — every sentence fixed today is
still in the source, correctly, behind a branch — and a check that cannot see the
branch would report the fixes as failures. The honest version reads the
surrounding conditional, which is a parser job rather than a regex one.
