# 219 — There was no way to start a return

**Status:** fixed and confirmed
**Severity:** blocker
**Found by:** P03 · Juniper Row · act 7
**Surface:** mypiggles › Sell › An order, and Sell › Returns
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** P03 · Juniper Row · act 7, on screen, an exchange and a refund both settled

## What happened

Anneliese Vogt bought the Ash Overshirt in Clay and wants it in Slate. Devi went
looking for the place to take it back.

The order pane has a payment form, a delivery form, a refund row and a cancel
row. **It has nothing about anything coming back.** Sell › Returns has seven
filter chips, a table, and a detail pane with approve, turn down, receive,
check, four decisions about where the goods go, restocking fees and three ways
to give the money back. **It has no way to add one.**

So Devi could see the whole machine and could not put anything into it.

The order pane's refund row says this, in its own words:

> Refund this order. …To give back only part of it, or to take stock back in,
> **use a return instead.**

It is telling her to use something that has no door.

## What should have happened

A customer emails to say a thing is going back. The shop writes that down
against the order it came from. Everything else the returns screens can already
do follows from that one act.

## Why it matters

This is not a missing field or a wrong sentence. **An entire module is sealed.**

Behind the missing door, all of this is built and works: the nine-state
lifecycle, per-line approved quantities, prepaid label purchase, condition
grading, the four dispositions and the stock movement each one causes,
restocking fees, and refunds routed back to the card, to store credit or to a
gift card. Every one of those is reachable only from a return, and no return can
be created.

For a maker selling clothing in fifteen size-and-color combinations, **the
exchange is not an edge case — it is the second most common thing that happens
after the sale.** Devi left a marketplace that handled it. What she has instead
is a screen that lists returns she cannot create and, until this was fixed,
could only ever show her the twenty fake ones the sample data left behind
([225](225-twenty-returns-for-sales-that-do-not-exist.md)).

The tell that this was never driven by a person: `returnService.create` is
written, validated, audited and publishes `return.requested` — and **has no
caller anywhere in the repository.** Not the console, not the website, not the
REST API, not MCP. A test can pass on a function nobody can reach. Only opening
the screen and looking for the button finds this.

## Where it lives

Three places, all of them absent rather than wrong:

- **No route.** `wizeworks/services/api-rest/src/routes/v1/commerce/providers.ts`
  wires seven return endpoints — list, get, approve, deny, received, inspection,
  disposition, refund — and no `POST /v1/commerce/returns`.
- **No hook.** `returns-data.ts` mirrors the state machine one hook per
  transition, and starts at approve.
- **No control.** Neither `order-detail-body.tsx` nor `returns-list.tsx` offers
  one.

## The fix

**A return starts where the sale is**, because that is where Devi is when the
email arrives and it is the only screen that knows what was bought.

- `POST /v1/commerce/returns` wires the service that was already there. The
  console route pins `requestedBy` to `staff` rather than taking it from the
  body — Devi opening it on a customer's behalf is a fact about who typed it,
  not a choice, and it is what the audit entry records.
- A **Something coming back** section on the order pane, between the deliveries
  and the money. It lists the lines that are actually still returnable, takes a
  quantity per line, one reason, and what the customer wants instead. It opens
  the new return when it is saved.
- It is offered only once something has actually gone out. **Before that the
  move is to cancel, and the pane already offers that** — a shop cannot take
  back what it has not sent.

The quantity ceiling is what was SENT, not what was ordered, and lines already
covered by an open return are counted out. Both matter on a made-to-order shop
where half an order can ship weeks before the rest.

## What it looked like once fixed

Anneliese's exchange, end to end, without leaving the console: the Clay
overshirt recorded as coming back, approved, received, checked as as-new, put
back on sale, and the replacement Slate one sent. Stock moved by exactly one in
each direction and **no money moved at all**, which is the whole point of an
even exchange.

## Rating effect

`Sell › An order` and `Sell › Returns` in [rating.md](../rating.md). Recorded in
the run log of [03-juniper-row.md](../03-juniper-row.md).
