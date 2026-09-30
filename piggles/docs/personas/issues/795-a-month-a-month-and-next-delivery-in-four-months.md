# 795 — "$29.00 a month", and "Next delivery in 4 months"

**Status:** fixed
**Severity:** high
**Found by:** P03 · Juniper Row · act 279
**Surface:** mypiggles + sparx workbench + api-rest — `commerce.product.subscriptions`
**Filed:** 2026-09-23
**Blocked on:** —

## What happened

**Repeat order options** on the Silk twill scarf told Devi four things, and they
could not all be true:

```
What repeat orders are worth

$29.00   every month, from repeat orders that are still running
1        of these you are committed to sending each month
1        customer has it on repeat right now

Who has it on repeat
Marguerite Adeyemi                                  Running
1 of this each time
Next delivery in 4 months                   $29.00 a month
```

One customer. "$29.00 a month" and "next delivery in 4 months" on the same row.

The actual repeat order: **one scarf, $58.00, every two months.**

## Two separate defects

### A count of things, rounded

Units were counted by calling the MONEY function with a price of one, and that
function rounds to the cent:

```ts
units += repeatOrderMonthlyCents({
  lines: lines.map((line) => ({ unitPriceCents: 1, quantity: line.quantity })),
  …
});
```

One scarf every two months is 0.5 a month, which rounds to **1** — twice what
she owes. One every three months is 0.333, which rounds to **0**. And the
rounding happened PER repeat order before summing, so three quarterly
subscribers each rounded to nothing and the panel reported that she was
committed to sending none, beside "3 customers have it on repeat right now".

Measured on the shipped code:

```
1 every 2 months   →  1     (should be 0.5)
1 every 3 months   →  0
three of those     →  0
1 a year           →  0
```

A thing cannot be half sent, so a month is the wrong window for a count of
things. [[feedback_never_present_absence_as_measurement]]

### The cadence never reached the screen at all

`SubscriptionSummary` carried `nextOccurrenceAt`, `itemCount` and a monthly
average — and no `intervalUnit`, no `intervalCount`, no per-cycle amount. So the
row COULD NOT say "every 2 months" or "$58.00"; it only had the average, and it
printed that beside a real delivery date.
[[feedback_fetched_but_never_rendered]]

## What was done

**`repeatOrderYearlyUnits`** — units, over a year, returned unrounded so a
caller summing several rounds once at the end. A year is the window in which
every cadence a shop actually sells on lands on a whole number. A live
commitment never reports as none.

**The summary carries the cadence** and this product's own per-cycle amount, so
a row says what actually happens rather than an average of it.

```
before                          after
$29.00 every month              $29.00 a month on average, from the
                                repeat orders still running
1 … sending each month          6 … you are committed to making in a year
$29.00 a month                  $58.00 every 2 months
```

Six scarves a year, one every two months, $58.00 each time. Every number on the
pane now agrees with every other one.

## The customer's own page said it too

The same figure, about her own card, on the site:

```
Your repeat orders
$29.00 a month · 1 item
Next order 20/01/2027
```

`MySubscription` carried the monthly average and nothing else, so the page had
no other number to print. Marguerite is charged **$58.00 every 2 months**. It
says that now.

Not driven as Marguerite: signing in as a customer needs her password, which is
hers to type. The figure is read from the same service function the console pane
was checked against, and the charge was confirmed against the database — one
item, 5800 cents, `interval_count` 2, `interval_unit` month.

## Proof

Driven as Devi. Tests in `subscriptions.test.ts` cover 12 a year monthly, 6
two-monthly, 4 quarterly (asserting alongside it that the shipped shape returns
0), 1 yearly, quantity and deliveries-per-cycle, and that the result is
unrounded. Proved red against the old arithmetic: 6 failures.

## Files

- `wizeworks/packages/commerce-schemas/src/subscriptions.ts` + `.test.ts` (+7)
- `wizeworks/packages/commerce/src/services/subscription-service.ts`
- `piggles|sparx/apps/workbench/surfaces/commerce/products-data.ts` — `cadenceWords`
- `piggles|sparx/apps/workbench/surfaces/commerce/product-subscriptions.tsx`
- `wizeworks/apps/site/lib/customer-client.ts`
- `wizeworks/apps/site/app/account/(authed)/payment-methods/page.tsx`
