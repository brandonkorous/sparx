# Local self-hosted deployment

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-07-31

Runs the whole platform on a workstation's Docker Desktop Kubernetes, reachable
at its real public hostnames through a Cloudflare Tunnel. Replaces the GKE
Autopilot + Cloud SQL + Cloud Run + GCS deployment described in
[docs/03-infrastructure-deployment.md](../../docs/03-infrastructure-deployment.md).

This is a **kustomize overlay on the production manifests**, not a parallel copy.
`k8s/apps/` and `k8s/cronjobs/` are consumed verbatim; this directory expresses
only what a laptop does differently. A change to an app's probes, security
context or env in the base manifests lands here automatically.

## What replaced what

| Production                           | Here                                                      |
| ------------------------------------ | --------------------------------------------------------- |
| GKE Autopilot                        | Docker Desktop Kubernetes, one node                       |
| Cloud SQL Postgres 18                | `postgres:18-alpine` StatefulSet (`infra.yaml`)           |
| PgBouncer                            | nothing — one replica each, direct connections            |
| 11 Cloud Run workers                 | Deployments (`../self-hosted/workers.yaml`)               |
| Pub/Sub (~60 topics)                 | direct HTTP dispatch — **see Known gaps**                 |
| GCS media buckets                    | a PVC + `wizeworks/packages/media`'s LocalStorage backend |
| Secret Manager                       | `secrets.env` → a k8s Secret                              |
| Caddy + on-demand TLS + LoadBalancer | Caddy on plain HTTP + cloudflared                         |
| Typesense / Redis (GKE)              | same images, workstation-sized                            |

Unchanged: all 8 app images, all 11 worker images, all 15 CronJobs, every
route in the ingress, and every public hostname.

## Why the namespace is still `sparx-prod`

Every in-cluster address in the base manifests and all 15 CronJobs is a literal
`<svc>.sparx-prod.svc.cluster.local` string inside an env value or a `curl`
argument. Kustomize rewrites resource metadata, not arbitrary strings — so
renaming the namespace would break all of them while every file still looked
right. A separate cluster is already the isolation boundary.

**Consequence:** applying this to the wrong kubectl context would overwrite a
real deployment. `scripts/local-up.ps1` hard-fails unless the context is
`docker-desktop`.

## Bring it up

Everything runs on the target machine, including the build — `imagePullPolicy:
Never` is correct precisely because Docker Desktop's Kubernetes shares the image
store the build writes to. There is no registry in the loop.

```powershell
# 1. Docker Desktop → Settings → Kubernetes → Enable Kubernetes
#    On a 16GB host also raise the WSL2 memory cap, which defaults to HALF of
#    physical RAM (8GB) — not enough. In %USERPROFILE%\.wslconfig:
#        [wsl2]
#        memory=11GB
#    then `wsl --shutdown` and restart Docker Desktop.

# 2. Build the 20 images. Slow the first time on a laptop; needs ~60GB free
#    disk, since each image installs its own workspace closure.
pwsh scripts/build-local-images.ps1 -Throttle 2

# 3. Fill in credentials.
cp k8s/local/secrets.example.env k8s/local/secrets.env
#    That file documents where each value comes from. Almost everything is
#    either regenerable (openssl rand -base64 32) or re-readable from the
#    provider's own dashboard — Secret Manager was not the only copy.

# 4. Create the tunnel.
cloudflared tunnel login
cloudflared tunnel create sparx-local
cp ~/.cloudflared/<UUID>.json k8s/local/tunnel-credentials.json

# 5. Apply, and run migrations on the first pass.
pwsh scripts/local-up.ps1 -Migrate

kubectl get pods -n sparx-prod -w
```

Then seed data — the database starts empty. There is nothing to restore from
GCP; the search index is derived state, so `rebuild_search_index` after seeding
is enough.

## DNS

`cloudflared tunnel route dns sparx-local <hostname>` creates each proxied CNAME
to `<UUID>.cfargotunnel.com`. The hostnames Caddy serves:

```
sparx.works  www.sparx.works  api.sparx.works  app.sparx.works
media.sparx.works  media-direct.sparx.works  graphql.sparx.works  mcp.sparx.works
sparx.market  www.sparx.market  mcp.sparx.zone  sparx.zone  www.sparx.zone
sparxcms.com  sparxcrm.com  sparxemail.com  sparxb2b.com  sparx.email   (+ www)
sparx.host  sparx.software  sparx.exchange                              (+ www)
meetpiggles.com  getpiggles.com  mypiggles.com                          (+ www)
api.mypiggles.com  mcp.mypiggles.com  piggles.site                      (+ www)
```

The two `*.mypiggles.com` API hosts reach the SAME api-rest and api-mcp pods the
sparx hosts do. They exist because a Piggles customer READS them — the console
hands `api.mypiggles.com` to their browser, and the console tells them to copy
`mcp.mypiggles.com/mcp` into Claude or ChatGPT by hand. The MCP one also decides
where they sign in: discovery happens before any token exists, so api-mcp resolves
the brand from the host and answers with getpiggles.com as the authorization
server (docs/07 §5).

Set each zone's SSL/TLS mode to **Full (strict)**. The tunnel is the encrypted
hop; Caddy holds no certificate. Do not use Flexible.

`workbench.sparx.works` is omitted — it is a legacy redirect Caddy still serves,
but nothing needs to resolve it.

