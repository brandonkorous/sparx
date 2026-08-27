# 281 — "Nothing in your customers matches", said the box, about her customer

**Status:** fixed
**Severity:** **blocker** (no customer was EVER indexed, for any tenant, since the
collection was created)
**Found by:** P03 · Juniper Row · typing a customer's name into the console's search box
**Surface:** the console — the ⌘K search box; and every consumer of the `customers`
search collection
**Filed:** 2026-08-27
**Confirmed:** 2026-08-27

## What happened

Devi types **Beatriz** into the box at the top of the console, which invites her with
"What do you want to do?".

> Nothing matches that. Try a different word.
>
> **Nothing in your orders, customers or products matches "Beatriz".**

Beatriz Salgado is one of her customers. She is in Devi's own Customers list, four rows
from the top, with an email address. The search box named customers as a place it had
looked and then reported, definitively, that she was not there.

Typing **Ravi Naidoo** was stranger still: it returned his ORDER and not him. And typing
the order number **O-000001** returned a different order entirely — #O-000007, someone
else's — with no indication that it was not what she asked for.

## What was actually in the index

```
customers   docs=5      products   docs=6      orders   docs=7
```

Every one of those five customer documents was a fixture left behind by an integration
suite:

```
Legacy Buyer        fleet@acme.test      tenant-s
Dogs Buyer          fleet@acme.test      tenant-s
Cars Buyer          fleet@acme.test      tenant-s
Other Tenant Co     x@other.test         tenant-b
Acme Fleet Services fleet@acme.test      tenant-a
```

**Not one real customer of any tenant had ever been written to that collection.** Same
for products: all six were fixtures, none of Devi's seven. Only two of her orders were
there, and both were ones I had touched myself in the previous hour.

## Why

`commerce-indexer` handles customer events. `handler.ts` carries four cases for them —
`crm.customer.created`, `.updated`, `.deleted`, `.merged` — each one a real event that
`customer-service.ts` genuinely publishes.

And `index.ts`, which is the list of what the worker actually SUBSCRIBES to, named none
of them.

So the handler was routing messages the subscription never asked for. Dead code that
reads exactly like coverage: the cases are real, the subscription entries are real, and
nothing compared the two.

## This had already been found once, in the same file

Directly above the missing entries, in the same array:

> `order.placed` and `order.paid` were BOTH absent, so a new order was never indexed and
> a paid one was never re-indexed. See handler.ts's order case.

And in the handler, at length:

> an order entered the search index for the first time only when it was cancelled,
> fulfilled, delivered or refunded. Which means the one moment an order most needs to be
> findable — just placed, customer on the phone about it — was the one moment it was not
> there.

Whoever wrote those two comments was standing in this exact list, fixing this exact
mistake, and did not notice that the four lines below it had the same hole. Third
instance of that shape in two sessions, after [278] and [280].

## The guard written for this could not see it

There is a check for this — `scripts/check-worker-events.mjs` — created for the order
half. Its own preamble describes the failure as "the subscription list and the handler
drifted apart, and neither one on its own looked wrong."

But what it verified was:

1. every name in `EVENTS` is a real event, and
2. every event-shaped `case` is a real event.

Both judged against the catalog. **Neither judged against the other.** So a `case` for a
perfectly real event that the worker never subscribes to passed both claims, and the
guard watched the drift it was written for happen again.

That is the shape this repo has hit five times in one tree move: a check that hard-codes
what it looks at is one refactor — or one omission — away from printing green over
nothing.

## The fix

Two parts, because fixing only the first would leave the next one to be found by a
person again.

**The subscription.** `commerce-indexer` now subscribes to all four `crm.customer.*`
topics.

**The guard.** `check:worker-events` gained claim 3: every event a handler routes must be
one that worker subscribes to. Gathered per PACKAGE, not per file, because the two halves
live in `index.ts` and `handler.ts` and that separation is precisely how they drift.

The two failure kinds are now reported as different things. They used to share one
trailing sentence — "but no catalog declares it" — which is the wrong diagnosis for a
name the catalog declares perfectly well, and would have sent a reader off to edit the
catalog.

## The new claim immediately found two more

In the same file, first run:

```
wizeworks/packages/commerce-indexer/src/handler.ts
  inventory.low — routed by a `case`, but this worker never subscribes to it in EVENTS
  inventory.depleted — routed by a `case`, but this worker never subscribes to it in EVENTS
```

The handler routes `inventory.adjusted`, `inventory.low` and `inventory.depleted` in one
block: a stock change re-projects the product so search and the market listing stop
saying it is available. Only the first was ever subscribed. **The two events that fire
when something actually runs low or runs out were the two that never arrived.** Both are
now subscribed.

## Proving the guard can go red

A check that has never failed is a check nobody has tested. With one `crm.customer.*`
line removed:

```
Worker event check FAILED: 1 bad claim(s).
  wizeworks/packages/commerce-indexer/src/handler.ts
    crm.customer.updated — routed by a `case`, but this worker never subscribes to it in EVENTS
```

Restored: green.

## Verified by doing it

As Devi:

1. Added a customer, **Odile Marchetti**, through Customers → Add a customer.
2. She appeared in the `customers` collection immediately — the first real customer that
   collection has ever held.
3. Searching **Odile** in the console returned her, under a **Customers** heading that no
   query had ever produced before.
4. Her existing records were still invisible, because the fix indexes from now on and
   heals nothing behind it. The console already has the door for that: the Products list
   showed **"Searching your shop won't find these"** with a **Put them back** button, and
   pressing it rebuilds every collection for the business.
5. After it: `customers 5 → 37`, `products 6 → 13`, `orders 7 → 12`, `entities 4 → 109`.
   Searching **Beatriz** now returns Beatriz Salgado. Searching **Marlow** returns the
   product and both of its photos. The notice on the Products list took itself down.

## Still open, noted not filed

The console can detect an empty PRODUCT index and offer the rebuild in plain language
("Your products are on your site and people can buy them. What isn't working is the
search box…"). Nothing anywhere detects an empty CUSTOMER index. Devi reached the rebuild
because her products happened to be missing too; a shop whose products were fine and
whose customers were not would have had no notice and no button, only a search box
telling her the person she was looking for did not exist.

## The lesson worth keeping

A guard is not evidence until it has gone red on purpose. This one was written for
exactly this bug, passed every run while the bug was live, and the missing claim was the
one its own preamble described.
