# 056 — She published, and her site showed the old page for eight minutes

**Status:** open — the code exists end to end and one link is not connected. Needs Brandon (secrets + fleet config).
**Severity:** major (every publish, every tenant; and the first visitor after the window still gets the old page)
**Found by:** P01 · Thistle & Rye · act 11 — changing Monday's hours
**Surface:** the tenant site › any published page · `wizeworks/services/cache-revalidation-worker`
**Filed:** 2026-08-21

## What happened

She is opening on Mondays through August, so she changed the line on **Find us**
that said _"Closed Mondays"_, saved, and pressed **Publish**.

The console said, correctly and honestly:

> **Published.** Your site catches up within a few minutes.

Timings, measured:

|                                                              |                                            |
| ------------------------------------------------------------ | ------------------------------------------ |
| Published at                                                 | `11:19:31`                                 |
| `builder_pages.silica_published_tree` contains the new words | immediately                                |
| `GET /v1/public/builder/silica/page` returns the new words   | immediately                                |
| The live page still showed the old words at                  | `11:21`, `11:22`, `11:25`, `11:26`         |
| The live page showed the new words at                        | ≈ `11:27` — and only on the SECOND request |

Eight minutes, and the last minute of it is stale-while-revalidate: the first
request after the window expires is served the old page and triggers the refresh,
so one more real visitor reads "Closed Mondays" after the cache has technically
given up on it.

## Why it matters

Publishing is the moment a business owner takes responsibility for what their
site says. "Closed Mondays" is the kind of line somebody changes because a
customer is standing in front of them asking. Eight minutes is long enough to
press Publish twice, then go and look for the setting you must have missed.

And it is not the number that is the problem — it is that the machinery to make
it instant was built, in full, and is not switched on.

## Why it happened

The purge path is complete except for the link that runs it:

| Link                                                                                        | State                              |
| ------------------------------------------------------------------------------------------- | ---------------------------------- |
| Every storefront read tags itself `builder:<slug>` (`lib/silica.ts`, `lib/builder.ts`)      | ✅ built                           |
| `POST /api/revalidate` on the storefront purges that tag                                    | ✅ built                           |
| api-rest publishes `builder.published` / `builder.rolled_back` after a publish commits      | ✅ built (`lib/builder-events.ts`) |
| `cache-revalidation-worker` maps `builder.*` → the `builder` scope and POSTs the storefront | ✅ built, **and nothing runs it**  |
| `SPARX_REVALIDATE_SECRET` on the storefront                                                 | ❌ not set anywhere in `k8s/`      |

`cache-revalidation-worker` is still shaped as a **Cloud Run Pub/Sub-push
service** — an HTTP entrypoint that decodes an OIDC token. The worker fleet
stopped being Cloud Run: it is three Deployments now, and `event-worker`
registers fourteen `createSubscription(logger)` handlers, each living in
`packages/<name>-worker`. This one was never converted. It has no package, no
entry in `event-worker/src/index.ts`, no manifest in `k8s/`, and no mention in
any workflow.

So `builder.published` is published on every publish and consumed by nobody, and
the storefront falls back to its `revalidate: 300` TTL. Which is exactly what
`builder-events.ts` predicted in its own header, when the routes were still
`force-dynamic`:

> _"It stops being harmless the moment ISR is switched on… a publish would show
> nothing until the cache aged out."_

ISR was switched on. The other half was not.

`check:worker-events` (from [045](045-searching-her-own-order-number-found-nothing.md))
does not catch this: it verifies that what a worker CLAIMS to consume is real,
which is the opposite direction. Nothing checks that a published event has a
consumer — and a blanket guard for that would be wrong, because plenty of events
exist for audit and for external subscribers.

## What I did not do, and why

I did not build the package and register it, though the pattern is prescribed and
there are fourteen examples to copy. Two reasons, and the second is the real one:

1. **It cannot work without secrets I must not invent.** `SPARX_REVALIDATE_SECRET`
   is absent from `k8s/` on BOTH sides. The storefront route refuses without it,
   and the worker's `postRevalidate` throws without it — deliberately, so a
   misconfiguration is loud.
2. **Half-wiring it would be worse than today.** Registering the subscription
   without the secret gives a consumer that throws on every matching event and
   naks forever — a retry storm against a stale cache that currently just expires
   quietly. Making it fail soft instead would overrule the original author's
   explicit choice to make that misconfiguration loud.

So the decision is: convert the service to a package, set the secret on both
sides, and add the two env vars to `event-worker`. That is a cluster-secrets
change and it is yours.

**One narrowing worth deciding at the same time.** `planRevalidation` maps by
prefix, and `WorkerSubscription.events` is an explicit list of real event types —
no wildcards. The prefixes currently match **49** of the catalog's 166 events,
and a good third of those cannot change anything a shopper reads: pick lists,
transfers, purchase-order lateness, lot expiry, ABC classification. Subscribing
to all 49 buys a full per-tenant commerce purge every time somebody prints a
picking walk. The list wants narrowing to the events that actually move a
storefront read, with a test asserting every listed event still maps to a scope
so a typo cannot silently subscribe to nothing.

## Also noticed, same flow

**Nothing in the console owns her opening hours.** They are a sentence inside a
paragraph on one page, so changing them means finding the right page, the right
text block and the right sentence. Searching the console for **"hours"** returns
Timesheets, Chat settings, Response times, Saved paragraphs and Bookings
availability — five results, none of them about when the shop is open. For a
business with a door, opening hours are business data: they belong in the footer,
in the structured data search engines read, and in the answer to "are you open
now". Today they are prose, and they are prose in exactly one place.
