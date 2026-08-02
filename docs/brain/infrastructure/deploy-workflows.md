---
title: Deploy workflows
node: infrastructure
type: reference
status: active
sources:
  - .github/workflows/
  - k8s/azure/
---

**There is ONE release pipeline and its stages ARE the deployment.**
[.github/workflows/release.yml](../../../.github/workflows/release.yml) runs on
every push to `main`:

```
build            22 images → ghcr.io/<repo>/<image>:<sha>
1 infrastructure terraform apply, then namespace + secrets + k8s/azure/infra
2 data           roles → migrate → seed platform rows → ingest bundles
3 containers     pin every image to <sha>, apply k8s/azure/apps, wait
4 cleanup        prune old image versions + obsolete workflow-run history
```

Five workflows total, each a different KIND of thing: `ci.yml` (is the change
valid), `release.yml` (the pipeline), `ops.yml` (manual chores),
`restore-from-export.yml` (disaster recovery), `auto-tag.yml` (SemVer tag,
dispatches nothing — [[releases-are-automated]]).

## Data comes before containers

Schema before code is uncontroversial. Rows are the same argument and were the
same bug: `migrate` moves the schema and nothing ever put a row in it, so
platform content could be committed, merged and deployed while remaining absent
from the running platform. `marketplace_themes` held zero rows against 20
committed bundles for a month.

Running data BEFORE the rollout is what makes the guarantee real — if the seed
fails, the old containers are still serving. Both halves are idempotent
(upserts, version-guarded immutable artifacts), and a failure **fails the
release**; the hand-run predecessor logged warnings, so "green pipeline" and
"empty catalog" were true at once.

## The overlay split is what makes that order possible

`k8s/azure/infra` vs `k8s/azure/apps`. The data-stage Jobs need a namespace, the
`sparx-app-env` ConfigMap and the `sparx-media` PVC to already exist; while
those lived with the Deployments, the only way to have them was to roll the
whole platform first.

The dividing line is **replacement**: `infra` is created once and converges
(namespace, config, disk, load balancer, Typesense); `apps` is images thrown
away every release. `k8s/azure/jobs` holds the two `envsubst`-templated Job
manifests the data stage applies.

This retired `bootstrap.yml` — 39 KB of dispatch with fifteen hand-picked
component names — rather than porting it. The distinction it drew is the split,
and it now runs on every release.

## One commit, one release, one SHA

`build` is inside the pipeline and builds **every** image unfiltered, so
`github.sha` is the only version in play. That deleted a path-filtered build
workflow, a `workflow_run` chain, a `manifest_sha`/`image_sha` pair that were
"not always the same", and a loop walking back 50 commits asking GHCR which one
had images. The repo is **public**, so Actions minutes are free and per-image
`type=gha` cache scopes make the unfiltered build cheap. The cost was never
money; it was two SHAs and a class of "merged but never deployed" bugs.

## Terraform is a pipeline stage

Until 2026-08-02 nothing ran it — `terraform/envs/azure` was applied from a
laptop. Remote state (`stsparxprodcustfstate`, `use_azuread_auth`) and the OIDC
identity had existed since `terraform/bootstrap-azure`; only the job was
missing.

**Additive plans apply unattended; destructive plans stop the release.** A
`delete` action alone is a destroy and `["delete","create"]` is a replacement —
more dangerous, because the summary reads "1 to change". Both are refused, the
resources are named in the run summary, and proceeding needs a manual dispatch
with `allow_infrastructure_destroy`. A `delete` nobody asked for is almost
always an unset Terraform **variable** taking a feature-disabling default.

## The destination is a variable, never a filename

The `target` job resolves resource group / cluster / namespace / overlay /
terraform dir once from environment variables (`AKS_RESOURCE_GROUP`,
`AKS_CLUSTER`, `K8S_NAMESPACE`, `K8S_OVERLAY`, `TERRAFORM_DIR`, …) and every
other job reads its outputs. Adding an environment is setting variables, not
forking a file. The namespace appears in two places that must agree — the
variable and the overlays' `namespace:` field — so `target` checks and fails
loudly rather than deploying into one and waiting on another.

This replaced a "file = provider, environment = input" convention that had grown
to eight files (`deploy-azure`/`deploy-gcp`, `db-migrate-azure`/`db-migrate-gcp`,
build ×2, ingest ×2) whose only real variance was three strings.

## Ops is deliberately not the release

[ops.yml](../../../.github/workflows/ops.yml) is manual-only: `marketplace-ingest`,
the three `marketplace-purge-*`, `platform-crm-backfill`. **A task name must
never appear in the release** — the moment it does, the pipeline stops
describing how the platform ships and becomes a list of chores with an obvious
place to add the next one. One file with a `task` input, because all of them are
"run a script in-cluster against the app's environment as a Job"; the six files
it replaced differed only in an image, a path, and which remembered to require
confirmation. Purges now uniformly require typing the task name **and** ticking
`apply`. It shares the release's concurrency group.

## GCP is deleted

The nine GCP workflows are gone. They were already inert behind `__disabled__`
trigger sentinels, and a second unexercised copy of every mechanic is what
produced pairs that drifted apart. `terraform/envs/prod` and
`terraform/bootstrap` remain **as code** and stay `validate`-clean in CI —
"we still have the GKE definition" is only true while it is valid HCL.

**Cluster mutations go through the pipeline** — never manual `kubectl apply`
([[cost-and-ops-guardrails]]).

Related: [[releases-are-automated]], [[terraform]], [[migration-pipeline]]
