# 513 — sparx could not tell you its storefront was invisible, or do anything about it

**Status:** fixed and proven
**Severity:** major
**Found by:** checking whether the empty local search index was a broken pipeline
**Surface:** products list, sparx console only
**Filed:** 2026-09-15

## How it was found, and what I had wrong

The local Typesense index held **20 documents across 113 tenants**, and I had
recorded the cause as "`sparx-nats` is unhealthy, so event-driven indexing is
dead locally". Both halves of that were wrong.

**The broker was fine.** Its healthcheck was not:

```
sh: can't open /dev/tcp/127.0.0.1/8222: no such file      FailingStreak: 1355
```

`/dev/tcp` is a BASH feature and the image's `sh` is busybox ash, so the probe
could never pass and `sparx-nats` had reported `(unhealthy)` since the day it
was written, whatever the broker was doing. Asked directly, NATS answered:
version 2.10.29, JetStream up, 3.5MB stored, **1050 API calls and 0 errors**.
The stream held 7,906 messages and `commerce-indexer` had consumed 9,526 with
**zero pending**.

The compose file already carries the corrected `wget` probe with a full
explanation; the running container simply predates it. Proven in the live
container: old probe exits 1 against a healthy broker, new probe exits 0, and
exits 1 again against a dead port. **It needs recreating, not fixing.**

**The index was empty because nothing had ever backfilled it.** Event-driven
indexing only indexes what CHANGES, and 113 tenants of seeded data changed
nothing. Every one of those 20 documents was an integration-test fixture:
"Bosch Fuel Injector" and "Site A Widget" under `tenant-a` / `tenant-b`.

This is the "a status code is not a screen" lesson wearing different clothes: a
container's health LABEL is not the container's health, and I had carried a
wrong diagnosis forward for a whole session on the strength of one word.

## What was actually broken

The Piggles console handles this well. Its products list reads
`GET /v1/search/status`, and when products are on sale that searching cannot
find it says so and offers the fix:

> **Searching your shop won't find 31 of your products**
> They are on your site and people can buy them. What isn't working is the
> search box and the filters beside your shop…
> [Put them back]

**Sparx had none of it.** No `SearchStatus` type, no `useSearchStatus`, no
`useReindexSearch`, no notice. It runs the same api-rest, the same worker and
the same Typesense, and a sparx operator whose storefront was serving "No
products found" over a full catalog had no way to learn it and no way to fix it.

`POST /v1/search/reindex` had exactly one caller in the whole repo, in Piggles.

## What changed

Ported into sparx, in its own vocabulary:

- `SearchCollectionStat`, `SearchStatus`, `useSearchStatus`,
  `unfindableProductCount`, `indexedProductCount`, `useReindexSearch`
- a notice on the products list, `color="info"` because the storefront falls
  back to the catalog and what is broken is the search box beside it

> **Search cannot find 107 of your products**
> They are on the storefront and customers can buy them. What is not working is
> the search box and the facets beside it, which look products up in a separate
> index that these are missing from. A customer searching for one by name is
> told it does not exist.
> [Rebuild the index]

The count goes in the heading. "Some of your products" is a sentence nobody can
act on; 107 is checkable against a catalog the operator knows.

## Proven, both ways

|                        | products in the index | notice                                      |
| ---------------------- | --------------------- | ------------------------------------------- |
| before                 | 40                    | **Search cannot find 107 of your products** |
| after pressing Rebuild | 148                   | gone                                        |

Customers went 41 → 483 and the universal collection 257 → 3,469 in the same
run. The notice appearing at 107 and disappearing at 0 is the guard proven red
and then green, on screen.

## Not fixed here

`sparx-nats` still reports `(unhealthy)` until the container is recreated from
the current compose file. Nothing in the repo needs changing.
