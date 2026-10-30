---
title: Cloudflare (DNS / CDN / WAF)
node: integrations
type: reference
status: active
sources:
  - wize-infrastructure:terraform/envs/prod/cloudflare.tf
  - wize-infrastructure:terraform/envs/azure/
---

**The platform's DNS, CDN, and WAF** — managed in Terraform in [wize-infrastructure](https://github.com/wizeworksllc/wize-infrastructure) (`cloudflare.tf` and the shared `modules/dns`, gated by `var.cloudflare_enabled`; secret `cloudflare-api-token`). A new DNS record is a pull request there, released by that repository, not by sparx's release.

- **`sparx.works`** — proxied (orange-cloud): CDN + WAF in front of the apps/APIs.
- **`sparx.zone`** — DNS-only (grey-cloud): tenant sites + `customers.sparx.zone` as the CNAME target for tenant custom domains.
- Sister zones + a stubbed `sparx.email` MX / SPF / DKIM / DMARC record set (still TODO — [[mailgun]]).

**This is the platform DNS — not GoDaddy, not Mailgun.** [[godaddy]] is only the domain *registrar* (buying names); [[mailgun]] is email *send* only. Tenant custom domains resolve here; the Caddy origin ([[topology]]), also owned by wize-infrastructure, does on-demand TLS. Caddy and `wizeworks/packages/client-ip` must trust the same Cloudflare IP ranges; sparx CI's `check-cloudflare-ranges` step (run from a wize-infrastructure checkout) fails a change that updates only one side.

**Why it's called out separately:** "which service owns DNS?" is a common wrong-guess (registrar vs. email vs. CDN). It's Cloudflare.

Related: [[topology]], [[godaddy]], [[mailgun]]
