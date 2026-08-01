# Cloudflare DNS for all Sparx-owned zones. PROVIDER-NEUTRAL.
#
# This was terraform/envs/prod/cloudflare.tf, where every A record read
# `google_compute_address.ingress.address` directly. That made the platform's
# entire public DNS a GCP artefact: pointing it at an AKS or EKS cluster meant
# rewriting 27 resources or keeping a second copy — the same "one file per
# cloud" pattern that had already produced two divergent Caddyfiles, and the
# reason the Azure deployment ended up with hand-made records that drifted from
# Terraform immediately.
#
# The only thing that varies between clouds is now `var.ingress_ip`. Both
# envs/prod (GCP) and envs/azure (AKS) call this module with their own reserved
# address and get byte-identical records.
#
# Gated by var.cloudflare_enabled. Flip to true once:
#   1. Zones are added in Cloudflare (data sources look them up by name)
#   2. the caller's Cloudflare provider has a token (Zone:DNS:Edit on these zones)
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
  content         = var.ingress_ip
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
  content         = var.ingress_ip
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
  content         = var.ingress_ip
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
  content         = var.ingress_ip
  ttl             = 1
  proxied         = true
  allow_overwrite = true
}

resource "cloudflare_record" "sparx_works_mcp" {
  count           = var.cloudflare_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.sparx_works[0].id
  name            = "mcp"
  type            = "A"
  content         = var.ingress_ip
  ttl             = 1
  proxied         = true
  allow_overwrite = true
}

resource "cloudflare_record" "sparx_works_graphql" {
  count           = var.cloudflare_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.sparx_works[0].id
  name            = "graphql"
  type            = "A"
  content         = var.ingress_ip
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
  content         = var.ingress_ip
  ttl             = 1
  proxied         = true
  allow_overwrite = true
  comment         = "Public CDN — transcoded media variants (Caddy → api-rest)"
}

# media-direct.sparx.works — the SAME origin, DNS-only (proxied = false), so it
# BYPASSES Cloudflare's edge. This is the "DNS-only origin media host" the 206 note
# below calls out as the fix for the URL-fetch platforms. Instagram/Threads/Pinterest
# publish by handing their servers an image_url; Cloudflare answers any `Range` request
# on a cacheable media object with a 206 (verified HIT + MISS) and they reject it,
# dropping the image. The origin returns a clean 200 to a ranged request, so a host that
# skips CF fixes them. The social-worker's MEDIA_DIRECT_BASE_URL points here for those
# platforms only (Facebook/LinkedIn byte-upload and keep the CDN host). Same reserved
# ingress IP; on-demand cert issues on the pod (allow-listed in api-rest
# /internal/domain-check). Trade-off: no CDN cache/WAF for this host, but it serves only
# public media variants and takes a handful of publish-time fetches — negligible.
resource "cloudflare_record" "sparx_works_media_direct" {
  count           = var.cloudflare_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.sparx_works[0].id
  name            = "media-direct"
  type            = "A"
  content         = var.ingress_ip
  ttl             = 1
  proxied         = false
  allow_overwrite = true
  comment         = "DNS-only origin — media variants for IG/Threads/Pinterest (bypasses CF 206-on-Range)"
}

