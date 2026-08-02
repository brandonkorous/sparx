---
title: Terraform
node: infrastructure
type: rule
status: active
sources:
  - terraform/envs/azure/
  - terraform/bootstrap-azure/
  - terraform/envs/prod/
  - terraform/modules/
---

Terraform owns the cloud. **It runs in the pipeline**, as stage 1 of
[release.yml](../../../.github/workflows/release.yml) — not from a laptop.

Layout: `bootstrap-azure/` (state backend + the CI identity) · `envs/azure/`
(the live platform) · `bootstrap/` + `envs/prod/` (GCP, code-only) · reusable
`modules/` (`dns` is shared by both envs; vpc, gke, cloud-sql,
artifact-registry, pubsub, secrets, storage, cloud-run-worker and monitoring are
GCP).

## Azure — the live environment

`envs/azure` holds the AKS cluster, the managed Postgres (public access
**disabled**, VNet-only), the reserved ingress public IP
(`pip-ingress-sparx-prod-cus`, attached by the `azure-pip-name` annotation in
`k8s/azure/infra`), DNS via the shared `modules/dns`, and the Cloudflare origin
certificate written straight into the `caddy-admin-origin` Secret.

State lives in Azure Storage with `use_azuread_auth`, so it is read with the
run's Entra token and **no storage key exists to leak**. The state resource
group is deliberately separate from the workload, so a `destroy` of the platform
can never take the state describing it.

`bootstrap-azure` is **the one thing applied from a laptop, ever** — it creates
the state backend and the OIDC identity, and neither can be created by the
pipeline that depends on them. Its own state is deliberately LOCAL and contains
no secrets (OIDC means there is no client secret to store). CI `validate`s it
precisely because nothing else exercises it, and the moment it is needed is the
worst moment to discover it no longer compiles.

## Destructive plans stop the release

An additive plan applies unattended. A plan containing `delete` — alone, or as
the `["delete","create"]` pair that means a REPLACEMENT — is refused, the
resources are named in the run summary, and proceeding requires a manual
dispatch with `allow_infrastructure_destroy`.

**A `delete` nobody asked for is almost always an unset Terraform variable**,
not a real intent. The release passes every input explicitly from a GitHub
variable or secret, and an unset one silently takes the default in
`variables.tf` — several of which turn features (DNS, the origin certificate)
off. Check the variables before believing the plan.

## GCP — code, not a deployment

`bootstrap/` + `envs/prod/` still describe the GKE platform — the
`10.0.0.0/16` VPC with PSA peering for Cloud SQL, the Cloud Run workers with a
per-worker runtime SA each, ~35 Secret Manager containers, the `sparx-app`
Workload Identity GSA — and still hold their GCS-backed state. But **no workflow
applies them**: the GCP workflow set was deleted when the platform settled on
Azure. They stay in the tree and stay `validate`-clean in CI, because "we still
have the GKE definition" is only true while it is valid HCL — and because
`modules/dns` is shared, so a change made for Azure that breaks the other
consumer is caught there.

**Rule — no drift:** any imperative change to a TF-managed resource must be
mirrored back into TF the **same session**. The imperative escape hatch is the
exception, not the workflow. Running `az` or `kubectl` against the platform by
hand for anything other than READING state is a gap in the automation.

Related: [[topology]], [[cost-and-ops-guardrails]], [[deploy-workflows]]
