---
title: Deploy workflows
node: infrastructure
type: reference
status: active
sources:
  - .github/workflows/
---

**Workflows are named for the PROVIDER; environment is an input.** `deploy-azure.yml` / `deploy-gcp.yml`, `db-migrate-azure.yml` / `db-migrate-gcp.yml` — never `deploy-prod.yml`. Provider dictates the mechanics (auth, registry, how you reach the cluster); `prod` vs `staging` is a `choice` input inside one file. Naming by environment forces a file per (provider × environment) and makes running both clouds a rewrite instead of a toggle.

The build workflows are the deliberate exception, named for the REGISTRY that couples them: Artifact Registry is a GCP service, while GHCR is GitHub's and cloud-neutral.

## Live — Azure (AKS `aks-sparx-prod-cus`, centralus)

Authenticates by **OIDC federation** to Entra; no stored credential.

- **ci.yml** — PR + push: lint, typecheck, test (Turbo).
- **build-images-ghcr.yml** — push to `main`, path-filtered to `apps/`, `services/`, `packages/`: builds each image to GHCR tagged with the commit SHA.
- **deploy-azure.yml** — on that build's success (`workflow_run`). Three jobs: `prepare` (secrets, Cloudflare Tunnel config, resolve which SHA has images) → `migrate` (calls db-migrate-azure) → `rollout` (pin, apply, wait). **Two SHAs**: the build is path-filtered, so an infra-only commit publishes nothing and `prepare` walks back to the newest ancestor that has images. Pinning HEAD blindly rolls out tags that were never pushed.
- **db-migrate-azure.yml** — reusable (`workflow_call`) + dispatchable. Roles Job (`sql/azure-bootstrap.sql`, which CREATEs as well as GRANTs) then `prisma migrate deploy` in-cluster, because the server is VNet-private ([[migration-pipeline]]).
- **restore-from-export.yml** — manual: restores the Postgres dump and/or media tarball from Blob Storage under a short-lived user-delegation SAS.
- **auto-tag.yml** — push to `main`: conventional-commit analysis → SemVer tag. **Dispatches nothing** ([[releases-are-automated]]).

## Fallback — GCP (GKE Autopilot, still running with data)

Via **Workload Identity Federation** (no SA keys); GKE reached via Connect Gateway.

Every trigger is neutered by a `__disabled__` branch/tag sentinel **inside each file**, so a tag or a schema edit cannot roll the standby forward by accident. The switch is in the file and not `gh workflow disable` because GitHub keys that state to the file PATH — a rename produces a new workflow that arrives **enabled**, which is exactly what nearly re-armed all three during the rename to these names.

- **build-images-gcp.yml** — manual: build + push all images to Artifact Registry → dispatches deploy-gcp (so rollout never races the image).
- **deploy-gcp.yml** — manual: roll the tag's image into each Deployment + Cloud Run service, then smoke check. **Migrations are NOT here.**
- **db-migrate-gcp.yml** — manual: a K8s Job runs `prisma migrate deploy` against private-IP Cloud SQL.
- **bootstrap.yml** — manual: one-time platform bring-up (namespaces, SAs, Caddy, Redis, PgBouncer, Typesense) — separate blast radius.
- Plus **cleanup-images**, **marketplace-ingest/purge** (manual, purge is confirmation-gated).

**Cluster mutations go through these workflows** — never manual `kubectl apply` ([[cost-and-ops-guardrails]]).

Related: [[releases-are-automated]], [[terraform]], [[migration-pipeline]]
