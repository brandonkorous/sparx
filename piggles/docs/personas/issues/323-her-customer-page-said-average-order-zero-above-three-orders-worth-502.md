# 323 — Her customer page said "Average order $0.00" above three orders worth $502

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · following [322] to the buyers it surfaced
**Surface:** mypiggles › Customers › a customer › Overview
**Filed:** 2026-08-29
**Fixed:** 2026-08-29
**Confirmed by:** reopened Anneliese Vogt as Devi — every figure on the card is now true
**Blocked on:** pipeline (the migration is authored; the column lands with the release)

## What happened

[322] put Devi's buyers at the top of her customer list where she could see
them. Opening the first one, **Anneliese Vogt**, the page contradicts itself
inside one screen.

The four figures across the top:

| Total spent | Orders | Average order | Last order                |
| ----------- | ------ | ------------- | ------------------------- |
| **$0.00**   | **3**  | **$0.00**     | today · First Aug 25 2026 |

Immediately below them, under **Recent orders**:

| O-000013 | To send | Aug 28, 2026 | **$180.00** |
| O-000009 | On the way | Aug 27, 2026 | **$152.00** |
| O-000004 | Refunded | Aug 25, 2026 | **$170.00** |

Three orders, $502 of them, and the card above says the average order is $0.00.

## What should have happened

Two numbers on the same screen do not contradict each other. Whatever the top
row measures, it says which — so a reader can tell why it is zero when the list
under it is not.

## How to reproduce

Every time, for any customer whose orders are not all paid.

1. Open **Customers**, open anyone with a `Customer` badge.
2. Read the four figures, then read Recent orders directly below them.
3. Anneliese Vogt: `$0.00` / `3` / `$0.00` above `$180.00`, `$152.00`, `$170.00`.

## Why it matters

**Juniper Row is on Manual payments**, so "ordered but not yet paid" is the
normal state of her business, not an edge case. The one screen that tells her
what a customer is worth reports zero for her largest outstanding customer.

**The number is arithmetically right and the word above it is wrong, which is the
worst combination** — nothing looks broken, so nobody checks. `totalSpent` is
`SUM(amountPaid)` over non-cancelled orders
([customer-rollup.ts](../../../../wizeworks/packages/crm/src/services/customer-rollup.ts)),
and Anneliese has been paid for none of hers: one refunded, two fulfilled but
unpaid. So `$0.00` collected is true. "Average **order**" is what makes it read
as a statement about the size of her orders, which it is not.

**It is wrong at partial strength everywhere, not just at zero.** Marguerite
Adeyemi shows `Total spent $72.00` across `3` orders and therefore
`Average order $24.00` — but $72.00 came from ONE paid order. There is no order
of hers worth $24.00 and there never was. The numerator counts money from paid
orders; the denominator counts every order. Dividing one population by the other
produces a number that describes nothing.

**And the same two words mean something else two screens away.** Sell › How
selling is going has its own "Average order"
([reports.tsx](../../../../piggles/apps/workbench/surfaces/commerce/reports.tsx)),
computed from order totals — the real average order value. Correct there. So the
console uses one label for two different quantities.

## Where it lives

[piggles/apps/workbench/surfaces/crm/customer-overview.tsx](../../../../piggles/apps/workbench/surfaces/crm/customer-overview.tsx):

```tsx
const spent = Number(customer.totalSpent); // money RECEIVED
const orders = customer.orderCount; // orders PLACED
const avg = orders > 0 ? spent / orders : 0;
...
<Kpi label="Average order" value={orders > 0 ? formatMoney(avg) : '—'} />
```

The `orders > 0` guard catches divide-by-zero and nothing else. The mismatch is
between the two populations, and it is invisible on any customer who has paid for
everything — which is every customer on a card-payments tenant, which is why this
survived to a Manual-payments business.

## The fix

Two halves, and only the first could be made in this run.

**1. Say what the number measures.** The label becomes "Average paid per order",
which is exactly what `totalSpent / orderCount` is, and the figure stops being a
claim about order size. When nothing has been collected the card carries a hint
saying so, rather than leaving a bare `$0.00` to be read as "worth nothing".

That makes every figure on the card true. It does not make the card complete.

**2. The number she actually wants: `total_ordered`.** "What are this customer's
orders worth" and "what does she owe me" both need the sum of order VALUES, and
`customers` carried only `total_spent` (paid), `order_count` and the two dates.

