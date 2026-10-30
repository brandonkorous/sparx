---
title: Terraform
node: infrastructure
type: rule
status: active
sources:
  - wize-infrastructure:terraform/envs/azure/
  - wize-infrastructure:terraform/bootstrap-azure/
  - wize-infrastructure:terraform/envs/prod/
  - wize-infrastructure:terraform/modules/
  - wize-infrastructure:.github/workflows/release.yml
---

Terraform owns the cloud, and **it is not in this repository.** Since
2026-10-29 every `.tf` file lives in
[wize-infrastructure](https://github.com/wizeworksllc/wize-infrastructure)
(`wizeworksllc/wize-infrastructure`, local checkout
`G:/code/@wizeworks/wize-infrastructure`), under the same paths and the same
state keys, and it runs in **that repository's** pipeline
([its release.yml](https://github.com/wizeworksllc/wize-infrastructure/blob/main/.github/workflows/release.yml),
jobs `infrastructure` and `bootstrap`), never from a laptop and never from the
sparx release.

**Why:** the same Terraform serves every product on the cluster (sparx, Piggles,
kanNINJA, jotDOJO, RocketEase, AgConnect, WizeLens, wize.works, silicaui). While
it was stage 1 of sparx's release, a vault for RocketEase or a DNS record for
kanNINJA waited about two hours behind twenty sparx images and a sparx rollout,
and a sparx release could go red on a plan for a product it does not ship.

**How to apply:** a change that needs a database, a vault, a storage account, a
DNS record or an identity is a pull request to wize-infrastructure. Merge it and
let its release finish **before** the sparx change that relies on it ships. A
new event's Pub/Sub topic is the same: add it to `terraform/envs/prod/main.tf`
there (see [[event-driven]]).

Layout (in wize-infrastructure): `terraform/bootstrap-azure/` (state backend,
the CI identities and role grants) · `terraform/envs/azure/` (the live platform)
· `terraform/bootstrap/` + `terraform/envs/prod/` (GCP, code-only) · reusable
`terraform/modules/` (`dns` is shared by both envs; vpc, gke, cloud-sql,
artifact-registry, pubsub, secrets, storage, cloud-run-worker and monitoring are
GCP).

## Azure — the live environment

`envs/azure` holds the AKS cluster, the managed Postgres (public access
**disabled**, VNet-only), every product's vault and storage, the reserved ingress
public IP (`pip-ingress-sparx-prod-cus`, attached by the `azure-pip-name`
annotation in wize-infrastructure's `k8s/azure` overlay), DNS via the shared
`modules/dns`, and the Cloudflare origin certificate written straight into the
`caddy-admin-origin` Secret. It also writes the media storage pair into sparx's
vault `kv-sparx-prod-cus` (`azure-storage-account`, `azure-storage-key`), which
is where sparx's release reads them.

State lives in Azure Storage with `use_azuread_auth`, so it is read with the
run's Entra token and **no storage key exists to leak**. The state resource
group is deliberately separate from the workload, so a `destroy` of the platform
can never take the state describing it. sparx's own CI identity no longer has
access to the state account: the state holds every product's database admin
password, and sparx does not run Terraform.

`bootstrap-azure` creates the state backend and the OIDC identities, and neither
can be created by the pipeline that depends on them, so its first apply is by
hand. After that, wize-infrastructure's `bootstrap` job applies it under its own
identity (subject `environment:bootstrap` in that repository). It is the only job
that can grant a role. sparx's identity (`AZURE_CLIENT_ID` in sparx) keeps
Contributor, AKS access and `Key Vault Secrets User` on `kv-sparx-prod-cus`, and
nothing more; a separate identity, `gha-wize-infrastructure-prod`, runs the
infrastructure Terraform.

## Destructive plans stop the release

In wize-infrastructure's release, an additive plan applies unattended. A plan
containing `delete` (alone, or as the `["delete","create"]` pair that means a
REPLACEMENT) is refused, the resources are named in the run summary, and
proceeding requires a manual dispatch with `allow_infrastructure_destroy`.

**A `delete` nobody asked for is almost always an unset Terraform variable**,
not a real intent. The release passes every input explicitly from a GitHub
variable or secret, and an unset one silently takes the default in
`variables.tf`, several of which turn features (DNS, the origin certificate)
off. Check the variables before believing the plan.

## GCP — code, not a deployment

`bootstrap/` + `envs/prod/` still describe the GKE platform (the `10.0.0.0/16`
VPC with PSA peering for Cloud SQL, the Cloud Run workers with a per-worker
runtime SA each, ~35 Secret Manager containers, the `sparx-app` Workload
Identity GSA) and still hold their GCS-backed state. But **no workflow applies
them**. They stay `validate`-clean in wize-infrastructure's CI, because "we still
have the GKE definition" is only true while it is valid HCL, and because
`modules/dns` is shared, so a change made for Azure that breaks the other
consumer is caught there. `envs/prod/main.tf` is also where the Pub/Sub topic
catalog lives, which sparx's `pnpm check:events` still checks against.

**Rule — no drift:** any imperative change to a TF-managed resource must be
mirrored back into wize-infrastructure's Terraform the **same session**. The
imperative escape hatch is the exception, not the workflow. Running `az` or
`kubectl` against the platform by hand for anything other than READING state is
a gap in the automation.

Related: [[topology]], [[cost-and-ops-guardrails]], [[deploy-workflows]]
