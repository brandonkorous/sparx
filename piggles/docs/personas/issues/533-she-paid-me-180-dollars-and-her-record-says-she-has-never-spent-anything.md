# 533 — She paid me $180 and her record says she has never spent anything

**Status:** fixed and proven; data repair APPLIED 2026-09-16
**Severity:** critical
**Found by:** Devi, reading her customer list
**Surface:** `crm/src/services/order-payments-service.ts`, `order-refunds-service.ts`, migration `20270511000000_a_payment_by_invoice_reaches_the_buyer` (authored, not run)
**Filed:** 2026-09-15
**Follows:** [232](issues) — the first repair of this exact drift, on this exact customer

## What she saw

Customers → Anneliese Vogt → Overview, the money band at the top:

> | Their orders come to        | **Paid you so far**       | Orders | Last order            |
> | --------------------------- | ------------------------- | ------ | --------------------- |
> | $332.00                     | **$0.00**                 | 3      | 2 weeks ago           |
> | $110.67 an order on average | **$332.00 still to come** |        | First August 25, 2026 |

Anneliese paid her **$180** three weeks ago. The order says **Paid**. The invoice
says **Paid**. The payment is on the Money screen. The card says she has never
paid anything.

**And the second line is the real damage.** `outstanding = ordered - spent`, so a
spend of zero does not merely under-report — it **over-states what she is owed**.
The card told Devi to go and chase $332 from a customer who owes $152. That is a
number a shop owner acts on: she sends the reminder, and the customer who paid
three weeks ago gets asked for money she has already handed over.

(The Customers LIST column is "Orders come to", which is `totalOrdered` and was
never wrong. The drifted figure only surfaces on the customer's own card — which
is why this was found by reading the database and then confirmed on the screen,
rather than the other way round.)

## Measured first

647 customers on this platform. **646 agree with their orders. One does not** —
Anneliese, understated by exactly $180.

That narrowness is what made it findable and what makes it serious: it is not a
formula that is wrong for everyone, it is a **path** that is wrong for everyone
who uses it, and almost nobody here uses it.

## Why

`customers.total_spent` is `SUM(orders.amount_paid)`. Anything that writes
`amount_paid` makes it stale by definition, so recomputing an order's money and
recomputing the buyer's money are not two jobs. They are one.

They were written as two, paired **by convention** at five call sites. Three kept
the pair. Two did not:

| caller                                      | recomputes the order | recomputes the buyer |
| ------------------------------------------- | -------------------- | -------------------- |
| `order-payments-service.recordPayment`      | yes                  | yes                  |
| `order-payments-service.voidPayment`        | yes                  | yes                  |
| `order-refunds-service.recordRefund`        | yes                  | yes                  |
| **`billing-payment-service.recordPayment`** | yes                  | **no**               |
| **`payment-webhook-reconcile`**             | yes                  | **no**               |

The audit log pins the moment: `invoicing.payment.payment` at
**2026-09-08 00:56:21.101**, twelve milliseconds after the `order_payments` row
it created. Devi raised an invoice for `O-000013` and recorded the $180 against
it. The order rollup ran. The buyer's did not.

And the invoice path's own comment claims the opposite:

```ts
// The one place that knows how an order's paid/partly-paid/unpaid state is
// derived, so a payment arriving by invoice lands identically to one typed
// onto the order.
await recomputeOrderPaymentRollup(tx, ctx.tenantId, before.orderId);
```

It does not land identically. The one typed onto the order does two recomputes;
this does one. A comment asserting parity is as testable as any other sentence
([[feedback_a_promise_in_copy_is_a_contract]]).

## The second one is worse, and invisible here

`payment-webhook-reconcile` is the gateway settling a card. It has **never run
on this database**, because no shop in development has a live payment gateway.

In production it is **every online sale**: checkout creates the order with
`amount_paid = 0`, the buyer's record is computed correctly from that zero, and
the webhook that captures the money never tells it. Every card customer would
read **$0.00 spent** for ever.

Nothing on this platform could have shown that. It took reading the callers.

