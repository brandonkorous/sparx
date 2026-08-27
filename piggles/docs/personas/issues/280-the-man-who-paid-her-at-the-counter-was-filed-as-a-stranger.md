# 280 — The man who paid her at the counter was filed as a stranger

**Status:** fixed
**Severity:** major (every in-person buyer, on every Piggles shop, stayed a lead forever)
**Found by:** P03 · Juniper Row · reading her own Customers list
**Surface:** the console — Customers; and every segment, filter, automation and report
downstream of a customer's stage
**Filed:** 2026-08-27
**Confirmed:** 2026-08-27

## What happened

Devi opens Customers. Every row says **Lead**. She scrolls; still Lead. She searches for
Ravi Naidoo, who bought a Marlow Knit over the counter three days ago and handed her $30
against it.

| Name        | Stage    | Total spent | Last order   |
| ----------- | -------- | ----------- | ------------ |
| Ravi Naidoo | **Lead** | $30.00      | Aug 24, 2026 |

The money is right. The date is right. The stage says he has never bought anything.

## It was not "the feature is missing"

That is what made it worth chasing. Two of her buyers were filed correctly:

| Who             | Order        | State of that order   | Stage      |
| --------------- | ------------ | --------------------- | ---------- |
| Anneliese Vogt  | O-000004     | fulfilled, part paid  | customer ✓ |
| Jo Kim          | O-000005     | fulfilled, part paid  | customer ✓ |
| Tessa Wren      | O-000002/3   | placed, **unpaid**    | customer ✓ |
| Rowan Ellery    | O-000006     | placed, **unpaid**    | customer ✓ |
| **Ravi Naidoo** | **O-000001** | **placed, part paid** | **lead** ✗ |

Read the last two rows together. Tessa and Rowan have not paid a penny and are customers.
Ravi has handed over $30 and is a lead. The one person in the list who put money in her
hand is the one the CRM says is a stranger.

The difference is not the money and not the state. It is the door:

```
O-000001   channel: admin        source: till                <- lead
O-000002   channel: storefront   source: commerce_checkout   <- customer
O-000006   channel: storefront   source: commerce_checkout   <- customer
```

**Web orders promote the buyer. A sale rung up at the counter does not.**

## Why

The promotion was a nudge at the call site, and there were two call sites.

`checkout-service.ts` promoted the buyer when it linked them to a storefront checkout.
`channel-order-ingest.ts` carried its own copy of the same three lines for marketplace
orders. The till posts `POST /v1/orders` through `orderService.create`, which is neither
of them, so it promoted nobody.

The platform states the promise plainly in the MCP tool description a person or an AI
reads before writing a customer:

> A first completed order later promotes them to the `customer` stage automatically.

True on the web. Not true across a counter. And "completed" is not the rule either —
Tessa's unpaid order promoted her.

## What it cost beyond one wrong word

`lifecycleStage` is not decoration. It is the field segments filter on, that scoring
models weight, that automations trigger from, and that the Customers list sorts and
groups by. A shop that sells mostly in person would have every one of those quietly
excluding the people who actually buy from it — and nothing on any screen would look
broken, because "Lead" renders exactly like a correct answer.

## The fix

`recomputeCustomerCommerce` in `wizeworks/packages/crm/src/services/customer-rollup.ts`
already exists for precisely this failure. Its header is worth quoting, because it was
written about `total_spent` and describes this bug word for word:

> They were maintained by the `order.created` consumer with `{ increment: payload.total }`
> … **Lost.** A consumer whose transaction failed was swallowed … **Unrepairable.**
> Nothing recomputes, so a single lost event is permanent.

"Has this person ever bought from us" is the same kind of fact as the four figures that
function already derives, so it is now derived there too, in the same transaction as the
order:

```ts
const becomesCustomer =
  rollup.orderCount > 0 && current !== null && !SETTLED.includes(current.lifecycleStage);
```

That gives it the three properties the figures have. A path that forgets to promote is
healed by the next write. Promoting twice is a no-op. The stage can never disagree with
the orders on the same screen.

It only ever moves **forward**: someone already `customer` or `evangelist` keeps that, a
cancelled order demotes nobody, and a stage set by hand on the customer's own pane is
never walked back. The one thing it does is stop a buyer being filed as a stranger.

Checkout's private copy of the rule is gone — it runs `orderService.create` in the same
transaction, so the derived rule reaches it. Marketplace ingest keeps its own, because it
writes the order row directly and does not call the rollup at all, which turns out to be
its own bug (below).

## One more, found on the way

`channel-order-ingest.ts` composes the order with `tx.order.create` rather than
`orderService.create`, so it never ran the rollup either. A marketplace order arrives
**already paid** (`amountPaid: total`), and none of it ever reached the buyer's total
spent, order count, or first/last order date. It now calls the rollup in the same
transaction, one line, alongside its audit write.

Devi has no marketplace channel, so this is not something she could have seen. It is the
same omission as hers, one directory away.

## Verified by doing it

As Devi:

1. **Take a sale** → Marguerite Adeyemi (a lead, $0.00, no orders) → Leather-covered belt
   $72 → cash → Write it down. Order O-000007. Her record: **customer**, $72.00, one
   order. The stage moved on the till path, which is the path that never worked.
2. Ravi's own record healed without being touched directly: she took the $66 he still
   owed on O-000001 through the order's own payment box, and the recompute that ran for
   the payment promoted him. **customer**, $96.00.
3. Every buyer of Juniper Row now reads `customer`. The two who have paid nothing still
   read $0.00 spent, which is correct and separate.

## The lesson worth keeping

The same one as [278], two days running: **a rule copied to each caller is a rule that
one caller will not have.** The way to tell the difference is to ask what the field
actually MEANS. "Has bought from us" is a summary of their orders, so it belongs where
their orders are summarised — not at each of the three places an order can be born.
