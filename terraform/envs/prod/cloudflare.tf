# Cloudflare DNS for all Sparx-owned zones.
#
# Gated by var.cloudflare_enabled. Flip to true once:
#   1. Zones are added in Cloudflare (data sources look them up by name)
#   2. var.cloudflare_api_token is set (Zone:DNS:Edit scoped to these zones)
#
# Proxied vs DNS-only:
#   - sparx.works (app/api/mcp/marketing) → proxied = true (Cloudflare CDN + WAF)
#   - sparx.zone (*.sparx.zone, customers.sparx.zone) → proxied = false
#     Caddy on-demand TLS needs Let's Encrypt to reach origin directly,
#     and tenant custom domains CNAME to customers.sparx.zone expecting
#     a real origin (per docs/04 §3).
#
# Domain split (Shopify-style):
#   - sparx.works = platform itself (dashboard, API, marketing, MCP server)
#   - sparx.zone  = where tenant storefronts actually run (acme.sparx.zone)
#     Reputation isolation: a tenant getting flagged doesn't hit the platform's
#     domain reputation. Cookie scoping: app.sparx.works sessions cannot leak
#     into tenant stores.
#
# Sister zones (sparx.host, sparx.software, etc.) get apex + www A records
# pointing at the ingress IP — Caddy host-matches and 301-redirects them
# to the correct sparx.works path (see k8s/caddy/configmap.yaml).
#
# sparx.email is special — it's the Postal sending domain. The MX/SPF/DKIM/
# DMARC records are stubbed as TODO until Postal is deployed and its SMTP IP
# and DKIM public key are known. See docs/26-domain-transfer-runbook.md §6.

# =========================================================================
# sparx.works — primary platform domain
# =========================================================================

data "cloudflare_zone" "sparx_works" {
  count = var.cloudflare_enabled ? 1 : 0
  name  = "sparx.works"
}

resource "cloudflare_record" "sparx_works_root" {
  count           = var.cloudflare_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.sparx_works[0].id
  name            = "@"
  type            = "A"
  content         = google_compute_address.ingress.address
  ttl             = 1
  proxied         = true
  allow_overwrite = true
  comment         = "Marketing site"
}

resource "cloudflare_record" "sparx_works_www" {
  count           = var.cloudflare_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.sparx_works[0].id
  name            = "www"
  type            = "CNAME"
  content         = "sparx.works"
  ttl             = 1
  proxied         = true
  allow_overwrite = true
}

resource "cloudflare_record" "sparx_works_app" {
  count           = var.cloudflare_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.sparx_works[0].id
  name            = "app"
  type            = "A"
  content         = google_compute_address.ingress.address
  ttl             = 1
  proxied         = true
  allow_overwrite = true
  comment         = "Merchant dashboard"
}

resource "cloudflare_record" "sparx_works_workbench" {
  count           = var.cloudflare_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.sparx_works[0].id
  name            = "workbench"
  type            = "A"
  content         = google_compute_address.ingress.address
  ttl             = 1
  proxied         = true
  allow_overwrite = true
  comment         = "Workbench — multi-window operator app"
}

resource "cloudflare_record" "sparx_works_api" {
  count           = var.cloudflare_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.sparx_works[0].id
  name            = "api"
  type            = "A"
  content         = google_compute_address.ingress.address
  ttl             = 1
  proxied         = true
  allow_overwrite = true
}

resource "cloudflare_record" "sparx_works_mcp" {
  count           = var.cloudflare_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.sparx_works[0].id
  name            = "mcp"
  type            = "A"
  content         = google_compute_address.ingress.address
  ttl             = 1
  proxied         = true
  allow_overwrite = true
}

resource "cloudflare_record" "sparx_works_graphql" {
  count           = var.cloudflare_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.sparx_works[0].id
  name            = "graphql"
  type            = "A"
  content         = google_compute_address.ingress.address
  ttl             = 1
  proxied         = true
  allow_overwrite = true
  comment         = "GraphQL endpoint (api-graphql service)"
}

# media.sparx.works — public CDN domain for transcoded media variants.
# Same ingress IP as api/app, but Caddy host-matches the request and Cloudflare
# caches it at the edge for a year (Cache-Control headers from Caddy enforce
# the same on origin). Splitting media off api means:
#   - Cookie-isolated: any session cookies on api.sparx.works don't reach
#     the asset surface
#   - Future-friendly: when traffic justifies, we can repoint media to a
#     dedicated origin (or a CDN with origin-shield) without touching apps
#     that have already adopted MEDIA_PUBLIC_URL
resource "cloudflare_record" "sparx_works_media" {
  count           = var.cloudflare_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.sparx_works[0].id
  name            = "media"
  type            = "A"
  content         = google_compute_address.ingress.address
  ttl             = 1
  proxied         = true
  allow_overwrite = true
  comment         = "Public CDN — transcoded media variants (Caddy → api-rest)"
}

