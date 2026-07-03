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

- **api-rest** `@sparx/api-rest` — the primary REST write path; also hosts `/ws/chat` + the Layer-2 customer Better Auth. env 3100 / k8s 3000. (replicas clamped to 1 — SSD quota; see [[cost-and-ops-guardrails]].)
- **api-graphql** — GraphQL transport over the shared service layer. 3200.
- **api-mcp** — first-class staff/tenant MCP ([[mcp-server]]). 3000.
- **mcp-site** — shopper-facing MCP over `/v1/public/*`. 3200.

**Workers (event consumers, port 8080)** — **mid-migration** from GKE pull-subscribers to **Cloud Run push** ([[topology]]); only `email-worker` + `media-worker` remain in `k8s/workers/`, the rest run on Cloud Run:

email-worker · media-worker · commerce-indexer (→ Typesense) · channel-sync-worker · markup-recompute-worker · legal-seed-worker · domain-worker · push-worker · automation-worker · dropship-worker · inventory-worker · import-worker · cache-revalidation-worker · **inventory-bridge** (a CLI runner, not an HTTP server).

Related: [[topology]], [[one-service-many-transports]], [[packages]]