# Strip the `Range` request header on public media IMAGE variants.
#
# Cloudflare serves any cached object as `206 Partial Content` when the request
# carries a `Range` header — even `Range: bytes=0-` (the whole file). Facebook's
# `/{page}/photos` ingestion (and other platforms' image-by-URL fetchers) send
# exactly that and REJECT a 206 with `(#324) Missing or invalid image file`, so
# a social post silently drops its image and goes out text-only. (The Sharing
# Debugger's OG scraper tolerates the 206 and renders a preview, which masks it.)
# Removing the Range header on these image paths forces a clean `200 OK` with the
# full body. Images are small and never need range seeking, so there is no
# downside; scoped to the media host + image extensions so any future *video*
# variants keep range support.
#
# TOKEN SCOPE: applying this needs the CF API token to include
# "Zone > Transform Rules > Edit" (or Zone WAF) — the DNS-only token this stack
# started with will 403 on the ruleset API. Expand the token before `terraform
# apply`, or add the equivalent rule in the dashboard (Rules → Transform Rules →
# Modify Request Header → Remove "Range") — but not both, since a zone can hold
# only ONE http_request_late_transform entrypoint ruleset.
# CLOUDFLARE 206 ON MEDIA RANGE REQUESTS — CONTEXT + THE URL-FETCH PLATFORM GAP
# (2026-07-25). Any `Range` request to a cacheable media object gets a `206 Partial
# Content` from Cloudflare's edge (verified on both HIT and MISS); the ORIGIN is
# fine — curl direct to the ingress with a Range header returns a clean 200
# (Server: Caddy). Facebook's /photos and every other platform's image-BY-URL
# fetcher send `Range: bytes=0-` and REJECT the 206 as `(#324) Missing or invalid
# image file`, so the image silently drops and the post goes out text-only.
#
# FACEBOOK is fixed WITHOUT Cloudflare: the social-worker now downloads the image
# and UPLOADS the bytes (multipart `source`) instead of handing Graph a url —
# packages/social/src/adapters/facebook.ts. FB never fetches our CDN, so the 206
# can't bite.
#
# INSTAGRAM / THREADS / PINTEREST — FIXED (2026-07-25) via a DNS-only origin host:
# `media-direct.sparx.works` (resource `sparx_works_media_direct` below) points at the
# same ingress with proxied = false, so it BYPASSES Cloudflare's edge entirely and the
# origin's clean 200 reaches the platform's fetcher. The social-worker's
# MEDIA_DIRECT_BASE_URL routes those three platforms' image_url there; Facebook/LinkedIn
# byte-upload and keep media.sparx.works. This is the "DNS-only origin media host" option
# below — chosen because a CF Snippet needs a PAID plan and a Transform Rule can't touch
# the `Range` managed header (the free-plan constraints this stack runs under).
#
# Alternatives NOT taken (kept for reference): a Cloudflare SNIPPET on /v1/public/media/*
# that deletes the Range header before cache (needs a paid plan), or a Cloudflare Worker
# (paid). Snippet body for reference:
#
#   export default { async fetch(request) {
#     if (request.headers.has("Range")) {
#       const headers = new Headers(request.headers); headers.delete("Range");
#       request = new Request(request, { headers });
#     }
#     return fetch(request);
#   }};

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
  content         = var.ingress_ip
  ttl             = 1
  proxied         = true
  allow_overwrite = true
}

# Wildcard for every tenant site — `<tenant>.sparx.zone` AND
# `<property>.<tenant>.sparx.zone`.
#
# MUST be DNS-only. Caddy issues a per-hostname Let's Encrypt certificate on
# first request, and an ACME challenge cannot reach the origin through
# Cloudflare's proxy. This is not a preference: proxying this record is what
# broke nested tenant hostnames during the tunnel period, because a tunnel
# carries only proxied hostnames, so TLS had to terminate at Cloudflare's edge
# on a Universal SSL certificate — and a wildcard certificate matches exactly
# ONE label (RFC 6125 §6.4.3), so every `<property>.<tenant>.sparx.zone`
# returned a handshake failure while DNS resolved perfectly.
#
# WHY DEPTH-2 NAMES RESOLVE FROM A ONE-LABEL WILDCARD. A DNS wildcard matches a
# single label, but only relative to its CLOSEST ENCLOSER. As long as no node
# exists at `<tenant>.sparx.zone`, the closest encloser for
# `site.wizeworks.sparx.zone` is `sparx.zone` and this record synthesises an
# answer. That holds today because NOTHING creates per-tenant records —
# verified: no code under services/ or packages/ calls the Cloudflare API, and
# tenant hostnames are minted only as `domains` rows (api-rest `mintZoneHost`).
#
# THE LANDMINE: adding an explicit record for a single tenant — by hand, or by
# some future per-tenant automation — creates that intermediate node and
# instantly NXDOMAINs every deeper name under it. One tenant's multi-site setup
# would break while every other tenant kept working, with nothing in the app
# changed. If per-tenant records ever become necessary, each one needs its own
# `*.<tenant>.sparx.zone` wildcard alongside it.
resource "cloudflare_record" "sparx_zone_wildcard" {
  count           = var.cloudflare_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.sparx_zone[0].id
  name            = "*"
  type            = "A"
  content         = var.ingress_ip
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
  content         = var.ingress_ip
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
  content         = var.ingress_ip
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
  content         = var.ingress_ip
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
  content         = var.ingress_ip
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
  content         = var.ingress_ip
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
  content         = var.ingress_ip
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
  content         = var.ingress_ip
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
