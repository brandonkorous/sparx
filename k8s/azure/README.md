# AKS deployment

**Version:** 2.1
**Author:** Brandon Korous
**Last Updated:** 2026-08-07

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
- `AZURE_KEY_VAULT_NAME` — the vault holding the app secrets. **Setting this is
  the cutover**; see below.

**Secrets:**

- `TYPESENSE_API_KEY` — any random string; also goes in the app bundle.
- `SPARX_APP_SECRETS_ENV` — the legacy bundle, kept only as a rollback until the
  Key Vault cutover is green. See below.

## Where the app secrets live

**Azure Key Vault** (`kv-sparx-prod-cus`, created by `terraform/bootstrap-azure`).
Each secret is its own object, so adding one is a single command:

```bash
az keyvault secret set --vault-name kv-sparx-prod-cus \
  --name crm-voice-token-key --value <value>
```

Names are kebab-case in the vault and become `SCREAMING_SNAKE` env vars —
`crm-voice-token-key` → `CRM_VOICE_TOKEN_KEY`. The mapping is bijective because
vault names allow only `[0-9a-zA-Z-]` and env names never contain a hyphen.

**Why not a GitHub secret.** It used to be one: `SPARX_APP_SECRETS_ENV`, the whole
bundle as a dotenv blob, because GitHub has no secret grouping. The real problem
was never the grouping — it is that **GitHub secrets are write-only.** Nothing can
read one back, so adding a single key meant reconstructing all ~30 from a copy
kept elsewhere, and `gh secret set` _replaces_. One mistake was a platform outage
on the next release. Key Vault also brings versioning, audit logs and rollback,
and costs about **$0.06/month** at this read volume (Standard tier: no base fee,
free storage, $0.03 per 10,000 operations — never Premium, which buys HSM keys
this platform does not use).

### Migrating, and rolling back

```powershell
# 1. Seed the vault from your existing blob (verifies every value reads back)
./k8s/scripts/sync-secrets.ps1 -VaultName kv-sparx-prod-cus -FromEnvFile secrets.env

# 2. Check it
./k8s/scripts/sync-secrets.ps1 -VaultName kv-sparx-prod-cus -List

# 3. Cut over — LAST, after the vault is loaded
gh variable set AZURE_KEY_VAULT_NAME -b 'kv-sparx-prod-cus'
```

Step 3 is the switch: set → the vault is the source of truth; unset → the release
falls back to the blob, byte-for-byte as before. **Rollback is unsetting one
variable.**

A vault that is set but empty **fails the release** rather than falling back —
same reasoning as `EVENT_BROKER`'s throw-on-unset. A silent fallback turns a
config mistake into a half-populated Secret that deploys fine and breaks
somewhere unrelated hours later.

**The first release after cutover proves the migration.** The sync step hashes
the `sparx-app-secrets` Secret before and after writing it; a run logging
`App secrets unchanged` means the vault reproduced the bundle byte-for-byte.
Only after that green run:

```bash
gh secret delete SPARX_APP_SECRETS_ENV
```

Start from [../local/secrets.example.env](../local/secrets.example.env), which
documents where every value comes from.

### What is NOT in the vault

- `AZURE_STORAGE_ACCOUNT` / `AZURE_STORAGE_KEY` — read from Terraform output each
  release. Vaulting them would mean a key rotation silently reverts media to the
  local-disk backend, which has already cost months of production media on a
  single ReadWriteOnce disk.
- `OPERATOR_DATABASE_URL` — derived from `DATABASE_URL` unless supplied.
- `AZURE_CLIENT_ID` / `TENANT_ID` / `SUBSCRIPTION_ID` — repo variables, not
  secrets, and they are the credential that _unlocks_ the vault.
- `GITHUB_TOKEN` — minted per run by Actions.

Three things about the bundle are load-bearing:

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
[wizeworks/packages/db/docker/init/01-roles.sql](../../packages/db/docker/init/01-roles.sql)
is a **Docker image entrypoint convention** (`/docker-entrypoint-initdb.d`) that
a managed server will never execute. The server is also VNet-private, so it
cannot be reached from a laptop.

So [wizeworks/packages/db/sql/azure-bootstrap.sql](../../packages/db/sql/azure-bootstrap.sql)
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
  snapshot schedule. Blob Storage would need a third driver in `wizeworks/packages/media`
  (which has exactly two: GCS and local disk) — a deliberate later decision.
- **No message broker.** `SPARX_DEV_WORKER_ROUTES` dispatches events over plain
  HTTP: no retry, no dead-letter queue. An event published while a worker is
  restarting is lost. Azure Service Bus Standard is ~$10/mo if that becomes
  unacceptable.
