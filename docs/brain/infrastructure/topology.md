---
title: Cluster topology
node: infrastructure
type: reference
status: active
sources:
  - k8s/
  - wize-infrastructure:terraform/envs/azure/
  - wize-infrastructure:k8s/
---

**AKS** cluster `aks-sparx-prod-cus` (resource group `rg-sparx-prod-cus`, centralus), provisioned by Terraform in [wize-infrastructure](https://github.com/wizeworksllc/wize-infrastructure) ([[terraform]]). It is shared: kanNINJA and the WizeWorks admin console run in their own namespaces (`kanninja`, `wizeworks`), and wize-infrastructure runs its shared Jobs in `wize-infrastructure`. sparx and Piggles live in **`sparx-prod`**.

## What runs in `sparx-prod`, and who applies it

Applied by **sparx's release** ([[deploy-workflows]]):

- **Stage 1, `k8s/azure/infra`:** the namespace, `sparx-app-env` / `piggles-app-env`, the `sparx-media` PVC, **Typesense** (live; a Phase-1 deviation, see [[phased-infra]]) and **PgBouncer** (transaction mode, required for RLS `SET LOCAL`; apps move to it only when `PGBOUNCER_ENABLED=true`). Plus the `sparx-app-secrets` Secret, synced from Key Vault `kv-sparx-prod-cus`.
- **Stage 3, `k8s/azure/apps`:** the app + API Deployments in `k8s/apps/` (api-rest, api-graphql, api-mcp, mcp-site, workbench, web, site, market, and the three Piggles apps), every CronJob in `k8s/cronjobs/`, and `k8s/self-hosted/` (the three worker Deployments `event-worker` / `media-worker` / `import-worker`, plus the **NATS** broker).

Applied by **wize-infrastructure's release** (not sparx's), though it runs in this namespace:

- **Caddy** (wize-infrastructure's [`k8s/ingress/`](https://github.com/wizeworksllc/wize-infrastructure/blob/main/k8s/ingress)): reverse proxy, on-demand TLS + the `caddy-data` PVC cert store, a `LoadBalancer` Service pinned to the reserved public IP `pip-ingress-sparx-prod-cus`. It is THE routing table for every product on the cluster. Labelled `app.kubernetes.io/managed-by: wize-infrastructure`; sparx's stage 1 hands over any Caddy object still carrying sparx's label so sparx's prune never deletes it. Moving Caddy into its own namespace is a planned migration (its cert disk and reserved IP make it one).

## Outside the cluster

- **Postgres:** managed Azure Flexible Server `psql-sparx-prod-cus`, public access **disabled**, VNet-only, so migrations and seeds run as in-cluster Jobs ([[migration-pipeline]]). The server is shared; jotDOJO's role on it is made by wize-infrastructure's release.
- **Redis:** dropped on Azure. NATS carries the job Redis used to do.
- **Media:** the Azure storage account wize-infrastructure's Terraform creates; it writes the account name and key into `kv-sparx-prod-cus` for sparx's release to read.
- **Monitoring:** the WizeLens collector in `monitoring`, installed by wize-infrastructure's release.
- **DNS is Cloudflare** ([[cloudflare]]), managed in wize-infrastructure's Terraform: `sparx.works` proxied (CDN/WAF), `sparx.zone` DNS-only (tenant sites). Not GoDaddy, not Mailgun.
- **Postal** (`k8s/postal/`): manifests remain but **decommissioned** (email is Mailgun, [[mailgun]]).

The GCP layout (GKE Autopilot `sparx-prod-autopilot`, Cloud SQL, Cloud Run workers, ~60 Pub/Sub topics, GCS buckets) survives only as code in wize-infrastructure's `terraform/envs/prod`; no workflow deploys it.

Related: [[deploy-workflows]], [[phased-infra]], [[terraform]]