## Why this is the second time

`20270418000000_a_customers_lifetime_spend_agrees_with_their_orders` repaired
exactly this drift, for exactly this customer, on **2026-08-26**. It came back
within two weeks.

Because it repaired the **rows** while both writers went on shipping. A data
migration against a live writer is a countdown, not a fix.

## What changed

**The pairing is gone.** The customer recompute now lives INSIDE
`recomputeOrderPaymentRollup`, the chokepoint every payment path already goes
through, and the three calls that used to sit beside it are deleted.

```ts
await tx.order.update({/* amountPaid, refundTotal, paymentStatus, paidAt */});

// AFTER the order is written, never before: this reads `amountPaid` back off
// the orders it sums, so running it first would sum the figures this call just
// replaced.
await recomputeCustomerCommerce(tx, tenantId, order.customerId);
```

Both broken callers are fixed by that one line without being touched, which is
the point. **A rule that has to be remembered at five call sites is a rule with
five chances to be forgotten.**

## Proven

Four guards on the chokepoint. Every break reddens at least one:

```
RED   D1 the shipped bug: order only, buyer left stale   ->  2 failed | 2 passed (4)
RED   D2 buyer recomputed BEFORE the order is written    ->  1 failed | 3 passed (4)
RED   D3 a missing order still writes                    ->  1 failed | 3 passed (4)
RED   D4 the unpaid -> paid edge stops being reported    ->  1 failed | 3 passed (4)
```

D2 is not pedantry: the customer figures are summed from the orders' own
`amount_paid`, so running first would sum the numbers this call is in the middle
of replacing. The test asserts the invocation ORDER, not just that both happened.

D4 guards what the function already promised. Its return value is what publishes
`order.paid` exactly once; adding work to it must not change what it answers.

## Proven end to end, on the path that actually broke

The guards above are on the chokepoint. The defect was reported on the INVOICE
path, so the proof belongs there too — and
`crm/test/integration/invoice-for-order.test.ts` already had a test called
**"settles the ORDER when the invoice is paid"** that asserted the order, the
payment row and its provenance, and stopped exactly where the code stopped.

A sibling now asserts the buyer, as a DELTA (the file shares one customer across
its tests):

```
RED   E1 the shipped bug, end to end   ->  1 failed | 10 passed (11)
      x settles the BUYER when the invoice is paid, not only the order
```

Ten of eleven still pass with the bug reinstalled, so it is that assertion
catching it and not collateral damage.

## The data repair

`20270511000000_a_payment_by_invoice_reaches_the_buyer` recomputes all five
derived columns from the orders, per tenant. **Applied 2026-09-16**, with the
user's authorization, after they took dev down.

```
BEFORE   656 customers · 655 spend agrees · 1 drifted · $180.00 understated
AFTER    656 customers · 656 spend agrees · 0 drifted
```

`total_ordered` and `order_count` had not drifted at all, before or after, which
narrows the fault to the one column a payment touches.

It loops tenants with `set_config('app.tenant_id', …)`, which the 2026-08-26
repair did **not** do. `customers` and `orders` are FORCE-RLS and `sparx_owner`
is a non-superuser in production, so a plain `UPDATE` there sees zero rows while
passing locally on a superuser connection. That earlier migration may well have
changed nothing in production, and nothing would have reported a failure. This
one loops, and it `RAISE NOTICE`s the count it touched.

## Her screen now

```
Their orders come to     Paid you so far     Orders     Last order
$332.00                  $180.00             3          2 weeks ago
$110.67 an order         $152.00 still to come          First August 25, 2026
```

$152.00 still to come, which is what she is actually owed. And across the shop:

```
Anneliese Vogt        $180.00 paid     $332.00 ordered     3 orders
Ravi Naidoo           $138.00          $138.00             2
Marguerite Adeyemi    $112.00        $1,308.60             5
Jo Kim                $105.00          $105.00             1
Tessa Wren              $0.00          $203.90             2
Rowan Ellery            $0.00           $51.00             1
```

Anneliese is her best-paying customer. The card had her at nothing.
