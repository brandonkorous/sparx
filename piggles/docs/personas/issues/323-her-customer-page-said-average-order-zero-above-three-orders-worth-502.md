# 323 — Her customer page said "Average order $0.00" above three orders worth $502

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · following [322] to the buyers it surfaced
**Surface:** mypiggles › Customers › a customer › Overview
**Filed:** 2026-08-29
**Fixed:** 2026-08-29
**Confirmed by:** reopened Anneliese Vogt as Devi — every figure on the card is now true
**Blocked on:** decision (the missing figure only; see What this does NOT fix)

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

**2. The number she actually wants needs a column, so it is not attempted.**
"What are this customer's orders worth" and "what does she owe me" both need the
sum of order VALUES, and `customers` carries only `total_spent` (paid),
`order_count`, and the two dates. Adding `total_ordered` to the rollup is a
schema change, and this repo's rule is that a migration is authored and handed to
the pipeline rather than run from a laptop.

It also needs a decision that is not mine: **does a refunded order count toward
what a customer's orders are worth?** Anneliese's $170 refund says yes under one
reading (she did buy it) and no under another (the money went back). The answer
changes both the average and any "owed" figure, so it is stated here rather than
picked quietly. `Blocked on: decision` for that half.

## What this does NOT fix

**She still cannot see what her customers' orders are worth, or what she is
owed.** Part 2 above: it needs `total_ordered` on the rollup, which is a
migration, and it needs the refund question answered first. Both are recorded
rather than guessed. Until then the card is honest about being about money
received, and silent about the rest.

**Sell › How selling is going still says "Average order" for a different
quantity** — the real average order value, correctly computed there. Two screens
now use two labels for two things, which is right, but nothing yet stops the two
from being confused if somebody reads them a week apart.

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
