# 543 — "Part paid, some is still owed", on an order that was paid in full

**Status:** fixed and proven
**Severity:** high
**Found by:** a rollup sweep across the whole platform's orders
**Surface:** `piggles/apps/workbench/surfaces/commerce/order-tone.ts`, `sparx/.../commerce/data.ts`
**Filed:** 2026-09-16
**Follows:** [292](issues) — the same sentence, fixed for the SHOPPER and left for the shop
**Family:** [532](issues/532-paid-in-green-on-a-payment-where-every-penny-went-back.md) — the same thing one level down

## What it said

Sell → Orders:

> | Order    | Customer | Payment       | Total   |
> | -------- | -------- | ------------- | ------- |
> | O-000005 | Jo Kim   | **Part paid** | $147.00 |

Hovering: _"Some of this order has been paid for, and some is still owed."_

Jo Kim paid **$147.00**, the whole thing, by check. Then $42.00 of it went back
to her for a returned item. **Nothing is owed.** The sentence tells Devi to go
and chase a debt that does not exist, which is the harm from
[533](issues/533-she-paid-me-180-dollars-and-her-record-says-she-has-never-spent-anything.md)
wearing different words.

## Measured

```sql
select count(*) filter (where payment_status='partially_paid')                       as says_part_paid,
       count(*) filter (where payment_status='partially_paid' and captured >= total) as but_paid_in_full
from ( … orders joined to their captured payments … ) p;
```

| partially_paid orders | actually paid in full | shops |
| --------------------- | --------------------- | ----- |
| 3                     | **2**                 | 2     |

Two thirds of every "partially paid" order on the platform was nothing of the
kind.

## Why

`amountPaid` is **captured minus refunded**, on purpose:

```ts
const amountPaid = Math.max(0, captured - refunded);

if (refunded > 0 && amountPaid === 0) paymentStatus = 'refunded';
else if (amountPaid >= total && total > 0) paymentStatus = 'paid';
else if (amountPaid > 0) paymentStatus = 'partially_paid'; // ← catches this
```

So a full payment followed by a part refund lands below the total and falls
through to `partially_paid`. The ladder has no rung for "paid, then some of it
went back", and the badge read the word.

## The part worth remembering

The public account endpoint already knows:

```ts
// …without them a refunded order showed its buyer the full total and the word
// "partially_paid", which reads as a debt rather than as money returned (issue 292).
amountPaidCents: toCents(order.amountPaid),
refundedTotalCents: toCents(order.refundTotal),
```

**Issue 292 found this exact sentence, on the shopper's own order page, and fixed
it there.** The shop owner's console kept reading the word for however long that
has been. Fourth time in this run that a fix reached one of two places.
[[feedback_a_fix_leaves_its_neighbour_behind]].

## Fixed

`paymentState` takes the money, the same move issue 532 made for
`order_payments.status` earlier today. `amountPaid` and `refundTotal` were both
already on the row and already fetched.

| stored word    | refunded | paid + refunded ≥ total | badge                                                                                    |
| -------------- | -------- | ----------------------- | ---------------------------------------------------------------------------------------- |
| partially_paid | > 0      | yes                     | **Part refunded** — "Paid in full, and some of it has since gone back. Nothing is owed." |
| partially_paid | > 0      | no                      | **Part paid, part back** — "There is still an amount owed."                              |
| partially_paid | 0        | —                       | Part paid (unchanged)                                                                    |

Not a new stored status: adding `partially_refunded` to the enum would touch the
public API, the import worker, the badge maps and the docs, and would need a data
repair. The badge reading the numbers beside it is the house pattern and needs
none of that.

On screen: **O-000005 now reads "Part refunded"**, and O-000016 (a genuine part
payment, $40 of $67, no refund) still reads "Part paid".

## Guards

4 in each console. **2 go red** with the money check removed: the one that says
it must never claim money is owed on a fully-paid order, and the one that says it
must still claim it when money genuinely is.

## Files

- `piggles/apps/workbench/surfaces/commerce/order-tone.ts` + `order-tone.test.ts`
- `sparx/apps/workbench/surfaces/commerce/data.ts` + `order-payment-state.test.ts` (new)
