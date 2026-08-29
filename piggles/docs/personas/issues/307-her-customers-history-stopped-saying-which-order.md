# 307 — Her customer's history stopped saying which order

**Status:** fixed, confirmed
**Severity:** minor (four of her five most recent orders appear in a customer's
history as "An order was placed" with no way to tell which one)
**Found by:** P03 · Juniper Row · regenerating the data [288] left behind
**Surface:** the console — Customers › a customer › Recent activity
**Filed:** 2026-08-28
**Fixed:** 2026-08-28

## What happened

[288] fixed a customer's history naming an order by its database id. Checking
that the fix had taken on fresh data, the newest four rows read:

    Aug 28 06:41  An order was placed ($276.00)
    Aug 28 06:23  An order was placed ($126.30)
    Aug 28 06:06  An order was placed ($126.30)
    Aug 28 05:50  An order was placed ($152.00)
    Aug 28 01:26  Order O-000008 placed ($42.00)

The UUID is gone, which is what [288] was about. But **four of the five most
recent orders no longer say which order they are.** Devi opens Marguerite's
history to answer "which of these did she return?" and the four newest lines are
identical apart from the amount.

Those orders all have numbers. O-000009, O-000010, O-000011 and O-000012 exist
and are on screen elsewhere in the console. Only the sentence lost them.

## Why

[order-events.ts](../../../../wizeworks/packages/crm/src/consumers/order-events.ts)
reads the number back out of the database when it writes the activity:

    const number = await orderNumberFor(tx, payload.orderId);
    …
    description: number
      ? `Order ${number} placed (${money})`
      : `An order was placed (${money})`,

`orderNumberFor` returned **null** — the order row was not visible to the
consumer's transaction yet. Written times, to the millisecond:

| Activity | Order row written | Activity written | Gap   | Named it? |
| -------- | ----------------- | ---------------- | ----- | --------- |
| O-000012 | 06:41:22.196      | 06:41:22.257     | 61 ms | no        |
| O-000011 | 06:23:05.149      | 06:23:05.210     | 61 ms | no        |
| O-000010 | 06:06:17.431      | 06:06:17.475     | 44 ms | no        |
| O-000009 | 05:50:58.986      | 05:50:59.050     | 64 ms | no        |
| O-000008 | 01:26:19.008      | 01:26:19.100     | 92 ms | **yes**   |

The consumer runs tens of milliseconds after the order is written and still
cannot see it, so this is not "too soon" in wall-clock terms — it is a
**publish-before-commit race**. The four that failed came through storefront
checkout; O-000008, which succeeded, did not.

**The fallback is the part that makes it a defect rather than a hiccup.** A
lookup that fails writes a sentence with no identifier in it at all, silently,
and the sentence is STORED — so the row is wrong for ever, exactly as [288]'s
were. This is the shape of
[[feedback_never_present_absence_as_measurement]]'s sibling: a value nobody
could read must not be replaced with a cheerful sentence that omits it.

## The fix

Both halves, because the payload alone would have left the race in place for
every other consumer of the same event.

**1. `orderNumber` travels in the payload.** The producer holds it at the moment
it publishes, so the consumer needs no lookup, no transaction visibility and no
fallback. What one side already has should not be fetched again by the other.

**2. The announcement waits for the commit.** A new
[`afterCommit`](../../../../wizeworks/packages/db/src/after-commit.ts) in
`@wizeworks/db` runs work when the OUTERMOST transaction commits, or immediately
when none is open — so a service says what it means once and gets the right
timing whether or not somebody later composes it into a larger unit of work.
`withTenant` opens the queue on the branch that opens a transaction, and
deliberately not on the branch that composes into somebody else's, which is how
a nested call inherits the right one.

That second half matters more than the sentence it was found through. Two other
consumers subscribe to `order.created` — the scoring evaluator and the segment
evaluator — and both count the buyer's orders in their own transactions. Running
them against a database the order was not in yet meant a storefront buyer was
re-scored and re-grouped as though the sale had not happened, with nothing later
to correct it. Nobody was going to notice that from a screen.

**Rollback now discards the announcement too.** Publishing from inside an open
transaction survived that transaction being undone: an `order.created` for an
order that never existed. Both are covered by tests
([order-lifecycle.test.ts](../../../../wizeworks/packages/crm/test/integration/order-lifecycle.test.ts)).

The fallback lookup stays for events already on the bus, and **it is no longer
silent** — failing to resolve a number now reaches the log naming the tenant and
the order. A description is rendered once and STORED, so a sentence written
without the number is wrong for ever and no later read repairs it.

## Confirmed as Devi, 2026-08-28

Placed a real order through the shop: The Everyday Tee in M · Clay added to a
basket already holding two things, checked out as Anneliese Vogt to a Brooklyn
address. "Order confirmed — your order **O-000013** has been placed."

Her history in the console:

    Order placed — Order O-000013 placed ($180.00)      Aug 28
    ...
    Order placed — An order was placed ($152.00)        Aug 27

The same shop and the same checkout, four hours apart. The written times show a
fix rather than a lucky race:

| Order    | Order row written | Activity written | Gap    | Named it? |
| -------- | ----------------- | ---------------- | ------ | --------- |
| O-000013 | 10:53:48.719      | 10:53:48.871     | 152 ms | **yes**   |
| O-000012 | 06:41:22.196      | 06:41:22.257     | 61 ms  | no        |

The gap GREW, which is the point: the announcement now waits for checkout's
transaction to commit instead of racing it.

## Not checked

- **The other order consumers** — that question turned out to have a worse answer
  than this issue, and is [308]: `order.fulfilled` and `order.delivered` carried
  no `customerId` at all, so every shipped and delivered row was written against
  nobody. Fixed there.
- **How many rows are already affected across all ten personas.** Counted on
  Juniper Row only. The four nameless rows here are left as they are — the
  sentence is stored, and rewriting stored history by hand is not something the
  console can do or should.
