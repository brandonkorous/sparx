# 225 — Twenty returns for sales that do not exist

**Status:** fixed and confirmed
**Severity:** major
**Found by:** P03 · Juniper Row · act 7
**Surface:** mypiggles › Sell › Returns
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** P03 · Juniper Row · act 7, on screen — twenty rows now read "The sale is gone · Nothing to do", and the pane offers no actions

## What happened

Opening Sell › Returns for the first time, Devi found twenty of them.

```
Order   Customer            Asked          Wants           Items  Stage
–       Unknown customer    Aug 18, 2026   Money back      1      Needs a decision
–       Unknown customer    Aug 18, 2026   Money back      1      Needs a decision
–       Unknown customer    Aug 18, 2026   Money back      1      Needs a decision
…                                                                 (twenty of these)
```

Every row: no order number, no customer, dated before her shop existed. Opening
one showed an item called **"Item"**, a reason, a customer note — and two live
buttons:

> **Approve this return.** Accept the goods back and tell the customer it is on.
> **A prepaid label is bought automatically if a carrier is connected.**
>
> **Turn this return down.**

## What should have happened

They should not exist. Failing that, a screen should not ask somebody to make a
decision about a thing it cannot name.

## Why it matters

Two harms, and the second is the one with money in it.

**The work queue is unusable.** Returns is a list you open to answer "what needs
me right now". Twenty permanent rows that always need a decision and can never
be decided is a queue that never empties — and Devi's three REAL returns, when
she finally had some, sorted underneath them.

**And the pane offered to spend money on a phantom.** "Approve" buys a prepaid
return label from a carrier. Approving a return whose order does not exist means
paying for postage on goods that cannot be named, from a customer who is not
there.

The rendering was individually reasonable and collectively a lie. Three separate
`?? fallback` expressions — `orderNumber ?? '—'`, `customerName ?? 'Unknown
customer'`, `orderItemName ?? 'Item'` — each sensible on its own, together
turning "this record points at nothing" into a normal, actionable row. **"Unknown
customer" is a guess dressed as a fact: the customer is not unknown, there is
nobody to know.**

## Where it lives

Two things, one of which is a lie in a comment.

**The sample-data cleaner believed in a cascade that does not exist.**
[clear.ts](../../../../wizeworks/packages/db/src/sample-data/engine/clear.ts):

```ts
// Orders (cascade items/payments/fulfillments/returns), deals.
await tx.order.deleteMany({ where: { tenantId, metadata: sampleMeta } });
```

`ReturnRequest.orderId` is a **bare uuid column with no foreign key** — the model
relates to `Tenant` and to its own children, and never to `Order`.
`ReturnLineItem.orderItemId` is the same. So deleting the orders left every
return behind, fully intact and pointing at nothing.

Four sample reloads, four sets of five. Across the whole database three tenants
carry orphans and one of them has exactly five joined and five dangling — the
signature of loading twice.

**The screens presented the wreckage as work.** `returns-list.tsx` and
`return-detail.tsx` had no notion that a return might have no sale.

## The fix

**Delete them, and stop drawing the ones already out there as decisions.**

- `clear.ts` removes a sample order's returns explicitly, before the orders, and
  the comment no longer claims a cascade it does not have.
- `orderNumber === null` is the one honest test for "the sale is gone" — a real
  order always has a number, so a null one means the lookup found nothing. On
  that, the list row reads **"The sale is gone · Nothing to do"**, and the pane
  swaps its stage message for one that says what happened and offers **no
  actions at all**.

The row and the pane say the same thing rather than one contradicting the other,
and neither pretends to know a customer.

## What it did NOT fix

**The filter chips still count them.** "Needs a decision" is a server-side filter
on stored status, and these are still stored as `requested`, so that chip lists
four rows that each say "Nothing to do". The row tells the truth, so nobody is
misled — but the count above it is still wrong. Teaching the list endpoint to
exclude returns with no order is the real fix and is bigger than this surface.
**Blocked on: scope.**

**The foreign key is still missing.** Adding `ReturnRequest.orderId →
Order(id) ON DELETE CASCADE` would make this impossible by construction rather
than by remembering. It needs a migration, and one that deletes the existing
orphans before it can be applied. **Blocked on: pipeline.**

## Rating effect

`Sell › Returns` in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
