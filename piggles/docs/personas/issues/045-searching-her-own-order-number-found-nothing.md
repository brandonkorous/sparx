# 045 — Searching her own order number found nothing

**Status:** fixed — both the dead routing and the reindex that could never recover from it
**Severity:** **blocker** (no order was EVER indexed when placed, for any tenant)
**Found by:** P01 · Thistle & Rye · act 9 — looking up **O-000001**
**Surface:** mypiggles › the top search bar
**Filed:** 2026-08-21 · **Fixed:** 2026-08-21
**Confirmed by:** P01 · act 9, on the screen

## What happened

Typed `O-000001` — the number printed on her customer's confirmation page — into
the console's own search:

> **Nothing matches that. Try a different word.**

At the same moment, the activity bar in the bottom-right corner of the same
window read **"Checkout completed — O-000001 · 16m ago"**.

## Why it matters

An order number is the one string a business is handed by a customer. "I placed
an order, it's O-000001" is how every phone call about an order starts, and the
answer was that no such thing existed.

And it is the "absent behaves like fine" shape at its sharpest: _"Nothing matches
that"_ is a measurement. It says we looked and there were none.

## Why it happened — two dead cases

`commerce-indexer`'s handler routed:

```ts
case 'order.created':            // does not exist
case 'order.payment.recorded':   // does not exist
case 'order.cancelled':
case 'order.fulfilled':
case 'order.delivered':
case 'order.refunded':
```

The catalog's names are **`order.placed`** and **`order.paid`**
(`wizeworks/packages/events/src/types.ts`), and CLAUDE.md says in as many words
that there is no `order.created`. Its `EVENTS` subscription list omitted both
too.

So the four surviving cases are all LATER lifecycle events, and **an order
entered the search index for the first time only once it was cancelled,
fulfilled, delivered or refunded.** The one moment an order most needs to be
findable — just placed — was the one moment it was not there. That is true of
every tenant on the platform, not just this one.

`check:events` could not see it: that compares the EventType union against
provisioned topics, and both directions of THAT were healthy while a handler
routed a name from neither list. **A `case` for an event nobody publishes is dead
code that reads exactly like coverage.**

## The fix

- `order.placed` and `order.paid` replace the two dead cases, and both are added
  to the subscription list.
- **`scripts/check-worker-events.mjs`** — a new guard. Every name in a worker's
  `EVENTS` list and every event-shaped `case` in its handler must name a real
  event from the same catalogs `check:events` reads. 14 workers, 87 claims. It
  goes red on exactly this defect, and it **refuses to pass on a count of zero** —
  which it needed, because its first run found 0 workers (the `EVENTS` regex did
  not allow for the space before `=`) and cheerfully printed OK.

## The second defect underneath it — one collection sank the whole rebuild

With the routing fixed, her order still would not index, because the operator's
own reindex could not complete: a document the search engine rejected threw out
of `projectAndUpsert`, past the collection loop, and took every collection AFTER
it down too.

Watched happening: `products` rebuilt (10), then the run died on `customers`, so
`orders` and `entities` were never reached. The message nak-ed, redelivered,
rebuilt products again, died again — **ten products re-indexed five times over
while her orders could not enter search by any route at all**, including the
reindex task built to repair exactly this.

`reindexEntities` already documented the intended contract — _"One bad row is
counted, not thrown — same contract as the rich-collection plans"_ — and the rich
collections did not honour it. Now they do: each collection is sealed off and each
batch within it, failures are recorded and reported, and the run still ends in an
error so a rebuild that lost a collection cannot read as success. Same principle
as `reconcileSystemSeeds`' "ONE TENANT CANNOT SINK THE PASS", one level down.

After: `products done → customers FAILED, continuing with the rest → orders done`.

## Confirmed

`O-000001` in the console search now returns **Orders › #O-000001 · placed**, and
opens the order.

## Not a product defect — a local one, and it needs Brandon

The customer collection failing is **this machine's Typesense**, not the code: a
minimal, entirely valid document 500s with "Unhandled Typesense error in index
batch", while a freshly-created collection of the same shape accepts it. The
local `customers` collection is corrupt and wants dropping and rebuilding.
Attempting the DELETE was refused by the sandbox, correctly — it is destructive
on a datastore — so it is Brandon's call.