# NOTE: Tenant subdomain storefronts moved to sparx.zone (Shopify-style split).
# No wildcard or customers records on sparx.works anymore — see sparx.zone block below.

# =========================================================================
# sparx.zone — tenant storefronts (the customer's "zone of control")
# =========================================================================
# Reputation/cookie isolation from sparx.works. Default merchant URL is
# acme.sparx.zone (was acme.sparx.works in the original design).

data "cloudflare_zone" "sparx_zone" {
  count = var.cloudflare_enabled ? 1 : 0
  name  = "sparx.zone"
}

# Apex points at ingress so the catch-all Caddy site responds. The marketing
# app 301s sparx.zone → sparx.works (this is the platform's home; the .zone
# domain is meant for tenant subdomains, not direct apex traffic).
resource "cloudflare_record" "sparx_zone_root" {
  count           = var.cloudflare_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.sparx_zone[0].id
  name            = "@"
  type            = "A"
  content         = google_compute_address.ingress.address
  ttl             = 1
  proxied         = true
  allow_overwrite = true
}

# Wildcard for tenant stores (slug.sparx.zone).
# Caddy on-demand TLS issues per-slug Let's Encrypt certs — Cloudflare proxy
# would intercept the TLS handshake, so this MUST be DNS-only.
resource "cloudflare_record" "sparx_zone_wildcard" {
  count           = var.cloudflare_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.sparx_zone[0].id
  name            = "*"
  type            = "A"
  content         = google_compute_address.ingress.address
  ttl             = 1
  proxied         = false
  allow_overwrite = true
}

# CNAME target for merchant custom domains. Same reason as the wildcard:
# Caddy needs to terminate TLS, so DNS-only.
resource "cloudflare_record" "sparx_zone_customers" {
  count           = var.cloudflare_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.sparx_zone[0].id
  name            = "customers"
  type            = "A"
  content         = google_compute_address.ingress.address
  ttl             = 1
  proxied         = false
  allow_overwrite = true
  comment         = "Tenant custom-domain CNAME target — see docs/04-domain-ssl-automation.md"
}

# Canonical shopper-facing site MCP host (docs/113). The `*` wildcard above
# already resolves it, but an explicit node documents it as first-class. DNS-only
# for the same reason as the wildcard — Caddy on-demand TLS terminates it.
resource "cloudflare_record" "sparx_zone_mcp" {
  count           = var.cloudflare_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.sparx_zone[0].id
  name            = "mcp"
  type            = "A"
  content         = google_compute_address.ingress.address
  ttl             = 1
  proxied         = false
  allow_overwrite = true
  comment         = "Shopper-facing site MCP (mcp-site) — see docs/113-site-mcp.md"
}

# =========================================================================
# sparx.email — Postal sending infrastructure + merchant-facing emails
# =========================================================================
# Replaces the originally-planned sparx.mx (which was already taken).
# The mail records (MX, SPF, DKIM) are added once Postal is deployed and
# the SMTP IP + DKIM public key are known.

data "cloudflare_zone" "sparx_email" {
  count = var.cloudflare_enabled ? 1 : 0
  name  = "sparx.email"
}

resource "cloudflare_record" "sparx_email_root" {
  count           = var.cloudflare_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.sparx_email[0].id
  name            = "@"
  type            = "A"
  content         = google_compute_address.ingress.address
  ttl             = 1
  proxied         = true
  allow_overwrite = true
  comment         = "Marketing landing for Sparx email infrastructure"
}

# postal.sparx.email — Postal admin UI. Caddy host-routes to the
# postal-web Service inside the postal namespace.
resource "cloudflare_record" "sparx_email_postal_admin" {
  count           = var.cloudflare_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.sparx_email[0].id
  name            = "postal"
  type            = "A"
  content         = google_compute_address.ingress.address
  ttl             = 1
  proxied         = true
  allow_overwrite = true
  comment         = "Postal admin UI"
}

# mail.sparx.email — the SMTP banner hostname Postal advertises in its
# SMTP HELO greeting. Points at the ingress IP because outbound MTA
# delivery doesn't traverse a separate LB (worker pods make egress
# directly), but the A record needs to exist for reverse-DNS / SPF
# alignment. proxied=false because mail clients reach this directly
# during SMTP auth/connect for inbound bounce delivery — Cloudflare
# can't proxy SMTP traffic anyway.
resource "cloudflare_record" "sparx_email_mail_a" {
  count           = var.cloudflare_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.sparx_email[0].id
  name            = "mail"
  type            = "A"
  content         = google_compute_address.ingress.address
  ttl             = 1
  proxied         = false
  allow_overwrite = true
  comment         = "Postal SMTP banner hostname"
}

