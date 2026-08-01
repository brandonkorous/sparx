---
title: Cluster topology
node: infrastructure
type: reference
status: active
sources:
  - k8s/
  - terraform/envs/prod/main.tf
---

**GKE Autopilot** cluster `sparx-prod-autopilot` (private, deletion-protected). Namespaces: `sparx-prod` (everything), `monitoring`, `postal` (decommissioned).

- **Apps + APIs:** Deployments + Service + HPA + PDB for api-rest, api-graphql, api-mcp, mcp-site, dashboard, site, market, web (`k8s/apps/`).
- **Redis** (`k8s/redis/`): single-replica StatefulSet + AOF — cache + BullMQ broker at `redis.sparx-prod.svc.cluster.local:6379`. Phase-1 pod, not Memorystore.
- **PgBouncer** (`k8s/pgbouncer/`): **transaction-mode** pool (required for RLS `SET LOCAL`), internal-LB pinned `10.0.0.55` so Cloud Run workers reach it over the VPC connector.
- **Typesense** (`k8s/typesense/`): StatefulSet + internal-LB — **live** (a Phase-1 deviation; see [[phased-infra]]).
- **Caddy** (`k8s/ingress/`): reverse proxy, on-demand TLS + PVC cert store — the ingress origin.
- **Postal** (`k8s/postal/`): full manifests but **decommissioned** (email is Mailgun — [[mailgun]]).
- **~14 CronJobs** (`k8s/cronjobs/`): reservation-reaper, revenue/valuation rollups, segment recompute, partition rollover, settlement, search-console sync, …
- **Cloud SQL** Postgres 18 (`db-g1-small`, ZONAL, **private-IP only**, deletion-protected). **Pub/Sub** ~60 topics. **GCS** private-media + public-variants buckets.
- **DNS is Cloudflare** ([[integrations]]) — `sparx.works` proxied (CDN/WAF), `sparx.zone` DNS-only (tenant sites). Not GoDaddy, not Mailgun.

Related: [[deploy-workflows]], [[phased-infra]], [[terraform]]
