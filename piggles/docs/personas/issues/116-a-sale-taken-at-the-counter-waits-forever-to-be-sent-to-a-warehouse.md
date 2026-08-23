# 116 — A sale taken at the counter waits forever to be sent to a warehouse

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · act 8
**Surface:** mypiggles › Sell › Orders › Order
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** see below

## What happened

The first sale written down at the till — Priyanka's $45 bond repair, paid on the
spot — opened with two badges reading **Paid** and **To send**, and one primary
action:

> **Send to the warehouse**

Below it, under **Deliveries**: "Nothing has been sent for this order yet", a
carrier dropdown defaulting to **USPS**, and a tracking-number box.

Nothing was going to be sent. The treatment happened in the chair forty minutes
earlier. Halo & Hem is two chairs in midtown Sacramento and has no warehouse, no
carrier account and nothing to post. Left alone the order stays "To send"
forever, and the Orders list keeps offering it under the **To send** chip as work
outstanding.

## What should have happened

A sale made at a counter is finished when it is made. It should record as
collected, close, and stop asking about despatch.

The platform already knew how to say this. `deliveryPlan()` reads
`metadata.shippingRateRef === 'collection:in-person'` and, when it is set, the
order pane swaps "Where it goes" for "How it leaves", drops the carrier and
tracking fields, and withholds the warehouse walk — with a comment saying why:

> A picking walk for an order the customer is coming to collect routes a bakery's
> own counter staff through a warehouse they do not have.

The till simply was not writing it.

## How to reproduce

1. Take a sale at the till (see [114](114-she-cannot-write-down-money-she-took-in-the-room.md)).
2. Open the order it makes. Before the fix, every time: **To send**, with **Send
   to the warehouse** as the primary action.

## Why it matters

She could not finish the job. Every counter sale accumulates in a queue of work
that will never be done, and the one control offered for it sends her into a
warehouse she does not have.

## Where it lives

- [surfaces/commerce/sale-data.ts](../../../apps/workbench/surfaces/commerce/sale-data.ts) — `useTakeSale`
- [surfaces/commerce/order-types.ts](../../../apps/workbench/surfaces/commerce/order-types.ts) — `deliveryPlan`, `COLLECTION_RATE_REF`

## The fix

The till now writes both halves of the fact:

- the order carries `shippingRateRef: 'collection:in-person'` and
  `shippingDescription: 'Taken at the counter'`, so the pane reads it as
  collected and stops offering carriers, tracking and the warehouse;
- a `delivered` fulfilment with `carrier: 'pickup'` is recorded for every line,
  so the order closes rather than sitting in "To send".

The handover is not optional and is not a checkbox: a sale at a counter is over
when it is made. An order that genuinely needs posting is a different act, and
the order pane can still record one.

Sibling screens checked: the Orders list chips read the same two columns, so both
now report the sale correctly there too.

## Confirmed by

> Re-ran P02 act 8 as Nia. The third sale (Rob Alvarez, dry cut, $40 cash) opens
> **Paid · Collected**, with no "Send to the warehouse" in the toolbar and a
> section headed **How it leaves** reading "Nothing is being posted" and
> "Taken at the counter".

O-000001, the one sale taken before this fix, still reads **To send** —
deliberately left as it is, since it is the evidence. O-000002 was written after
the handover landed and before the site fix, so it reads Collected but is still
missing from Money ([117](117-the-money-she-took-over-the-counter-never-reached-her-money-screens.md)).

## Rating effect

Folded into `Sell › Orders — Completeness 3 → 9`. See [rating.md](../rating.md).