# MX → mail.sparx.email priority 10. Receives bounce-back / probe mail
# even though Sparx is outbound-only — receiving these is what lets
# Postal track bounces and feed our suppression list.
resource "cloudflare_record" "sparx_email_mx" {
  count           = var.cloudflare_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.sparx_email[0].id
  name            = "@"
  type            = "MX"
  content         = "mail.sparx.email"
  priority        = 10
  ttl             = 1
  proxied         = false
  allow_overwrite = true
}

# SPF — Mailgun is our sole outbound path. email-worker (Cloud Run) POSTs
# to Mailgun's HTTP API and Mailgun delivers from its own IPs, so the
# SPF authorises only Mailgun's range. The exact string must be
# `v=spf1 include:mailgun.org ~all` — Mailgun's verifier rejects any
# other shape (extra `a mx` / additional includes fail their check even
# when SPF is technically correct).
#
# ~all is soft-fail (recommended over -all until reputation is established).
resource "cloudflare_record" "sparx_email_spf" {
  count           = var.cloudflare_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.sparx_email[0].id
  name            = "@"
  type            = "TXT"
  content         = "v=spf1 include:mailgun.org ~all"
  ttl             = 1
  proxied         = false
  allow_overwrite = true
  comment         = "SPF — Mailgun-only egress (HTTP API direct from email-worker)"
}

# Mailgun tracking CNAME. Mailgun rewrites links in outgoing mail to
# go through this hostname so they can record open/click events. Not
# strictly required for delivery, but expected by their dashboard.
resource "cloudflare_record" "sparx_email_mailgun_tracking" {
  count           = var.cloudflare_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.sparx_email[0].id
  name            = "email"
  type            = "CNAME"
  content         = "mailgun.org"
  ttl             = 1
  proxied         = false
  allow_overwrite = true
  comment         = "Mailgun open/click tracking CNAME"
}

# Mailgun DKIM. Mailgun signs outbound mail with this key (selector
# 'smtp') as it relays. Postal's own DKIM signature also travels
# through (different selector — see sparx_email_dkim above), so
# recipients see two valid signatures, either of which passes.
#
# Mailgun omits the leading `v=DKIM1;` (which is RFC-optional). To
# rotate: regenerate in Mailgun dashboard → Sending → Domain settings
# → DKIM, then paste the new public key here and `terraform apply`.
resource "cloudflare_record" "sparx_email_mailgun_dkim" {
  count           = var.cloudflare_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.sparx_email[0].id
  name            = "smtp._domainkey"
  type            = "TXT"
  content         = "k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDT5lbXUjuFHVevoB0GC2+T9mwVD8j4LT5NUIFe6e4E3mn71EeBrWba8vgRzG7jpXpoGAy/4/MhyNTeEs5WU9LSVXjnfpMfKI5M8oY20Kgvq7SY6P+nsQUDjMhWhraIdGcBOVENmeaYEiCt4i/8HsagVw22Cl77rs03UMktpb+fiQIDAQAB"
  ttl             = 1
  proxied         = false
  allow_overwrite = true
  comment         = "Mailgun DKIM (selector 'smtp') — relay signing key"
}

# DKIM placeholder — Postal generates the signing key at first
# `postal initialize`. After bootstrap, pull the public key out of the
# Postal admin UI (Organization → Server → DNS Setup) and fill it in
# below, then `terraform apply` again. Until populated, this resource
# is intentionally a placeholder string so the apply succeeds.
#
# After Postal generates the key:
#   1. In Postal Admin → DNS → copy the TXT value (full v=DKIM1; ... string)
#   2. Replace the `content` below with that exact string
#   3. terraform apply
resource "cloudflare_record" "sparx_email_dkim" {
  count           = var.cloudflare_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.sparx_email[0].id
  name            = "${var.sparx_email_dkim_selector}._domainkey"
  type            = "TXT"
  content         = var.sparx_email_dkim_value
  ttl             = 1
  proxied         = false
  allow_overwrite = true
  comment         = "DKIM — per-server selector from Postal admin UI"
}

