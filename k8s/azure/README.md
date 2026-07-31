# AKS deployment

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-07-31

The deployed platform, on `aks-sparx-prod-cus` in centralus. Infrastructure comes
from [terraform/envs/azure](../../terraform/envs/azure); this is the workload on
top of it.

**Deployed by CI, not by hand** —
[deploy-azure.yml](../../.github/workflows/deploy-azure.yml). Running `kubectl
apply -k` yourself works but skips image pinning, the secret sync and the
migration Jobs, so treat it as a debugging tool rather than a deploy.

## Structure

| Directory          | Holds                                                                |
| ------------------ | -------------------------------------------------------------------- |
| `k8s/apps`         | The 8 app/API manifests — shared with production, consumed verbatim  |
| `k8s/cronjobs`     | All 15 CronJobs — `curl` containers, no per-service image            |
| `k8s/self-hosted`  | Workers, Caddy, cloudflared, the Caddyfile — shared with `k8s/local` |
| `k8s/azure` (here) | Only what is Azure-specific                                          |

## What differs from `k8s/local`

|          | Local                                     | Azure                                                     |
| -------- | ----------------------------------------- | --------------------------------------------------------- |
| Images   | `sparx/*:local`, `imagePullPolicy: Never` | `ghcr.io/brandonkorous/sparx/*`, pinned to the commit SHA |
| Postgres | in-cluster StatefulSet                    | **managed** `psql-sparx-prod-cus`, VNet-private           |
| Redis    | in-cluster                                | **dropped** — see `infra.yaml`                            |
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
  role-bootstrap Job `ALTER ROLE`s to `SPARX_APP_PASSWORD` on every deploy, so a
  mismatch locks the apps out of the database at the next deploy, not at the one
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
runs as an in-cluster Job — the Azure sibling of `cloud-sql-bootstrap.sql`, with
the difference that it must CREATE the roles as well as grant to them, since
Azure has no equivalent of `gcloud sql users create`. It is idempotent and runs
on every deploy.

## Still outstanding

- **The Cloudflare Tunnel is not repointed yet.** `cloudflared` will run but has
  no credentials until the `cloudflared-credentials` secret and
  `cloudflared-config` ConfigMap exist in this cluster. Until then reach the
  cluster with `kubectl port-forward svc/caddy 8080:80`.
- **Media durability.** The media PVC is a single unreplicated Azure Disk with no
  snapshot schedule. Blob Storage would need a third driver in `packages/media`
  (which has exactly two: GCS and local disk) — a deliberate later decision.
- **No message broker.** `SPARX_DEV_WORKER_ROUTES` dispatches events over plain
  HTTP: no retry, no dead-letter queue. An event published while a worker is
  restarting is lost. Azure Service Bus Standard is ~$10/mo if that becomes
  unacceptable.
