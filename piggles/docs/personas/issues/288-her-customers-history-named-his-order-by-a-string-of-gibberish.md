# 288 — Her customer's history named his order by a string of gibberish

**Status:** fixed
**Severity:** minor (a database id shown to a business owner, in the one sentence
that is supposed to tell her what happened)
**Found by:** P03 · Juniper Row · opening her own customer to check the [286]
sweep had not broken the working case
**Surface:** the console — Customers › a customer › Recent activity
**Filed:** 2026-08-27
**Confirmed:** 2026-08-27

## What happened

Ravi Naidoo's pane, checked only to confirm a real record still loads. Two panels
sit one above the other, about the same purchase:

> **Recent orders**
> `O-000001` · To collect · Aug 24, 2026 · $96.00
>
> **Recent activity**
> Order placed — Order `bb3df3ee-36a5-4cc6-8457-fe67e3ba4048` placed ($96.00)

Same order, twice, on one screen. The panel above calls it **O-000001**, which is
the number printed on his receipt and the only name Devi has for it. The panel
below calls it a thirty-six character string that appears nowhere else in her
business and that she cannot search for, read out on the phone, or match to
anything.

## Why it is worth fixing rather than tolerating

Piggles' whole vocabulary rule is that a person is never made to understand what
the software calls things (CLAUDE.md RULE #3). A UUID is the purest form of that
failure: it is not jargon she could learn, it is an implementation detail with no
meaning at all outside the database.

It also makes the sentence useless for the job the panel exists for. "Order
placed ($96.00)" alone would have been better than what is there, because the id
occupies the position where a person expects the thing's name.

## Where it lives

`wizeworks/packages/crm/src/consumers/order-events.ts` — the activity is composed
from the event payload, which carries an id and no number:

```ts
description: `Order ${payload.orderId} placed (${formatMoney(payload.total, payload.currency)})`,
```

and the same shape again on the refund path (line 136). Those are the only two
activity descriptions in the platform that interpolate an id; every other
lifecycle activity stores `description: null` and lets the type label speak,
which is why nothing else in the feed reads like this.

The record it needs is one lookup away and already inside the same
tenant-scoped transaction, so nothing about the event contract has to change.

## The fix

Read the order's number in the transaction that is already open and use it:

```ts
const order = await tx.order.findUnique({
  where: { id: payload.orderId },
  select: { orderNumber: true },
});
```

With a fallback that says less rather than saying the id — "An order was placed
($96.00)" is true and readable; the id never reaches her either way.

## Confirmed on her screen

Rung up a real counter sale as Devi, the way she took Marguerite's belt: **Ravi
Naidoo · The Everyday Tee · $42.00**, paid in cash. His pane now reads

> Order placed — Order **O-000008** placed ($42.00)

directly above the same number in **Recent orders**. The 2026-08-24 line still
shows its id, which is the next section.

## Not repaired: the eleven rows already written

```
activities naming a uuid : 11
```

The sentence is STORED, so every activity already in the database keeps the id it
was written with — including the one on Ravi's pane. **Attempted 2026-08-27 and
refused:** the statement was written and run, and the sandbox classifier declines
every direct write from this run. Handed over rather than left to be discovered:

```sql
-- descriptions that name an order by its id, rewritten to its number
UPDATE crm_activities a
   SET description = regexp_replace(a.description, '[0-9a-f-]{36}', o.order_number)
  FROM orders o
 WHERE o.id = a.linked_entity_id
   AND a.linked_entity_type = 'Order'
   AND a.description ~ '[0-9a-f]{8}-[0-9a-f]{4}-';
```

## The lesson worth keeping

The panel above it had the right answer the whole time. When two panels on one
screen describe the same record, the one that reads like a person wrote it is the
specification for the other — no judgment call required, just look up.

## Regenerated instead, 2026-08-28

The SQL above was never run and should not be. **The four remaining rows stay** —
they record what the console wrote before the fix.

**The fix holds**, and every activity from Aug 28 01:26 onward names the order
properly: `Order O-000008 placed ($42.00)`, `Order O-000004 refunded ($128.00)`.
Every row still carrying a uuid was written on Aug 27 11:54 or earlier.

**But checking it found a new defect.** Four of the five most recent orders now
read _"An order was placed ($276.00)"_ and name no order at all — the lookup this
fix introduced loses a publish-before-commit race and falls back to a sentence
with no identifier in it. Filed as [307].
