# 760 — An order she took herself could not be found by its number

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 269
**Surface:** platform — every order and invoice not raised on the website
**Filed:** 2026-09-20
**Fixed:** 2026-09-20
**Confirmed by:** P03, on screen and against the live search index
**Blocked on:** —

## What happened

A shop phoned an order through and she typed it in at the counter. Four minutes
later she went looking for it the way anybody looks for anything here, by
typing its number into the box at the top of the console:

```
O-000018
  Orders
    #O-000016   Marguerite Adeyemi · fulfilled
    #O-000015   Marguerite Adeyemi · fulfilled
    #O-000014   Marguerite Adeyemi · fulfilled
    #O-000013   Anneliese Vogt · fulfilled
    …
```

The numbers either side of it. Not the one she asked for. **The order was open
in the next pane at the time.**

The same thing with an invoice: `INV-000011` returned `INV-000001` and
`INV-000010`, which is a worse answer than nothing, because two plausible
invoices come back and neither is hers.

## MEASURED, before the fix

Against the running database and the live search index, for Juniper Row:

|                          | in the database | findable |
| ------------------------ | --------------- | -------- |
| orders                   | 18              | 16       |
| invoices raised that day | 3               | 0        |

The two unfindable orders were the two most recent, and they were the only two
written after the index was built. Every order that came in through the
**website** was there. The two that were not came from:

```
 order_number |  channel   |        source
 O-000018     | admin      | till
 O-000017     | storefront | subscription_renewal
```

One typed in at the counter. One raised by a repeat order coming round.
[[feedback_absent_behaves_like_fine]]

## Why: an announcement nobody could hear

An order is announced to the rest of the platform on **`order.placed`**. The
search indexer, the ship-direct router and every automation keyed on "a new
order" subscribe that topic, and only that topic.

`checkout-service` was the only thing that published it.

Everything else calls `orderService.create`, which publishes **`order.created`**
— the CRM spine's own in-process signal, read by the consumer that writes the
customer's timeline row. That part is correct and is not the bug. The bug is
that `order.created` was ALSO teed onto the broker, where:

- it is not in the event catalog (`wizeworks/packages/events/src/types.ts` names
  `order.placed`, and the root CLAUDE.md says in as many words that there is no
  `order.created`), so no worker subscribes it;
- it is in no automation trigger vocabulary either, so no tenant can key on it.

So the till and the repeat-order tick announced their orders onto a subject
with nobody at the other end. **A publish that reaches nobody looks exactly
like one that works** — no error, no log, no failing test. The order is written,
the screen is right, the activity feed is right, and only the search box knows.

## The same shape again, on invoices

Indexing a billing document happened at the **route layer**: six hand-written
`indexEntity` calls in `api-rest/src/routes/v1/invoicing/documents.ts`, each
with a good comment explaining itself. Two other routes raise a real, numbered
invoice and neither had one:

| route                          | what she pressed                 | indexed |
| ------------------------------ | -------------------------------- | ------- |
| `POST /v1/invoicing/documents` | New invoice                      | yes     |
| `POST /v1/orders/:id/invoices` | **Make an invoice**, on an order | no      |
| `POST /v1/b2b/invoices`        | **Raise an invoice**, wholesale  | no      |

Three ways to raise a bill, one of them findable.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## What was done

**The order service announces the order.** `orderService.create` now publishes
`order.placed` itself, and `order.placed` is teed to the broker. Every caller
gets it: the till, an order typed in over the phone, a repeat order, any caller
of `POST /v1/orders`, and anything anybody writes next.

The one caller that must decide for itself passes `{ announce: false }`:
`checkout-service`, because a wholesale order over a sign-off limit publishes
`b2b.order.pending_approval` instead and waits for somebody to approve it before
inventory and dispatch may act. That is the exception, it is typed, and it says
why in the argument list.

**`order.created` is no longer teed.** It stays exactly what it is — in-process,
for the CRM consumer, which is unaffected because the tee was additional to the
in-process delivery, not instead of it.

**Invoices index off the event, not the route.** `crm.billing_document.*` maps
to the universal `billing_document` projector, so every service that announces a
document reindexes it whatever route called it. The wholesale topic
`b2b.invoice.created` gets a case in the indexer, because its three publishers
(the wholesale route, a sign-off being approved, and a checkout on terms) all
publish straight onto the broker. The six route-level calls stay: three are now
belt-and-braces, and three cover actions whose service publishes nothing —
update, send and delete.

**`check:broker-topics`** fails the build on any topic teed to the broker that
neither the event catalog names nor this check lists as fan-in-only WITH the
file that reads it. Wired into `pre-push`.

## Files

- `wizeworks/packages/crm/src/services/order-service.ts` — publishes `order.placed`; `CreateOrderOptions`
- `wizeworks/packages/crm/src/pubsub-bridge.ts` — the tee set, and `billing_document` in the universal map
- `wizeworks/packages/commerce/src/services/checkout-service.ts` — the one opt-out
- `wizeworks/packages/commerce-indexer/src/handler.ts`, `src/index.ts` — `b2b.invoice.created`
- `scripts/check-broker-topics.mjs` — new
- `package.json`, `.githooks/pre-push` — wired

## Proof

Read on screen 2026-09-20, after the fix, doing the thing that failed:

**An order at the till.** Leather-covered belt to Loom and Larder, $43.20 at
their wholesale price. Written down as **O-000019**. Typed into the box at the
top of the console:

```
O-000019
  Orders
    #O-000019   Tamsin Vale · delivered
```

First result, the right one. The index agrees: `found: 1`.

**An invoice from that order.** Make an invoice → **INV-000014**, in the index
within seconds through the route that had never indexed anything.

**A wholesale invoice.** Raise an invoice → **INV-000015**, $65.00, "Sample pack
for the spring range", in the index through the other route that had never
indexed anything.

Of Juniper Row's invoices, the two raised after the fix are both findable and
the two raised before it are not, which is the fix's own before-and-after
sitting side by side.

`check:broker-topics` was proved red three ways before it was believed:
[[feedback_a_test_that_cannot_go_red]]

| what was broken                     | what it said                                                |
| ----------------------------------- | ----------------------------------------------------------- |
| `order.created` put back in the tee | names it, and why a teed topic must have a reader           |
| the catalog file renamed            | refuses, rather than passing over nothing                   |
| `PLATFORM_TEE_TOPICS` renamed       | refuses, and says to update the check rather than delete it |

Its own first draft was wrong and said so loudly: a `[\s\S]*?;` regex over the
`EventType` union stopped at a semicolon inside a prose comment and swallowed an
apostrophe from another, so it read 188 "names" — the last of them a sentence
fragment — cleared its own length sanity check, and reported all six real order
topics as MISSING. It walks the union line by line now.
[[feedback_structural_checks_go_blind]]

crm 251, commerce 225, commerce-indexer 15, and 60 structural checks pass.

## What is not fixed by this

Records written **before** today stay unfindable until something changes them or
a reindex runs. Juniper Row's `INV-000012` and `INV-000013` are the two on this
machine. That is the same shape as the backfill in
[755](755-an-invoice-raised-by-mistake-is-permanent.md): a template fix reaches
what comes next, and what already exists is a pipeline job.
[[feedback_data_is_a_deploy_stage]]
