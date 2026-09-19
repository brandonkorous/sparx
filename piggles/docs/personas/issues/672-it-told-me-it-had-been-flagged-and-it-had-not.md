# 672 — It told me it had been flagged, and it had not

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 240
**Surface:** mypiggles › Stock › Orders to suppliers › (a late order) — "When it is expected"
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03, on the screen — see below
**Blocked on:** —

## What happened

Devi opened a late order. Above the date box:

> **This order is past its date**
> **It has been flagged once.** Recording a new date starts the clock again, so a
> second broken promise is heard rather than lost in the first one.

It had not been flagged. Nothing had. MEASURED 2026-09-18:

```sql
select count(*) as orders, count(late_alerted_at) as flagged
from inventory_purchase_orders;
--  orders | flagged
--      20 |       0
```

**Twenty purchase orders on the whole platform, none of them ever flagged**, and
the pane printed that sentence over every single late one — because the pane
never read the field. `lateAlertedAt` was not on the order detail the console
fetches. There was nothing behind the claim at all.

Then she pressed **Record it** and the console said:

> **New date recorded**
> **If they miss this one too, you will hear about it.**

She will not. The late-order event has exactly one consumer on the whole
platform: the webhooks under **Tell other software**. Nobody in the business is
emailed or notified. A shop with no integrations — which is most of them, and is
Juniper Row — hears nothing, ever.

## What should have happened

Two sentences of fact, and both need a fact behind them.

Whether it has been announced is a column: say what the column says. What happens
if they miss the new date is testable: say the thing that is true, which is that
it comes back on the overdue list.

## How to reproduce

Before the fix, every time:

1. Sign in as `p03.devi@piggles.test`, Juniper Row.
2. Open any order past its expected date.
3. **When it is expected** claims it has been flagged once, on a brand-new
   platform where nothing ever has been.
4. Record a new date. The toast promises she will hear about the next miss.

## Why it matters

**A console that states things it has not checked cannot be used to check
anything.** This one is small on its own and dangerous as a habit: a buyer who
reads "it has been flagged once" reasonably concludes somebody downstream already
knows, and stops chasing.

The toast is the worse half. "You will hear about it" is the sentence that
decides whether she sets her own reminder. She would not have, and nothing would
have told her. [[feedback_a_promise_in_copy_is_a_contract]]

The word itself is the third problem. "Flagged" is what the code calls it and it
means nothing to a person running a shop — the same leak the Overdue deliveries
row had in [668](668-it-told-me-how-late-but-never-what-day.md), fixed there and
left here. [[feedback_a_fix_leaves_its_neighbour_behind]]

## Where it lives

| What                     | Where                                                                             |
| ------------------------ | --------------------------------------------------------------------------------- |
| The unconditional claim  | `piggles\|sparx/apps/workbench/surfaces/inventory/purchase-order-procurement.tsx` |
| The promise in the toast | same file, `Reschedule`'s `onSuccess`                                             |
| The field nobody sent    | `wizeworks/packages/inventory/src/services/purchase-order-shared.ts`              |

## The fix

**The field exists, so send it.** `lateAlertedAt` added to `PurchaseOrderRow` and
its serializer — a scalar already on the model, so no extra query — and carried
through to the console's own type and into the pane as a prop.

**The alert says which of the two it is**, in the words the Overdue deliveries
list already uses, so one fact does not have two vocabularies:

> **This order is past its date**
> Nothing has been passed to your other software about it yet: that happens once,
> on the nightly check. Recording a new date starts the clock again, so a second
> broken promise is heard rather than lost in the first one.

and, once it has:

> It was passed to your other software once, 3 hours ago. Recording a new date
> starts the clock again, …

Relative rather than absolute, because `absolute` is "6:10 PM" on the day it
happened and "Sep 12" after that, and no single preposition fits both. The exact
moment is on the hover tooltip.

**The toast says the true thing:**

> **New date recorded**
> If they miss this one too, it comes back on your overdue list.

The overdue list is a live read: it needs no nightly pass to be right, and it is
the one place a business with no integrations actually finds out.

## Confirmed by

Both branches driven on the screen, in one act:

> With `late_alerted_at` NULL: "**This order is past its date** — Nothing has
> been passed to your other software about it yet: that happens once, on the
> nightly check."
>
> Then **Stock › At risk › Work it out now**, which runs the nightly pass
> including its late-order stage. `late_alerted_at` on PO-000004 became
> `2026-09-19 01:10:21+00`, and the same panel re-read: "**It was passed to your
> other software once, 52 seconds ago.**"
>
> The Overdue deliveries row moved with it, from "not passed to your other
> software yet" to "passed to your other software".

## Gap to 10

The sweep only runs nightly in production and only on the operator's own
schedule in development, so "that happens once, on the nightly check" is honest
and still leaves the buyer with nothing to act on. The real gap is the one
already recorded against the Overdue deliveries row: **a business with no other
software is never told an order is late by anything except opening that pane.**

## Rating effect

Recorded in [rating.md](../rating.md) on the
`inventory.purchase-orders.detail` row.
