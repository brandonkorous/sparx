---
title: Cloudflare (DNS / CDN / WAF)
node: integrations
type: reference
status: active
sources:
  - terraform/envs/prod/cloudflare.tf
---

**The platform's DNS, CDN, and WAF** — managed in Terraform (`cloudflare.tf`, gated by `var.cloudflare_enabled`; secret `cloudflare-api-token`).

- **`sparx.works`** — proxied (orange-cloud): CDN + WAF in front of the apps/APIs.
- **`sparx.zone`** — DNS-only (grey-cloud): tenant storefronts + `customers.sparx.zone` as the CNAME target for tenant custom domains.
- Sister zones + a stubbed `sparx.email` MX / SPF / DKIM / DMARC record set (still TODO — [[mailgun]]).

**This is the platform DNS — not GoDaddy, not Mailgun.** [[godaddy]] is only the domain *registrar* (buying names); [[mailgun]] is email *send* only. Tenant custom domains resolve here; the Caddy origin ([[topology]]) does on-demand TLS.

**Why it's called out separately:** "which service owns DNS?" is a common wrong-guess (registrar vs. email vs. CDN). It's Cloudflare.

Related: [[topology]], [[godaddy]], [[mailgun]]
