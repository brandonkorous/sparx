---
title: Terraform
node: infrastructure
type: rule
status: active
sources:
  - terraform/envs/prod/
  - terraform/modules/
---

Terraform owns the GCP platform. Layout: `bootstrap/` (TF state) · `envs/prod/` (`main.tf`, `serverless.tf`, `cloudflare.tf`, `automation.tf`) · reusable `modules/` (vpc, gke, cloud-sql, artifact-registry, pubsub, secrets, storage, cloud-run-worker, monitoring).

- **VPC:** custom `10.0.0.0/16` carve-up, PSA peering for Cloud SQL private IP, internal IPs for Typesense + PgBouncer (`10.0.0.55`), a `/28` serverless VPC-access connector.
- **Cloud Run workers** (`serverless.tf`): each with a per-worker runtime SA (tight blast radius) + a Pub/Sub push subscription.
- **Secret Manager** ~35 secret containers; **Workload Identity** GSA `sparx-app`.

**Rule — no drift:** any imperative change to a TF-managed resource must be mirrored back into TF the **same session**. The imperative escape hatch is the exception, not the workflow.

Related: [[topology]], [[cost-and-ops-guardrails]], [[deploy-workflows]]
