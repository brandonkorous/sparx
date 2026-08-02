# AKS deployment

**Version:** 2.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-02

The deployed platform, on `aks-sparx-prod-cus` in centralus. Infrastructure comes
from [terraform/envs/azure](../../terraform/envs/azure); this is the workload on
top of it.

**Deployed by the release, not by hand** —
[release.yml](../../.github/workflows/release.yml). Running `kubectl apply -k`
yourself works but skips image pinning, the secret sync and the data Jobs, so
treat it as a debugging tool rather than a deploy.

## Two overlays, because the release has stages

This directory is split, and the split is what makes the release order
(infrastructure → data → containers) possible on a cluster that has never been
deployed:

| Path          | Applied by  | Holds                                                            |
| ------------- | ----------- | ---------------------------------------------------------------- |
| `azure/infra` | **stage 1** | namespace, `sparx-app-env`, media PVC, Typesense, Caddy ingress  |
| `azure/jobs`  | **stage 2** | the seed + ingest Job templates (`envsubst`, not kustomize)      |
| `azure/apps`  | **stage 3** | the 9 apps, 15 CronJobs, 12 workers + NATS — everything replaced |

The dividing line is **replacement**. `infra` is created once and then
converges: a namespace, a config map, a disk, a load balancer, a search engine
holding an index. `apps` is container images thrown away on every release.

The data stage runs Jobs that need the namespace, `sparx-app-env` and the
`sparx-media` PVC to already exist. While those lived in one overlay with the
Deployments, the only way to have them was to roll the whole platform first —
which is exactly why the data stage used to run last, after the containers it is
supposed to precede.

Bases consumed by both, unchanged:

| Directory         | Holds                                                     |
| ----------------- | --------------------------------------------------------- |
| `k8s/apps`        | The 9 app/API manifests — consumed verbatim               |
| `k8s/cronjobs`    | All 15 CronJobs — `curl` containers, no per-service image |
| `k8s/self-hosted` | The workers + the NATS broker — shared with `k8s/local`   |
| `k8s/ingress`     | Caddy, the ONE routing table, the LoadBalancer Service    |

## What differs from `k8s/local`

|          | Local                                     | Azure                                                     |
| -------- | ----------------------------------------- | --------------------------------------------------------- |
| Images   | `sparx/*:local`, `imagePullPolicy: Never` | `ghcr.io/brandonkorous/sparx/*`, pinned to the commit SHA |
| Postgres | in-cluster StatefulSet                    | **managed** `psql-sparx-prod-cus`, VNet-private           |
| Redis    | in-cluster                                | **dropped** — see `infra/platform.yaml`                   |
| Storage  | Docker Desktop default                    | `managed-csi` (Azure StandardSSD)                         |

`managed-csi-premium` would also work — the node supports Premium — but costs
roughly double for IOPS neither Typesense nor the media volume needs.

## Required repository configuration

**Variables** (ids, not secrets — set by `terraform/bootstrap-azure`'s
`gh_cli_commands` output):

- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`

**Secrets:**

- `TYPESENSE_API_KEY` — any random string; also goes in the app bundle below.
- `SPARX_APP_SECRETS_ENV` — **the whole `sparx-app-secrets` bundle as one dotenv
  blob.** One secret rather than ~30, because GitHub has no secret grouping and
  30 individually-managed values drift. Format:

  ```
  DATABASE_URL=postgresql://sparx_app:<pw>@psql-sparx-prod-cus.postgres.database.azure.com:5432/sparx?sslmode=require
  AUTH_DATABASE_URL=postgresql://sparx_owner:<admin-pw>@psql-sparx-prod-cus.postgres.database.azure.com:5432/sparx?sslmode=require
  SPARX_APP_PASSWORD=<pw>
  BETTER_AUTH_SECRET=...
  ...
  ```

  Start from [../local/secrets.example.env](../local/secrets.example.env), which
  documents where every value comes from.

Three things about that bundle are load-bearing:

- **`sslmode=require`.** Flexible Server enforces TLS and Prisma will not
  negotiate it implicitly.
- **`SPARX_APP_PASSWORD` must match the password inside `DATABASE_URL`.** The
  role-bootstrap Job `ALTER ROLE`s to `SPARX_APP_PASSWORD` on every release, so a
  mismatch locks the apps out of the database at the next release, not at the one
  that introduced it.
- **`AUTH_DATABASE_URL` is the admin login.** Migrations and the hand-edited RLS
  SQL run as owner; the apps run as the RLS-constrained `sparx_app`.

## The database roles

`sparx_app` does not exist until the deploy workflow creates it, and that is not
an oversight —
[packages/db/docker/init/01-roles.sql](../../packages/db/docker/init/01-roles.sql)
is a **Docker image entrypoint convention** (`/docker-entrypoint-initdb.d`) that
a managed server will never execute. The server is also VNet-private, so it
cannot be reached from a laptop.

So [packages/db/sql/azure-bootstrap.sql](../../packages/db/sql/azure-bootstrap.sql)
runs as an in-cluster Job, first thing in the release's data stage. Unlike the
GCP script it must CREATE the roles as well as grant to them, since Azure has no
equivalent of `gcloud sql users create`. It is idempotent and runs on every
release.

## The node has one disk, and 20 images have to fit on it

`os_disk_size_gb = 110` in [terraform/envs/azure/main.tf](../../terraform/envs/azure/main.tf)
is load-bearing, not generous. The three API images are **~820 MB each** — they
ship the whole pnpm workspace because api-rest boots through runtime `tsx` — and
the 11 workers are built the same way. The Next.js apps are small (76–121 MB,
standalone output); the APIs and workers are not.

It was 30 GB, and that is what broke the first deploy. Twenty images overran the
disk, the kubelet raised `DiskPressure`, and it tainted the only node
`node.kubernetes.io/disk-pressure:NoSchedule`. Every unplaced pod then failed to
schedule with **"1 node(s) had untolerated taint(s)"** — which reads like an
affinity or tolerations bug and is really a full disk. If pods stop scheduling
for that reason, check `kubectl describe node` for `DiskPressure` before touching
anything about affinity.

The size is free: ephemeral OS placement consumes the VM's own NVMe (110 GiB on
`Standard_D2ads_v7`), not a billed managed disk, so asking for 30 saved nothing
and only left the rest unusable.

## Still outstanding

- **Media durability.** The media PVC is a single unreplicated Azure Disk with no
  snapshot schedule. Blob Storage would need a third driver in `packages/media`
  (which has exactly two: GCS and local disk) — a deliberate later decision.
- **No message broker.** `SPARX_DEV_WORKER_ROUTES` dispatches events over plain
  HTTP: no retry, no dead-letter queue. An event published while a worker is
  restarting is lost. Azure Service Bus Standard is ~$10/mo if that becomes
  unacceptable.