# DMARC — start in `none` mode for first 2 weeks of sending so we can
# see reports without rejecting legitimate mail; bump to quarantine
# (then reject) once aggregate reports look clean.
#
# Report aggregators (rua/ruf):
#   - bef10f10@dmarc.mailgun.org — Mailgun's DMARC dashboard
#   - 85c257bc@inbox.ondmarc.com — OnDMARC (Red Sift) analyzer
#   - dmarc-reports@sparx.email   — our own mailbox (not yet wired,
#                                   reports will silently drop until
#                                   we set up an inbox)
resource "cloudflare_record" "sparx_email_dmarc" {
  count           = var.cloudflare_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.sparx_email[0].id
  name            = "_dmarc"
  type            = "TXT"
  content         = "v=DMARC1; p=none; pct=100; fo=1; ri=3600; adkim=r; aspf=r; rua=mailto:bef10f10@dmarc.mailgun.org,mailto:85c257bc@inbox.ondmarc.com,mailto:dmarc-reports@sparx.email; ruf=mailto:bef10f10@dmarc.mailgun.org,mailto:85c257bc@inbox.ondmarc.com,mailto:dmarc-reports@sparx.email;"
  ttl             = 1
  proxied         = false
  allow_overwrite = true
  comment         = "DMARC — p=none, reports to Mailgun + OnDMARC + sparx mailbox"
}

# =========================================================================
# Module marketing zones — apex + www → ingress (Cloudflare-proxied)
# =========================================================================
# Caddy looks at the Host header and serves the right marketing site.

locals {
  marketing_zones = var.cloudflare_enabled ? toset([
    "sparxcms.com",
    "sparxcrm.com",
    "sparxemail.com",
    "sparxb2b.com",
    "sparx.host",
    "sparx.software",
    "sparx.exchange",
    "sparx.market",
  ]) : toset([])
}

data "cloudflare_zone" "marketing" {
  for_each = local.marketing_zones
  name     = each.value
}

resource "cloudflare_record" "marketing_root" {
  for_each        = local.marketing_zones
  zone_id         = data.cloudflare_zone.marketing[each.value].id
  name            = "@"
  type            = "A"
  content         = google_compute_address.ingress.address
  ttl             = 1
  proxied         = true
  allow_overwrite = true
}

resource "cloudflare_record" "marketing_www" {
  for_each        = local.marketing_zones
  zone_id         = data.cloudflare_zone.marketing[each.value].id
  name            = "www"
  type            = "CNAME"
  content         = each.value
  ttl             = 1
  proxied         = true
  allow_overwrite = true
}

# =========================================================================
# wize.works — WizeWorks operator console (admin.wize.works)
# =========================================================================
# The Layer-4 operator console (docs/16 §2.4, docs/apps/admin/build-plan.md).
# wize.works is already a zone in this same Cloudflare account, so we look it up
# by name and add the one `admin` record + a Cloudflare Access policy that is the
# load-bearing auth gate until operator MFA ships (D8/D9). The console runs in the
# wize-admin namespace behind Caddy (admin.wize.works host block); Caddy proxies
# to admin.wize-admin.svc.cluster.local:3000.
#
# CERT SEQUENCING (like the kanninja blocks): the admin Caddy site has no
# on_demand_tls (wize.works isn't a sparx tenant). To let Caddy issue a managed
# Let's Encrypt cert, either (a) apply this record DNS-only (proxied=false) FIRST,
# let the cert issue, then flip to proxied=true; or (b) install a Cloudflare Origin
# CA cert on Caddy for this host. Access REQUIRES the record proxied, so the end
# state is proxied=true — set below. Adjust for the one-time issuance if needed.
data "cloudflare_zone" "wize_works" {
  count = var.cloudflare_enabled ? 1 : 0
  name  = "wize.works"
}

resource "cloudflare_record" "wize_works_admin" {
  count           = var.cloudflare_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.wize_works[0].id
  name            = "admin"
  type            = "A"
  content         = google_compute_address.ingress.address
  ttl             = 1
  proxied         = true
  allow_overwrite = true
  comment         = "WizeWorks operator console (Caddy → admin.wize-admin, behind Access)"
}

# Cloudflare Access self-hosted application gating admin.wize.works. This is the
# network boundary that stands in for MFA until the Better Auth twoFactor plugin
# lands (D8) — no request reaches the console without passing an Access policy.
resource "cloudflare_access_application" "admin" {
  count            = var.cloudflare_enabled ? 1 : 0
  zone_id          = data.cloudflare_zone.wize_works[0].id
  name             = "WizeWorks Operator Console"
  domain           = "admin.wize.works"
  type             = "self_hosted"
  session_duration = "8h"
}

# Allow only the explicitly-listed operator emails. Default-deny: anyone not on
# the list is refused at the edge, before Caddy or the app see the request.
resource "cloudflare_access_policy" "admin_operators" {
  count          = var.cloudflare_enabled ? 1 : 0
  application_id = cloudflare_access_application.admin[0].id
  zone_id        = data.cloudflare_zone.wize_works[0].id
  name           = "WizeWorks operators"
  precedence     = 1
  decision       = "allow"
  include {
    email = var.operator_access_emails
  }
}
