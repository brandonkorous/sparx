# 308 — Every order she ever sent is in nobody's history

**Status:** fixed, confirmed
**Severity:** major (no customer's history has ever shown that their order was
sent or that it arrived; six such rows exist on this shop and none is reachable)
**Found by:** P03 · Juniper Row · while fixing [307]
**Surface:** the console — Customers › a customer › Recent activity
**Filed:** 2026-08-28

## What happened

[307] is about an order that appears in a history without its number. Reading
the same table to check it, the shape of what was there stopped the count:

    type            | rows | with a customer | with a description
    ----------------+------+-----------------+-------------------
    order.delivered |    2 |               0 |                  0
    order.placed    |    8 |               8 |                  8
    order.refunded  |    2 |               2 |                  2
    order.shipped   |    4 |               0 |                  0

**All six shipped and delivered rows belong to no customer at all**, and none of
them says anything. The console reads a customer's timeline by customer, so
every one of those rows is in the table and in no history. Devi opens Anneliese
and sees an order placed and an order refunded; nothing between them says the
order she packed and posted ever went out.

Nothing failed. Six writes succeeded, six times, and produced records that are
unreachable from the only screen that reads them.

## Why

`order.fulfilled` and `order.delivered` were published carrying only
`{ orderId, fulfillmentId }`. The consumer wrote
`customerId: payload.customerId` — a field the event did not have — and
`crm_activities.customer_id` is **nullable**, so Prisma stored NULL and returned
success.

The second half was in the same line: `description: null`, so even a row that
did find a customer would have read "Shipped" and named no order, beside "Order
O-000008 placed" which names one.

This is [[feedback_absent_behaves_like_fine]] in its plainest form: a missing
field and a correct one produce the same green result, and only looking at the
rows tells them apart. It is also [[feedback_fetched_but_never_rendered]] from
the other side — the producer had `order.customerId` in hand, inside the same
transaction, and sent an event without it.

## The fix

- **`order.fulfilled`, `order.delivered`, `order.cancelled`, `order.paid` and
  `order.payment.recorded` now carry `customerId` and `orderNumber`**, read from
  the order inside the transaction that is already reading it
  ([order-fulfillments-service.ts](../../../../wizeworks/packages/crm/src/services/order-fulfillments-service.ts),
  [order-payments-service.ts](../../../../wizeworks/packages/crm/src/services/order-payments-service.ts),
  [order-refunds-service.ts](../../../../wizeworks/packages/crm/src/services/order-refunds-service.ts),
  [order-service.ts](../../../../wizeworks/packages/crm/src/services/order-service.ts)).
- **A lifecycle row with no customer is refused and logged**, not written
  ([order-events.ts](../../../../wizeworks/packages/crm/src/consumers/order-events.ts)).
  It could never be read, so writing it buys nothing and costs the one signal
  that something is wrong. Same guard on the refund row.
- **The row says what happened**: `Order O-000009 shipped`, in the same voice as
  the placed and refunded rows either side of it. The words are written into the
  row rather than invented by the console, so an export and the API say what the
  screen says.
- **The console's label map had `order.fulfilled`, which is the topic name and
  never the stored type** — so its hand-written label was for a row that is never
  written, and the rows that are written fell through to the generic humaniser
  and read "Shipped". Now `order.shipped` / `order.delivered` /
  `order.cancelled`
  ([customer-activity-data.ts](../../../apps/workbench/surfaces/crm/customer-activity-data.ts)).

## Confirmed as Devi, 2026-08-28

Opened O-000009 (Anneliese Vogt, $152.00), entered the USPS tracking number and
pressed **Mark it as sent**. The toast said "Marked as sent — the customer can
follow it from here", and the order moved to **On the way**.

Opened Anneliese. Her history now reads:

    Order placed    — Order O-000013 placed ($180.00)      Aug 28
    Order shipped   — Order O-000009 shipped               Aug 28
    Order refunded  — Order O-000004 refunded ($128.00)    Aug 28
    Order placed    — An order was placed ($152.00)        Aug 27
    Order refunded  — Order 2ca8e923-7141-…-91ed5f8cde77   Aug 25

Three generations of this bug in one list, newest at the top: the two rows that
name the order properly, then [307]'s nameless one, then [288]'s raw id. The
shipped row is the one that would not have existed at all this morning.

Covered by a test that publishes one fulfilment event with a customer and one
without, and asserts exactly one row lands, on the right person, reading
`Order O-000124 shipped`
([consumers.test.ts](../../../../wizeworks/packages/crm/test/integration/consumers.test.ts)).

## Not repaired, deliberately

The six existing orphan rows are left alone. They record what the platform did,
they are the evidence behind this issue, and hand-writing customer ids into
them is the one-off DB script this project does not do. They stay unreachable,
which is what they always were; every row written from here on is not.

## Not checked

- **The other nine personas.** Counted on Juniper Row only, but nothing about
  the cause is shop-specific — the events were published without a customer for
  everybody.
- **`order.cancelled`.** It always carried `customerId`, so it was never an
  orphan, but its description is new and no order has been cancelled to see it.
