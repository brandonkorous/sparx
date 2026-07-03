---
title: Integrations
type: map
status: active
---

# integrations

Registry of every external service & tool — *what it's for* and *active / planned / rejected*. Runtime "how" lives in [[infrastructure]] / [[architecture]]; this node answers **what & why**, and points to the home node for the mechanism.

## Product / runtime services

| Service | For | Status | Detail |
|---|---|---|---|
| **Stripe** | payments (direct + sparx-pay Connect) + platform billing | active | [[stripe]] |
| **Mailgun** | transactional email send on `sparx.email` | active | [[mailgun]] |
| **Better Auth** | self-hosted auth (staff + shopper) | active | [[better-auth]] |
| **GCP** | GKE, Cloud SQL, Pub/Sub, GCS, Artifact Registry, Secret Manager, Cloud Run | active | [[topology]] |
| **Redis** | cache + BullMQ broker (pod) | active | [[topology]] |
| **Typesense** | faceted search projections | active | [[phased-infra]] |
| **Cloudflare** | platform + tenant DNS / CDN / WAF | active | [[cloudflare]] |
| **GoDaddy** | domain registrar / reseller | active | [[godaddy]] |

## Working tools (we operate with)

| Tool | For | Footprint |
|---|---|---|
| **kanNINJA** | project management / live work | external — [[kanninja]] (no repo code) |
| **GitHub Actions** | CI/CD | [[deploy-workflows]] |
| **Adobe / Gmail / GoDaddy MCP** | agent tooling | external, no repo integration |

## Rejected / deferred

See [[rejected]] — SendGrid/Postmark/SES, Auth0/Clerk, Memorystore, Elasticsearch, Postal (decommissioned).

## Adding one

New external service → a note here (what / where-wired / active) + link to its runtime home; **record rejections too** ([[CONTRACT]]).
