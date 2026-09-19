# 575 — Two dropship screens describing a business I do not have

**Status:** fixed and proven on screen
**Severity:** medium
**Found by:** Devi, walking the Dropshipping menu
**Surface:** `piggles|sparx/apps/workbench/surfaces/dropship/{orders-list,profitability}.tsx`
**Filed:** 2026-09-16
**Follows:** [574](574-swept-for-the-rest-of-the-empty-queue-lie.md)
**Family:** [[feedback_one_outcome_two_causes]] · [[feedback_a_fix_leaves_its_neighbour_behind]]

## What she saw

Dropshipping has three panes. She has connected no supplier.

**Supplier products** told her the truth and gave her the way out:

> **No suppliers connected**
> Supplier products appear once you connect a supplier and sync its catalog.
> **[Connect a supplier]**

**Supplier orders** did not:

> **No supplier orders yet**
> When a customer buys a product **one of your suppliers** ships, the order is
> routed to that supplier and appears here with its tracking. Nothing has been
> routed yet.

**Profitability** was worse:

> **No dropship sales in this period**
> Once customers buy products your suppliers ship, this fills with your profit,
> your margin, and how each supplier is doing. **Try a longer period above, or
> check back after your next sale.**

## Measured

```sql
select count(*) from dropship_suppliers where tenant_id = '…juniper row…';  -- 0
```

|                                       |        |
| ------------------------------------- | ------ |
| tenants with Dropshipping switched on | **12** |
| of those, with no supplier connected  | **11** |

So for almost every reader, both screens describe somebody else's shop.

**The profitability advice is the sharper defect, because both remedies it
offers are dead ends.** A longer period cannot contain a sale no supplier could
have shipped, and "check back after your next sale" waits for something that can
never arrive. One outcome, two causes, and the message only ever names the cause
with the easy fix.

And the orders pane **already had the supplier list in its hand** — it fetches
`useSuppliers()` for the filter dropdown a few lines above, and never asked it
this question ([[feedback_fetched_but_never_rendered]]).

## The fix

`dropship-empty.ts`, one pure module for both panes.

**Supplier orders**, now, verified in the browser:

> **No supplier is connected**
> An order is routed here when a customer buys something a supplier ships for
> you. You have not connected a supplier yet, so nothing can be routed. Connect
> one, import the products you want to sell, and their orders land here with the
> tracking.
> **[Connect a supplier]**

**Profitability**, now, verified in the browser:

> **No supplier is connected**
> This weighs what a supplier charges you against what your customers pay. You
> have not connected a supplier yet, so there is nothing to weigh, and **a longer
> period above will not change that**. Connect a supplier and import a product to
> sell.
> **[Connect a supplier]**

Singular and plural get their own branch, so one supplier reads "your supplier
ships" rather than "one of your suppliers". A narrowed list keeps its own answer
whatever the supplier count, because a filter matching nothing says nothing about
setup.

The profitability pane fetches `useSuppliers()` on the same query key the two
sibling panes use, so it is free whenever either is open and one small request
otherwise.

## Proven

**`dropship-empty.test.ts`** — 8 tests, both consoles, including two properties:
the connect button appears exactly when there is nothing to connect from, and a
sentence written for somebody who already routes orders may not be shown to
somebody who cannot route one. That second one caught a first draft of my own
copy, which said "one of your suppliers" inside the zero-supplier branch.

Removing both zero branches:

```
× says no supplier is connected rather than that nothing has been routed
× does not send someone with no supplier to look at a longer period
× only offers the connect button when there is nothing to connect from
× never speaks of the reader having suppliers when they have none
    your suppliers in "When a customer buys a product one of your suppliers
    ships, the order is routed to that supplier…": expected true to be false
```

**4 of 8 red.**

|                 |                         |
| --------------- | ----------------------- |
| piggles console | **437 pass** (52 files) |
| sparx console   | **349 pass** (43 files) |
| typecheck       | both exit 0             |
| lint / prettier | clean                   |
