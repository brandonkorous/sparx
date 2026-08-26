# 232 — Jo Kim paid $147 and her record said $0.00, and Anneliese's said minus $42

**Status:** fixed in code and proven by test; the repair of already-drifted rows is a migration awaiting the pipeline
**Severity:** blocker
**Found by:** P03 · Juniper Row · act 8 — opening the customer list
**Surface:** mypiggles › Customers › Customers
**Filed:** 2026-08-26
**Fixed:** 2026-08-26

## What happened

Devi opened her customer list for the first time since taking real money:

```
Name              Stage      Total spent   Last order
Priya Anand       Lead           $0.00         —
Anneliese Vogt    Customer     -$42.00         —
Jo Kim            Customer       $0.00         —
Tessa Wren        Customer     $101.95      Aug 24
Ravi Naidoo       Lead          $96.00      Aug 24
```

Every figure on that screen is wrong.

- **Jo Kim** paid **$147.00** in full, in cash, yesterday. Her record says **$0.00**
  and **no last order**.
- **Anneliese Vogt** paid **$170.00** and was given **$42.00** back. Her record
  says **minus forty-two dollars** — a lifetime spend below zero, which is not a
  thing that can happen.
- **Tessa Wren** has paid **nothing**. Her $101.95 is the face value of an order
  she has not settled. She also has **two** orders and the column says one.
- **Ravi Naidoo** has paid a **$30** deposit on a $96 collection order. His
  record says $96.

## What should have happened

```
Anneliese Vogt    $128.00     Aug 25
Jo Kim            $105.00     Aug 25
Tessa Wren          $0.00     Aug 25   (2 orders)
Ravi Naidoo        $30.00     Aug 25
```

## Why it matters

This is the column a shop owner uses to decide who to look after. It is on the
list, it is in segment rules, it is what "your best customers" is built from, and
it is a number about money that was wrong in four different directions at once.

A negative one is worse than merely wrong. It cannot be read as a mistake in the
data — it reads as the software being broken, which it was.

And nothing on the screen could have told her. A missing figure and a correct
figure render identically.

## Where it lives

**Three faults, stacked.**

**1. The figures were nudged, not derived.** An event consumer applied
`{ increment: payload.total }` on `order.created` and a matching decrement on
`order.refunded`
([order-events.ts](../../../../wizeworks/packages/crm/src/consumers/order-events.ts)).

**2. A consumer failure is swallowed.** `InMemoryPlatformBus.publish` catches
every handler error into a one-line `console.error` that named the topic and
nothing else. Three of Devi's five orders never reached their buyer's record and
nothing anywhere recorded that they had not. In the database:

```
Anneliese Vogt  total_spent -42.00  order_count 0  last_order_at NULL
Jo Kim          total_spent   0.00  order_count 0  last_order_at NULL
```

`order_count 0` on a customer with a fulfilled order is the tell, and no screen
shows it.

**3. The two halves disagreed about what the column means.** The increment ran at
PLACEMENT, at the order's face value, paid or not — so Tessa's unpaid order
counted as spend. The decrement ran on a refund, which only makes sense against
money received. One column, two definitions, and the refund half kept working
after the increment half was lost. That is precisely how a lifetime spend reaches
minus forty-two dollars.

**And Jo Kim had a fourth problem of her own.** Her $42 went back through the
returns bench before [222](222-she-gave-42-back-and-the-order-offered-to-give-it-all-back-again.md)
was fixed, so the return is settled (`status = 'refunded'`,
`refunded_amount_cents = 4200`) and the ORDER never learned about it — it still
reads `amount_paid 147.00, refund_total 0.00`. Recomputing from that order alone
would have replaced $0.00 with $147.00: right by the record, wrong by the till.

## The fix

**Derived, in the write path.** A new
[customer-rollup.ts](../../../../wizeworks/packages/crm/src/services/customer-rollup.ts)
recomputes all four columns from the customer's orders, and it is called INSIDE
the same transaction that writes the order, the payment, the refund, the void or
the cancellation. The summary commits with the thing it summarises or neither
commits, so it cannot be lost, cannot be double-applied, and cannot go negative.

`total_spent` now means one thing: **money actually received**, `SUM(amount_paid)`
over orders that were not cancelled. An unpaid order contributes nothing until it
is paid.

**The consumer keeps only the timeline.** Appending an activity row is
best-effort by nature and a missing one is a gap in a story. Money is not
best-effort and does not belong behind a swallowed catch.

**A cancelled order now stops counting.** Nothing reversed one before — the
increment had been applied and no path took it back.

**And the swallowed error names itself.** The log line carries the tenant, the
event id and the payload, so a failed handler can be traced to the people it
belonged to.

## What proves it

Five DB-backed tests in
[customer-rollup.test.ts](../../../../wizeworks/packages/crm/test/integration/customer-rollup.test.ts),
one per failure shape seen on this shop: an unpaid order counts nothing, money
followed as it is taken and given back ($170 − $42 = $128), a refund can never
drive the figure below zero, a cancelled order drops out, and two payments on one
order stay one order. `@wizeworks/crm` 447/447.

## What is not done yet

**The rows that already drifted stay wrong until they are recomputed**, and a
customer who never orders again never gets a recompute. That repair is
[migration 20270418000000](../../../../wizeworks/packages/db/prisma/migrations/20270418000000_a_customers_lifetime_spend_agrees_with_their_orders/migration.sql),
which (1) recovers refunds that were settled at the returns bench and never
reached their order, (2) re-derives every order's payment columns, and (3)
recomputes every customer's summary.

Verified read-only against the live local data before it is applied:

```
                now        after
Anneliese     -42.00      128.00     1 order
Jo Kim          0.00      105.00     1 order
Ravi Naidoo    96.00       30.00     1 order
Tessa Wren    101.95        0.00     2 orders
Priya Anand     0.00        0.00     0 orders
```

Step 1 catches **nine** orphaned return refunds across eight tenants, each one a
return settled with an amount against an order whose `refund_total` is zero.

Migrations go through the pipeline, not a laptop, so this is authored and
awaiting the data stage. **Until it runs, Devi's screen still shows the old
numbers.**

## Related

Jo Kim's second cause is [222](222-she-gave-42-back-and-the-order-offered-to-give-it-all-back-again.md)'s
pre-fix residue — the fix repaired the code and not the record, which is the
lesson worth keeping.

## Rating effect

`Customers › Customers` in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