## Deploy the media-direct Worker

Required, not optional, if social posting is on:

```powershell
cd cloudflare/media-direct-worker
npx wrangler login
npx wrangler deploy
```

Without it, Instagram, Threads and Pinterest publish text-only with the image
silently dropped. See gap 4 below for why, and
[cloudflare/media-direct-worker/src/index.ts](../../cloudflare/media-direct-worker/src/index.ts)
for how it works.

## Known gaps

These are real, and none of them are silent.

**1. No message broker.** `SPARX_DEV_WORKER_ROUTES` makes api-rest POST each
event straight to the matching worker in the exact Pub/Sub push envelope, so
worker code is unchanged — but it is fire-and-forget. No retry, no dead-letter
queue, no backlog while a worker restarts. An event published during a worker
rollout is lost, logged by the publisher and invisible to the caller. This is
the one place the local stack is genuinely weaker than GKE, and the thing to fix
first if it becomes more than a dogfood deployment. Redis is already running and
BullMQ is already a dependency.

**2. Wildcard tenant sites — NOT a gap. This entry was wrong.** `*.sparx.zone`
was grey-cloud (DNS-only), and a tunnel serves only _proxied_ hostnames, so the
record does have to change. The claim that followed — that Cloudflare will not
proxy a wildcard on this plan — was asserted without testing it. It is false.
A **proxied** `CNAME *.sparx.zone → <UUID>.cfargotunnel.com` is accepted, and
tenant subdomains resolve automatically exactly as they did on GKE. Nothing has
to be created per tenant, which matters because nothing in the platform creates
Cloudflare DNS records: neither `wizeworks/packages/registrar` nor `domain-worker` touches
the Cloudflare API, so a per-tenant record would have to be added by hand at
signup. Set the wildcard once and leave it.

**3. Tenant custom domains.** A customer pointing `theirdomain.com` at
`customers.sparx.zone` cannot reach a tunnel without Cloudflare for SaaS custom
hostnames (paid, per hostname). Caddy's on-demand TLS — which solved this in
prod — cannot issue certificates here, because no ACME challenge can reach a
machine with no inbound port open.

**4. `media-direct.sparx.works` — SOLVED, but it needs the Worker deployed.**
Instagram, Threads and Pinterest publish an image by handing THEIR servers an
`image_url`. Those fetchers send `Range: bytes=0-` and reject the `206 Partial
Content` Cloudflare answers with, so the image drops and the post goes out
text-only — with no error anywhere in our stack. In prod this host was
grey-cloud (DNS-only) so those fetchers bypassed Cloudflare entirely. A tunnel
carries only proxied hostnames, so that bypass no longer exists.

The replacement routes _around_ nothing and fixes the behaviour _at_ the edge:
Workers run ahead of the cache lookup, so
[cloudflare/media-direct-worker/](../../cloudflare/media-direct-worker/) strips
`Range` before anything downstream can satisfy one, and a 206 becomes
impossible. Same hostname, same `MEDIA_DIRECT_BASE_URL`, no adapter changes.
Well inside the Workers free tier.

Independent confirmation that this is the right lever: `fetchImageBinary` in
[wizeworks/packages/social/src/adapters/\_media.ts](../../packages/social/src/adapters/_media.ts)
documents Facebook hitting the identical 206 and being fixed by "a plain GET (no
Range) returns a clean 200".

Strictly better still, and not yet done: Pinterest's `POST /v5/pins` accepts
`media_source.source_type = "image_base64"`, so it could send bytes instead of a
URL and stop depending on any fetcher behaviour at all. That is ~15 lines in
`pinterest.ts` plus its test — `fetchImageBinary` already exists for exactly
this. Instagram and Threads have no byte-upload path for images and will always
need the Worker.

**5. Availability is a laptop.** Sleep, reboots, and upstream bandwidth are now
the SLA. Set the power plan to never sleep on AC and disable fast startup.

**7. QoS is deliberately lopsided.** The 11 workers have no `resources` block at
all (BestEffort) so they reserve nothing on a 16GB host; the apps keep small
requests plus a memory limit (Burstable); Postgres, Typesense, Redis and Caddy
keep real requests so they are never the pods evicted first. Total reserved is
~1.9GB rather than the ~20GB the production numbers would have demanded. Editors
will warn about the missing worker resources — that warning is correct in
general and wrong here; the reasoning is in
[../self-hosted/workers.yaml](../self-hosted/workers.yaml).

**6. CI/CD does not point here.** `.github/workflows/deploy-prod.yml` and
`db-migrate.yml` target GKE and Cloud SQL. Deploys are `build-local-images.ps1`
then `local-up.ps1` until those are rewritten.

## Not carried over

`kanninja.com`, `silicaui.com` and `admin.wize.works` proxied through the same
shared GKE ingress but their workloads live in other namespaces. They are absent
from the shared Caddyfile (`../self-hosted/Caddyfile`) and are still down. Add them back alongside their own
Deployments if they should live here too.

## Teardown

```powershell
kubectl delete -k k8s/local
kubectl delete pvc --all -n sparx-prod   # also drops the database
```

Terraform state lived in `gs://sparx-terraform-state` and is unreachable while
GCP billing is off. `terraform/envs/prod/cloudflare.tf` still holds the real
zone definitions, so DNS can be re-imported into a local backend when the
Cloudflare records need managing again — nothing there was lost with the
project.