**Does a refunded order count toward what a customer's orders are worth?** This
was written up as a decision for Brandon. It should not have been: the codebase
had already answered it, one file away.

`customer-rollup.ts` says of `total_spent`, in its own header, that it is
"`Order.amountPaid`, which the refund path already writes net (a $170 order
refunded $42 carries `amountPaid` 128.00)". **`total_spent` is net of refunds.**
So a GROSS `total_ordered` beside it would put two different populations on one
card — which is precisely the defect this whole issue is about, rebuilt in a new
pair. Net is the only answer that makes the card internally consistent.

It is also the ordinary accounting answer (net sales are gross minus returns) and
what every comparable platform reports for what a customer is worth. A fully
refunded order is worth nothing to the person who sold it.

So: **net of refunds**, `SUM(total - refund_total)` over non-cancelled orders.
Three consequences worth stating, because each could have gone the other way:

- A **partial** refund reduces the figure by what went back rather than
  discarding the order — which is why it subtracts rather than filters.
- A fully refunded order **stays in `order_count`**. Dropping it would make
  "3 orders" disagree with the three orders listed underneath, which is this
  issue's own contradiction moved to a different pair.
- It is **clamped at zero**. A refund larger than its order is a data fault, not
  a customer worth minus money — and the increment version of this file already
  shipped "-$42.00" once.

The migration is **authored, not run**
([20270428000000_what_a_customers_orders_are_worth](../../../../wizeworks/packages/db/prisma/migrations/20270428000000_what_a_customers_orders_are_worth/migration.sql)),
per this repo's rule, and it BACKFILLS rather than defaulting to zero — a derived
column starting at 0 on every existing row reads as a measurement of nothing, and
a customer who never orders again would read $0.00 forever.

**3. The card now answers both questions**, in the same four tiles:

| Tile                 | Says                                                   |
| -------------------- | ------------------------------------------------------ |
| Their orders come to | `total_ordered`, with the real average order beneath   |
| Paid you so far      | `total_spent`, with "$X still to come" when it is owed |
| Orders               | the count, unchanged                                   |
| Last order           | unchanged                                              |

The gap between the first two IS what she is owed, and because both are net of
refunds the gap is money outstanding rather than money returned.

**"Average paid per order" is gone**, and that matters: it was a true label for a
quantity nobody wants. The average is now order VALUE over orders placed — the
same quantity Sell › How selling is going means by "Average order", so the two
screens finally mean the same thing by the same word.

**4. And the LIST, because the card alone was half the surface.** The customers
list showed one money column, `totalSpent`, labelled "Total spent" — accurate,
and useless here. Three of Devi's six buyers read $0.00, so sorting by it put her
best customer (Anneliese, $332 of orders) below her smallest (Jo Kim, $105).

That column now shows what their orders come to. **Nothing is lost on a shop that
takes payment at checkout** — there the two figures are identical — and it is the
only one that ranks a shop taking manual payment correctly. Both remain sort
options, renamed to say which is which: **Orders come to** and **Paid you**.
`totalOrdered` was added to the sort contract end to end: the service, the REST
route's schema, the MCP `list_customers` tool, and the console.

## Confirmed against her real data

The migration was applied to the dev database and the client regenerated
(Brandon stopped dev so it could be), and the backfill lands correctly:

| Customer           | Orders come to | Paid you | Orders |
| ------------------ | -------------- | -------- | ------ |
| Marguerite Adeyemi | $582.60        | $72.00   | 3      |
| Anneliese Vogt     | **$332.00**    | $0.00    | 3      |
| Ravi Naidoo        | $138.00        | $138.00  | 2      |

Anneliese is the refund decision made visible: $502 placed, $170 refunded,
$332 net. Marguerite is $510.60 outstanding — on the card that used to say her
average order was $24.00.

## Confirmed by

Reopened Anneliese Vogt as Devi on 2026-08-29, same customer, same three orders.

| Paid you so far                                      | Orders | Average paid per order | Last order |
| ---------------------------------------------------- | ------ | ---------------------- | ---------- |
| **$0.00** · _None of their orders has been paid yet_ | **3**  | **$0.00**              | today      |

Recent orders directly below is unchanged — `$180.00`, `$152.00`, `$170.00` —
and the two no longer contradict each other: the top row says what it counts, and
the zero says why it is zero. Checked against Marguerite Adeyemi as well, whose
`$24.00` is now labelled as what it is rather than as the size of an order she
never placed.

## Rating effect

To be recorded against `Customers › customer overview` once re-scored.
