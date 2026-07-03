---
title: Deploy workflows
node: infrastructure
type: reference
status: active
sources:
  - .github/workflows/
---

The release chain — all via **Workload Identity Federation** (no SA keys); GKE reached via Connect Gateway:

- **ci.yml** — PR + push: lint, typecheck, test (Turbo).
- **auto-tag.yml** — push to `main`: conventional-commit analysis → SemVer tag → dispatches build-images ([[releases-are-automated]]).
- **build-images.yml** — on `v*` tag: build + push all images to Artifact Registry → dispatches deploy-prod (so rollout never races the image).
- **deploy-prod.yml** — on `v*` tag: roll the tag's image into each Deployment + smoke check. **Migrations are NOT here.**
- **db-migrate.yml** — on `main` touching `packages/db/prisma/**` etc.: a K8s Job runs `prisma migrate deploy` against private-IP Cloud SQL ([[migration-pipeline]]).
- **bootstrap.yml** — manual: one-time platform bring-up (namespaces, SAs, Caddy, Redis, PgBouncer, Typesense) — separate blast radius.
- Plus **cleanup-images**, **marketplace-ingest/purge** (manual, purge is confirmation-gated).

**Cluster mutations go through these workflows** — never manual `kubectl apply` ([[cost-and-ops-guardrails]]).

Related: [[releases-are-automated]], [[terraform]], [[migration-pipeline]]
