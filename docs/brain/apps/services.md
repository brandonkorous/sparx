---
title: Services
node: apps
type: reference
status: active
sources:
  - services/
  - k8s/apps/
  - terraform/envs/prod/serverless.tf
---

**18 services**, all real (Fastify / Node TS, `tsx`, `main: src/index.ts`).

**API services (in-cluster GKE Deployments):**

- **api-rest** `@wizeworks/api-rest` — the primary REST write path; also hosts `/ws/chat` + the Layer-2 customer Better Auth. env 3100 / k8s 3000. (replicas clamped to 1 — SSD quota; see [[cost-and-ops-guardrails]].)
- **api-graphql** — GraphQL transport over the shared service layer. 3200.
- **api-mcp** — first-class staff/tenant MCP ([[mcp-server]]). 3000.
- **mcp-site** — shopper-facing MCP over `/v1/public/*`. 3200.

**Workers: THREE Deployments** (`k8s/self-hosted/workers.yaml`), pull consumers on the in-cluster NATS JetStream broker. The Cloud Run push era is over; see `wizeworks/services/CLAUDE.md`.

- **event-worker**: one process running every handler that needs no runtime of its own. Each handler is a LIBRARY in `wizeworks/packages/<name>-worker` exporting `createSubscription(logger)` and a permanent JetStream `DURABLE`, registered in `wizeworks/services/event-worker/src/index.ts`: automation · cache-revalidation (purges the website's cached reads on an owner's save, via the site's `/api/revalidate`; issue 040) · channel-sync · commerce-indexer (→ Typesense) · domain · dropship · email · finance · inventory · legal-seed · markup-recompute · platform-crm · push · social · staff.
- **media-worker**: sharp over image buffers plus the media volume; kept out so a leak cannot take the fleet with it.
- **import-worker**: bulk file parsing; same reason.

Plus **inventory-bridge** (a CLI runner, not an HTTP server). A new handler is a package, never a new service.

## Media serving (the variant-URL footgun)

Upload is 2-phase (`POST /v1/media/uploads` reserves + budgets → PUT bytes → `/complete`); `media-worker` then transcodes crops. Variants are served by **api-rest** at `media.sparx.works` (Caddy → api-rest:3000, Cloudflare-fronted, `immutable` cache) because the org DRS policy forbids `allUsers` on the GCS bucket. In **GCS mode the private original has no public URL** — the ONLY previewable url is a variant, so a just-uploaded image shows "Still processing…" until the worker finishes (the workbench media query polls while any asset is unready so the preview appears on its own).

**The contract, exact — do not reintroduce the doubled path.** The route is `/v1/public/media/variants/:tenantId/:assetId/:filename` (**3 segments**) and re-derives the storage key with `variantKey()`, which re-inserts the middle `variants/`. The stored key is **4 segments** (`<tenant>/variants/<asset>/<file>`), so the URL must DROP that middle segment — that's `variantUrlPath()` in `wizeworks/services/api-rest/src/lib/storage.ts`, the single source of truth used by BOTH `GcsStorage.publicUrl` and the `/v1/public/media/:id` redirect. Emitting the raw key (with the middle `variants/`) makes a 4-segment URL the route never matches → the request **hangs with no response → Cloudflare 503 → every uploaded image previews broken** (the 2026-07-24 bug; `publicUrl` had drifted from the redirect's strip). Local mode dodges this entirely — it serves via the `file/*` wildcard — so the bug is **GCS-only and never shows in dev**. Locked by `storage.variant-url.test.ts` (the `variantKey → variantUrlPath → route params → variantKey` round-trip).

> **Future (noted, not scheduled):** serve variants **direct from the public GCS bucket via Cloudflare**, bypassing api-rest — this is the real "break media out", NOT a new service. Blocked today by the org DRS policy forbidding `allUsers`; needs a CF-authenticated origin pull or a public-read variant bucket. Removes api-rest from the media hot path with zero new ops. A *dedicated media service* isn't worth it: CF's `immutable` edge cache already keeps api-rest out of the steady-state path.

Related: [[topology]], [[one-service-many-transports]], [[packages]]
