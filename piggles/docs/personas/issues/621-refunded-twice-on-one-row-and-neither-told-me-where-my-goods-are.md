# 621 — "Refunded" twice on one row, and neither told me where my goods are

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 207
**Surface:** mypiggles › Sell › Orders (and the order pane)
**Filed:** 2026-09-17
**Fixed:** 2026-09-17
**Confirmed by:** P03 · Juniper Row · act 207 (seen on screen, before and after)

## What happened

O-000004, Anneliese Vogt, $170.00:

| Order    | Payment      | Delivery     |
| :------- | :----------- | :----------- |
| O-000004 | **Refunded** | **Refunded** |

Two columns, one word. The Delivery column asks a question — have the goods
gone — and answered with the answer to the other column's question.

So I still do not know the thing I opened the list to find out: **is that $170
of stock on my shelf, or is it at Anneliese's house?**

Those need opposite things from me. Goods that went out are with a customer who
has already had her money back. Goods that never went are mine and can be sold
again.

## Why it happened

The stored `orders.status` enum is
`placed | fulfilled | delivered | cancelled | refunded`, and `refunded` is a
money fact sitting in the column that otherwise tracks the goods.
`shippingState` translated it faithfully:

```ts
case 'refunded':
  return {
    label: 'Refunded',
    tone: 'neutral',
    detail: 'The customer has had their money back on this order.',
  };
```

A correct translation of a word that does not belong there.

**The fact was already on the row.** `Order.fulfilledAt` is on the type the list
loads, and nothing read it ([[feedback_fetched_but_never_rendered]]).

Measured 2026-09-17:

```sql
select count(*) as refunded,
       count(*) filter (where exists (select 1 from order_fulfillments f
                                      where f.order_id = o.id)) as ever_shipped
  from orders o where o.status = 'refunded';
-- 9 | 1
```

Eight of nine refunded orders on the platform **never shipped at all**, and
`fulfilled_at` agreed with the shipment records on every one of the nine. So the
column had one word for two opposite situations, and was wrong about the goods
in 8 cases out of 9.

Hers is the ninth: O-000004 shipped, then was refunded.

## The fix

| goods      | posted                  | collected                    |
| :--------- | :---------------------- | :--------------------------- |
| never went | Never sent              | Never collected              |
| went       | **Sent, then refunded** | **Collected, then refunded** |

And the tone carries the difference. Goods sitting on her own shelf are
`neutral`; goods out in the world after a refund are `warning`, because that is
the one she may need to chase.

Details, likewise:

> The money has gone back and nothing was ever sent, so it is still on your
> shelf.

> This went out before the money went back, so it is with the customer.

Fixed in `shippingState`, which the file's own comment says is "the one place
both the list and the order pane read it from, so correcting it here corrects it
everywhere".

## The test that had to change

One test listed `refunded` beside `cancelled`:

```ts
it('says nothing about collection on a status that cannot be collected', () => {
  // Cancelled and refunded are the same fact whichever way the order was
  // going, so they take no collected form and must not grow one by accident.
```

That rule was **right while `refunded` said nothing about the goods.** It says
something now, and what it says differs by route — which is the same reason the
`fulfilled` branch three lines above it grew a collected form on purpose, after
a packed collection read "On the way" about a box on the counter.

So `cancelled` keeps the guard and `refunded` moved out from under it, with the
reason written where the old line was. The rule was not deleted; it was narrowed
to the case it is still true of.

## Guard

`order-tone.test.ts` in Piggles (**20 tests**, 6 new) and a new
`order-shipping-state.test.ts` in sparx (**6 tests**), which had no coverage of
this function at all.

The fixture grew a third argument so it can express the fact:
`order(status, collected, fulfilledAt)`.

The one that states the defect:

```ts
it('never repeats the payment column word', …)   // both columns said "Refunded"
```

Proven red by restoring the old branch: **5 of 20** in Piggles, **5 of 6** in
sparx.

## Not changed

**`refunded` stays in the order-status enum.** It is a money word in a goods
column and it would be cleaner as a flag beside the status, but that is a schema
change and a migration across every writer. The console now reads it correctly,
which is what an owner sees.

## Still open

The enum above.
