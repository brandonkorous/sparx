# Workflows

**File = provider. Environment = an input.** The pairs below are named for the
cloud they touch, never for `prod`/`staging` — provider is what dictates the
mechanics (auth, registry, how you reach the cluster), while environment is a
value that varies inside one. Naming files after the environment gives you
`deploy-prod` + `deploy-staging` + `deploy-azure-prod` + `deploy-azure-staging`
where two files and a choice input do the same work, and it makes running both
providers at once a rewrite instead of a toggle.

The build workflows are the one deliberate exception: they are named for the
REGISTRY, because that is what couples them. Artifact Registry is a GCP service;
GHCR is GitHub's and is cloud-neutral, so `build-images-ghcr.yml` feeds Azure
today but GKE could pull the same images.

## Live (Azure)

| File                                               | When it runs                    | What it does                                                        |
| -------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------- |
| [ci.yml](ci.yml)                                   | every PR + push to `main`       | pnpm lint / typecheck / test + Terraform fmt + validate             |
| [build-images-ghcr.yml](build-images-ghcr.yml)     | push to `main` (path-filtered)  | matrix-builds each image, pushes to GHCR tagged with the commit SHA |
| [deploy-azure.yml](deploy-azure.yml)               | after a green GHCR build        | syncs secrets + tunnel, calls DB Migrate (Azure), rolls out to AKS  |
| [db-migrate-azure.yml](db-migrate-azure.yml)       | manual, or called by the deploy | creates roles, runs `prisma migrate deploy` as an in-cluster Job    |
| [restore-from-export.yml](restore-from-export.yml) | manual                          | restores the Postgres dump and/or media tarball from Blob Storage   |
| [auto-tag.yml](auto-tag.yml)                       | push to `main`                  | cuts a `v*` tag from conventional commits. Dispatches nothing.      |

## Fallback (GCP) — all blocked by a `__disabled__` trigger sentinel

GKE is deliberately still running with data on it. These are dispatch-only so a
tag or a schema edit can never roll it forward by accident; re-arm by changing
`__disabled__` back to `v*` / `main` in the file.

The switch lives in the FILE, not in `gh workflow disable`, because GitHub keys
a workflow's disabled state to its file PATH — renaming one produces a brand-new
workflow that arrives **enabled**, silently undoing it. That is not theoretical:
it is what nearly re-armed all three during the rename to these names.

| File                                         | When it runs | What it does                                                         |
| -------------------------------------------- | ------------ | -------------------------------------------------------------------- |
| [build-images-gcp.yml](build-images-gcp.yml) | manual       | matrix-builds each image to Artifact Registry, scans with Trivy      |
| [deploy-gcp.yml](deploy-gcp.yml)             | manual       | rolls out image tags to GKE + Cloud Run, smoke-tests `/health`       |
| [db-migrate-gcp.yml](db-migrate-gcp.yml)     | manual       | builds the runner image, applies the migration Job against Cloud SQL |

## Required secrets

Set these once at repo level. The first two are outputs of `terraform/bootstrap`:

| Secret                           | Source                                             |
| -------------------------------- | -------------------------------------------------- |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `terraform output -raw workload_identity_provider` |
| `GCP_DEPLOYER_SA_EMAIL`          | `terraform output -raw deployer_sa_email`          |
| `GCP_PROJECT_ID`                 | The GCP project ID for sparx                       |

No JSON key files. The `sparx-deployer` SA is impersonated via GitHub OIDC (Workload Identity Federation).

## Deploy flow (Azure — the live path)

```
push to main
    → build-images-ghcr.yml builds the changed images, tags them with the SHA
    → deploy-azure.yml starts on that build's success (workflow_run)
        prepare  → sync secrets + tunnel config, resolve which SHA has images
        migrate  → db-migrate-azure.yml: roles Job, then `prisma migrate deploy`
        rollout  → pin every image to the SHA, apply, wait on each Deployment
```

Two SHAs are in play and they are not always the same. The image build is
path-filtered to source, so an infra-only commit publishes nothing; `prepare`
walks back to the newest ancestor that actually has images and pins to that.
Deploying HEAD blindly would roll out tags that were never pushed.

Migrations run **before** the rollout, and the rollout is skipped if they fail —
new code must never meet an old schema.

## Deploy flow (GCP — fallback, currently sentinel-blocked)

```
push v1.2.3 tag
    → migrate job runs `prisma migrate deploy` against Cloud SQL via pgbouncer
    → image tags swapped on each Deployment
    → `kubectl rollout status` waits for each Deployment to converge
    → smoke checks /health on public hosts
```

Manual rollback (per [docs/20 §2](../../docs/20-operational-runbook.md)):

```
kubectl -n sparx-prod rollout undo deployment/<service>
```

## Soft-skip behaviour

`build-images-gcp.yml` skips services whose Dockerfile doesn't exist yet, and `deploy-gcp.yml` skips Deployments that aren't in the cluster. This lets workflows stay green during the phased build-out (some services land before others).

When you want stricter behaviour — fail if expected services are missing — remove the conditional checks in those jobs.
