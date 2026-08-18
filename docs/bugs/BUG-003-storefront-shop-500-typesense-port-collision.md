# BUG-003 — Storefront `/shop` (and all search) 500s: Kubernetes service-link shadows `TYPESENSE_PORT`

Status: ✅ **FIXED — VERIFIED IN PRODUCTION 2026-07-24**

Verified after deploy: `https://keen-cedar-6433.sparx.zone/shop` → **HTTP 200** (was 500),
and `GET /v1/public/commerce/search?tenant=keen-cedar-6433` returns the real indexed
product. That second fact also proves the **commerce-indexer writes recovered** — the
same collision had been breaking indexing, so a working search result means both the
read and write paths are healthy again.
Severity: **Critical** — every faceted PLP (`/shop`) and every product/⌘K search 500s in prod
Found: 2026-07-24, diagnosing the test tenant `keen-cedar-6433.sparx.zone/shop`
Surface: `wizeworks/packages/search` (Typesense client) + `wizeworks/services/api-rest` (`/v1/public/commerce/search`)

## Symptom

`https://<tenant>.sparx.zone/shop` returns **HTTP 500**. The page renders a silica host-core
faceted PLP that calls `GET /v1/public/commerce/search`, which 500s. This is NOT a
page-composition bug (the original suspicion) — the page is fine; its data call fails.

## Root cause (confirmed in prod logs + pod env)

api-rest logs:

```
Request to Node 0 failed due to "ERR_INVALID_URL Invalid URL"
input: "http://typesense:null/collections/products/documents/search"
```

Pod env:

```
TYPESENSE_HOST=[typesense]  TYPESENSE_PORT=[tcp://10.0.23.160:8108]  TYPESENSE_PROTOCOL=[]
```

Because a Kubernetes **Service named `typesense`** exists in the namespace, Kubernetes
auto-injects the Docker-legacy "service link" env vars for it — including
`TYPESENSE_PORT=tcp://<clusterIP>:8108`. The app read the port as
`Number(process.env.TYPESENSE_PORT ?? 8108)`; the injected `tcp://…` string isn't nullish so
the `?? 8108` default never fired, and the Typesense client built an
`http://typesense:null/...` URL. This broke **every** Typesense consumer's port resolution —
api-rest reads AND the `commerce-indexer` writes (so product indexing was failing too).

`api-rest.yaml` set `TYPESENSE_HOST` explicitly (so it survived) but not `TYPESENSE_PORT`,
which is exactly the name that collides with the k8s `<SERVICE>_PORT` injection.

## Fix

1. **Code (comprehensive) — `wizeworks/packages/search/src/client.ts`:** `configFromEnv` now resolves
   host/port/protocol defensively via exported `resolveTypesensePort` / `resolveTypesenseHost`
   / `resolveTypesenseProtocol`. The port accepts ONLY a clean positive integer; the `tcp://…`
   string / empty / NaN fall back to 8108. Empty strings coerce to the default. This defends
   every consumer (api-rest, commerce-indexer, ⌘K) regardless of manifest drift or namespace.
   `wizeworks/services/api-rest/src/routes/v1/search.ts` (`/v1/search/key`, which handed the browser a
   NaN port) now routes through the same resolvers.
2. **Manifest (root-cause hygiene) — `k8s/apps/api-rest.yaml`:** `enableServiceLinks: false` on
   the pod spec, which turns off the deprecated Docker-link injection entirely so the bogus
   `TYPESENSE_PORT=tcp://…` is never created. We reach in-cluster deps by DNS + explicit env,
   never by link vars, so this is free and kills the whole class of collision. (Chosen over
   pinning `TYPESENSE_PORT: "8108"` in the env — hardcoding a port in the app deployment
   duplicates the Typesense Service's own value and reads like a magic number; the code fix
   already handles the value, so the manifest's job is just to stop the pollution.)

## Deploy + verify

- Code fix ships in the api-rest **and commerce-indexer** images (both use `@wizeworks/search`).
- After deploy: `curl -sI https://<tenant>.sparx.zone/shop` → 200; product search + ⌘K return
  results; confirm the indexer is writing (a product appears in search).
- Note: even after the URL fix, search shows results only once the indexer has populated
  Typesense — indexing was broken by the same collision, so allow a reindex/backfill.
