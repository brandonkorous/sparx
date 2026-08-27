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
# wizeworks/packages/social/src/adapters/facebook.ts. FB never fetches our CDN, so the 206
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


# Mailgun tracking CNAME. Mailgun rewrites links in outgoing mail to
# go through this hostname so they can record open/click events. Not
# strictly required for delivery, but expected by their dashboard.
# ---------------------------------------------------------------------------
# EMAIL AUTHENTICATION IS NOT MANAGED HERE. SPF, DKIM and DMARC for sparx.email
# are owned by MAILGUN, which writes them at domain verification.
#
# Four records used to be declared here — `sparx_email_spf`, `sparx_email_dkim`,
# `sparx_email_dmarc` and `sparx_email_mailgun_dkim`. They were Postal-era
# leftovers (their own comments described pulling a signing key out of the Postal
# admin UI), and Postal has been decommissioned since 2026-05-29.
#
# They never once applied. They were declared for months and appear in NO state
# file: every apply failed on them with "attempted to override existing record
# however didn't find an exact match" — Cloudflare refusing because Mailgun had
# already written the real ones — and the DKIM record additionally failed with
# "DNS name is invalid (9000)", since its selector variable is empty and the name
# it built was malformed. A human applying by hand simply ignored the errors; a
# pipeline that fails the release on a failed apply cannot.
#
# Removing them is not a workaround for that failure. Succeeding would have been
# the worse outcome: a SECOND `v=spf1` record on the same name is an SPF
# PERMERROR, which fails authentication for every message the platform sends.
# The one thing worse than "terraform cannot create this record" is "terraform
# created it".
#
# The `removed` blocks below say so to Terraform. `destroy = false` is the
# load-bearing part: this module is shared with terraform/envs/prod, whose state
# is not readable from here, so if any state anywhere DOES track one of these,
# it is forgotten rather than deleted out of Cloudflare. Deleting a live SPF or
# DKIM record silently breaks mail delivery.
#
# Mailgun's TRACKING CNAME below stays — it is ours, it applied cleanly, and it
# is in state.
# ---------------------------------------------------------------------------
removed {
  from = cloudflare_record.sparx_email_spf
  lifecycle {
    destroy = false
  }
}

removed {
  from = cloudflare_record.sparx_email_dkim
  lifecycle {
    destroy = false
  }
}

removed {
  from = cloudflare_record.sparx_email_dmarc
  lifecycle {
    destroy = false
  }
}

removed {
  from = cloudflare_record.sparx_email_mailgun_dkim
  lifecycle {
    destroy = false
  }
}

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
# Piggles — the sister brand's three surfaces
# =========================================================================
# Same cluster, same ingress IP, same Caddy. Three REGISTRABLE domains, and that
# is the point rather than an accident: they cannot share a cookie, which is what
# makes getpiggles the sole auth authority and lets mypiggles carry no sign-in UI
# at all (piggles/CLAUDE.md, "Cross-domain auth").
#
#   meetpiggles.com  discover        → piggles-web
#   getpiggles.com   authenticate    → piggles-account
#   mypiggles.com    operate         → piggles-console
#
# Proxied, like sparx.works and unlike sparx.zone: these are OUR hostnames with
# ordinary Caddy-managed certificates, so there is no ACME challenge that needs
# to reach the origin directly.

locals {
  piggles_zones = var.cloudflare_enabled ? toset([
    "meetpiggles.com",
    "getpiggles.com",
    "mypiggles.com",
  ]) : toset([])
}

data "cloudflare_zone" "piggles" {
  for_each = local.piggles_zones
  name     = each.value
}

resource "cloudflare_record" "piggles_root" {
  for_each        = local.piggles_zones
  zone_id         = data.cloudflare_zone.piggles[each.value].id
  name            = "@"
  type            = "A"
  content         = var.ingress_ip
  ttl             = 1
  proxied         = true
  allow_overwrite = true
  comment         = "Piggles — Caddy host-matches this name"
}

resource "cloudflare_record" "piggles_www" {
  for_each        = local.piggles_zones
  zone_id         = data.cloudflare_zone.piggles[each.value].id
  name            = "www"
  type            = "CNAME"
  content         = each.value
  ttl             = 1
  proxied         = true
  allow_overwrite = true
}

# api.mypiggles.com — the SAME api-rest every sparx app uses, on a hostname that
# is not another company's.
#
# This is not cosmetic. The console hands this origin to the CUSTOMER'S BROWSER
# (via /api/token) and the browser then calls it directly with a short-lived
# bearer token, so it is the one platform address a Piggles customer actually
# sees — in their network tab, in devtools, and in any CORS error they hit.
# api-rest runs `cors: { origin: true }`, so nothing needs allowlisting.
resource "cloudflare_record" "piggles_api" {
  count           = var.cloudflare_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.piggles["mypiggles.com"].id
  name            = "api"
  type            = "A"
  content         = var.ingress_ip
  ttl             = 1
  proxied         = true
  allow_overwrite = true
  comment         = "api-rest, on the brand's own hostname"
}

# mcp.mypiggles.com — the SAME api-mcp every sparx assistant connects to, on the
# brand's own hostname, and the most VISIBLE address Piggles owns.
#
# The console tells a customer to COPY this and paste it into Claude or ChatGPT
# by hand, and their assistant shows it back to them on every reconnection — so
# on the shared host they were being told, inside the Piggles console, to hand
# another company's hostname to their AI.
#
# It also decides where they authenticate. RFC 9728 discovery runs BEFORE any
# token exists, so there is no tenant to read a brand from and the HOST is the
# only thing carrying one; api-mcp maps this name to the Piggles brand and
# answers with getpiggles.com as the authorization server. One shared host meant
# one answer, and it sent Piggles customers to app.sparx.works to approve access
# to their own business.
resource "cloudflare_record" "piggles_mcp" {
  count           = var.cloudflare_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.piggles["mypiggles.com"].id
  name            = "mcp"
  type            = "A"
  content         = var.ingress_ip
  ttl             = 1
  proxied         = true
  allow_overwrite = true
  comment         = "api-mcp, on the brand's own hostname"
}

# =========================================================================
# piggles.site — Piggles TENANT sites (the sparx.zone of this brand)
# =========================================================================
# A Piggles business is provisioned on `<slug>.piggles.site` — that is what
# `provisionTenant`'s `zoneDomain` parameter exists for, and it is why the
# subdomain is a parameter rather than the `SPARX_ZONE_DOMAIN` env var: an env
# var is fixed per deployment and BOTH brands are served by the same processes,
# so every Piggles signup would otherwise have been handed a sparx.zone address.
#
# These records are necessary and were, for a while, not sufficient. Caddy issues
# a per-hostname certificate on first request and asks api-rest's
# `/internal/domain-check` whether the name is legitimate; that endpoint used to
# resolve against ONE zone, so a `*.piggles.site` host was not recognised as ours
# and never got a certificate — DNS resolving perfectly while the handshake
# failed. That is fixed: `OWNED_ZONES` in
# wizeworks/services/api-rest/src/lib/domain.ts reads the LIST in
# `SPARX_ZONE_DOMAINS` (sparx.zone,piggles.site in both ConfigMaps), and the site
# renderer reads the same list.
#
# The warning is kept in past tense rather than deleted because the failure shape
# is worth recognising: when a new zone is added, DNS is the half that looks
# right first, and a certificate that never issues is the half that does not
# announce itself.
data "cloudflare_zone" "piggles_site" {
  count = var.cloudflare_enabled ? 1 : 0
  name  = "piggles.site"
}

resource "cloudflare_record" "piggles_site_root" {
  count           = var.cloudflare_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.piggles_site[0].id
  name            = "@"
  type            = "A"
  content         = var.ingress_ip
  ttl             = 1
  proxied         = true
  allow_overwrite = true
}

# Every tenant site. DNS-ONLY, for exactly the reasons spelled out on
# `sparx_zone_wildcard` above — an ACME challenge cannot reach the origin through
# Cloudflare's proxy, and a Universal SSL wildcard matches only ONE label, so
# proxying this breaks `<site>.<tenant>.piggles.site` while DNS resolves fine.
#
# The same landmine applies: creating an explicit record for one tenant makes it
# the closest encloser and instantly NXDOMAINs every deeper name beneath it.
resource "cloudflare_record" "piggles_site_wildcard" {
  count           = var.cloudflare_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.piggles_site[0].id
  name            = "*"
  type            = "A"
  content         = var.ingress_ip
  ttl             = 1
  proxied         = false
  allow_overwrite = true
}

# The CNAME target a Piggles tenant points a custom domain at. Named in
# piggles/packages/config/src/product.ts as `customers.piggles.site`, so this
# record and that constant have to agree.
resource "cloudflare_record" "piggles_site_customers" {
  count           = var.cloudflare_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.piggles_site[0].id
  name            = "customers"
  type            = "A"
  content         = var.ingress_ip
  ttl             = 1
  proxied         = false
  allow_overwrite = true
  comment         = "Piggles tenant custom-domain CNAME target"
}

# =========================================================================
# jotacular.com — jotDOJO, a THIRD product on the same cluster
# =========================================================================
# Same ingress IP and same Caddy as everything above. jotDOJO lives in its own
# repository and its own `jotacular` namespace; Caddy reaches it cross-namespace by
# ClusterIP, so nothing about these records is special — they exist here because
# this module is where the platform's DNS lives, not because sparx serves it.
#
# FIVE NAMES, FOUR OF THEM DISTINCT SERVICES — and one pair that is not:
#
#   jotacular.com      the MARKETING site   → web    (jotacular namespace)
#   www.jotacular.com  the same, by CNAME   → web
#   app.jotacular.com  the PWA              → web             ← same Service
#   api.jotacular.com  REST v1              → api
#   mcp.jotacular.com  MCP server           → mcp
#
# The Services are named plainly — `web` / `api` / `mcp`, no product prefix —
# and are distinguished by NAMESPACE, which is what k8s/ingress/Caddyfile
# proxies to. This block previously wrote them `jotacular-web` / `-api` / `-mcp`,
# which has never been any Service's name: the rename sweep rewrote an already
# wrong `jotdojo-web` into a differently wrong spelling. Confirmed against the
# cluster on 2026-08-23 (`kubectl get svc -n jotdojo` → api, mcp, web).
#
# THE APEX AND `app.` ARE ONE DEPLOYMENT, split by Host inside the app
# (`apps/web/middleware.ts`, its ADR-040). So they need identical DNS and
# separate Caddy blocks, but no second Service, Deployment or port.
#
# `app.` IS NOT OPTIONAL AND THE APEX IS NOT A SUBSTITUTE. jotDOJO's ADR-010 and
# ADR-018 both settle this: a PWA's install origin is written into the
# home-screen icon at install time and does not follow a redirect, so shipping
# the app at the apex even once means every user who installed it must delete and
# reinstall to move. That is why the split has to be right before the first
# deploy rather than after.
#
# Proxied, like meetpiggles and sparx.works: these are OUR hostnames taking
# ordinary Caddy-managed certificates, so no ACME challenge needs to reach the
# origin directly. Cloudflare's SSL mode must be Full or Full (strict) — Flexible
# would speak plain HTTP to an origin that only serves HTTPS.
#
# EVERY ONE of these names must ALSO appear in api-rest's PLATFORM_HOSTNAMES
# (routes/internal/domain-check.ts). Their Caddy blocks use on-demand TLS, which
# asks that endpoint before issuing; a name missing there gets 403 `unknown_host`,
# never receives a certificate, and Cloudflare answers 525 for that hostname
# alone — which reads like a routing bug and is an allow-list omission.
locals {
  jotacular_enabled = var.cloudflare_enabled && var.jotacular_dns_enabled

  # Subdomains taking an A record straight at the ingress. The apex and `www` are
  # handled separately below because their record types differ.
  jotacular_hosts = local.jotacular_enabled ? toset(["app", "api", "mcp"]) : toset([])
}

data "cloudflare_zone" "jotacular" {
  count = local.jotacular_enabled ? 1 : 0
  name  = "jotacular.com"
}

resource "cloudflare_record" "jotacular_root" {
  count           = local.jotacular_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.jotacular[0].id
  name            = "@"
  type            = "A"
  content         = var.ingress_ip
  ttl             = 1
  proxied         = true
  allow_overwrite = true
  comment         = "jotDOJO marketing site — Caddy host-matches this name"
}

# CNAME rather than a second A record, so the apex is the single place the
# address is stated. Matched by the app itself rather than redirected in Caddy.
resource "cloudflare_record" "jotacular_www" {
  count           = local.jotacular_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.jotacular[0].id
  name            = "www"
  type            = "CNAME"
  content         = "jotacular.com"
  ttl             = 1
  proxied         = true
  allow_overwrite = true
}

resource "cloudflare_record" "jotacular_hosts" {
  for_each        = local.jotacular_hosts
  zone_id         = data.cloudflare_zone.jotacular[0].id
  name            = each.value
  type            = "A"
  content         = var.ingress_ip
  ttl             = 1
  proxied         = true
  allow_overwrite = true
  comment         = "jotDOJO ${each.value} — shared Caddy, jotacular namespace"
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

# Cloudflare Access self-hosted application gating admin.wize.works — the
# network boundary that stands in for MFA until the Better Auth twoFactor plugin
# lands (D8). No request reaches the console without passing a policy.
#
# ⚠️  THE LIVE APPLICATION IS NOT MANAGED HERE. It was created in the Zero Trust
# dashboard and Terraform has never owned it.
#
# The enforcement is real and verified: admin.wize.works answers 302 to
# plain-lake-421e.cloudflareaccess.com with `Www-Authenticate: Cloudflare-Access`,
# offering the built-in Cloudflare one-time-PIN identity provider. So an operator
# signs in with a Better Auth password AND an emailed code — two factors today,
# which is what the D8 note above is standing in for.
#
# Terraform is not the source of that. Every apply of THIS resource failed with
# "Authentication error (10000)" — the API token carries DNS scopes but not
# `Account → Access: Apps and Policies → Edit` — so the boundary was put in place
# by hand instead, and the two have been out of sync since. The risk is not an
# unprotected console; it is that nothing in the repository can prove, change, or
# restore the policy, and a dashboard edit that weakened it would leave no trace.
#
# GATED ON THE OPERATOR LIST, not on cloudflare_enabled. An Access application
# with no policy admits nobody — and the policy's own `include.email` cannot be
# empty. An empty list therefore means "not configured here", and Terraform plans
# nothing rather than planning something that cannot succeed.
#
# TO BRING THE LIVE APP UNDER TERRAFORM, all three are required:
#   1. Add `Account → Access: Apps and Policies → Edit` to CLOUDFLARE_API_TOKEN.
#   2. Set OPERATOR_ACCESS_EMAILS to the CURRENT allow-list from the dashboard —
#      this config is default-deny, so an incomplete list locks operators out.
#   3. `terraform import` the existing application and policy. Do NOT simply let
#      the count flip to 1: that plans a CREATE for a domain that already has an
#      Access app, which either duplicates the app or fails the release.
locals {
  access_enabled = var.cloudflare_enabled && length(var.operator_access_emails) > 0
}

resource "cloudflare_access_application" "admin" {
  count            = local.access_enabled ? 1 : 0
  zone_id          = data.cloudflare_zone.wize_works[0].id
  name             = "WizeWorks Operator Console"
  domain           = "admin.wize.works"
  type             = "self_hosted"
  session_duration = "8h"
}

# Allow only the explicitly-listed operator emails. Default-deny: anyone not on
# the list is refused at the edge, before Caddy or the app see the request.
resource "cloudflare_access_policy" "admin_operators" {
  count          = local.access_enabled ? 1 : 0
  application_id = cloudflare_access_application.admin[0].id
  zone_id        = data.cloudflare_zone.wize_works[0].id
  name           = "WizeWorks operators"
  precedence     = 1
  decision       = "allow"
  include {
    email = var.operator_access_emails
  }
}

# =========================================================================
# kanninja.com — kanNINJA, a FOURTH product on the same cluster
# =========================================================================
# Same ingress IP and same Caddy as everything above. kanNINJA lives in its own
# repository and its own `kanninja` namespace; Caddy reaches it cross-namespace
# by ClusterIP (k8s/ingress/Caddyfile), so nothing about these records is
# special — they are here because this module is where the platform's DNS lives.
#
#   kanninja.com      Next.js app + marketing  → frontend  (kanninja namespace)
#   www.kanninja.com  301 to the apex, in Caddy → frontend
#   api.kanninja.com  Fastify REST + Better Auth + WebSocket → backend
#   mcp.kanninja.com  hosted remote MCP server → mcp
#
# UNLIKE EVERY OTHER BRAND HERE, THESE RECORDS ALREADY EXIST AND ALREADY SERVE
# TRAFFIC — from GKE, created by hand, never described by Terraform. That is why
# `kanninja_dns_enabled` defaults to FALSE and why there are no `import` blocks:
# the records are not being adopted with their current values preserved, they
# are being REPOINTED, and `allow_overwrite` does that in one step. Enabling
# this variable IS the DNS cutover. See the variable's own description.
#
# Proxied, like every other first-party brand: Cloudflare's SSL mode must be
# Full or Full (strict), never Flexible, which would speak plain HTTP to an
# origin that only serves HTTPS.
#
# CERTIFICATES: all four names must ALSO be allow-listed in api-rest's
# PLATFORM_HOSTNAMES (wizeworks/services/api-rest/src/routes/internal/domain-check.ts),
# because their Caddy blocks use the ON-DEMAND policy. They did not always: the
# blocks originally used an explicit managed block, which cannot obtain a first
# certificate on this ingress at all — Caddy here is a single replica on a
# Recreate rollout, so every boot has a ~15-60s window with no registered load
# balancer backend and certmagic spends all its startup issuance attempts inside
# it. silicaui hit exactly this and moved to on-demand; kanNINJA's blocks were
# corrected to match. A name missing from that allow-list gets 403
# `unknown_host` from the ask endpoint, never receives a certificate, and
# Cloudflare answers 525 for that hostname alone — which reads like a routing
# bug and is an allow-list omission.
locals {
  kanninja_enabled = var.cloudflare_enabled && var.kanninja_dns_enabled

  # Subdomains taking an A record straight at the ingress. The apex and `www`
  # are handled separately below because their record types differ.
  kanninja_hosts = local.kanninja_enabled ? toset(["api", "mcp"]) : toset([])
}

data "cloudflare_zone" "kanninja" {
  count = local.kanninja_enabled ? 1 : 0
  name  = "kanninja.com"
}

resource "cloudflare_record" "kanninja_root" {
  count           = local.kanninja_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.kanninja[0].id
  name            = "@"
  type            = "A"
  content         = var.ingress_ip
  ttl             = 1
  proxied         = true
  allow_overwrite = true
  comment         = "kanNINJA app — shared Caddy, kanninja namespace"
}

# CNAME rather than a second A record, so the apex is the single place the
# address is stated. Caddy 301s this name to the apex, so it never needs to
# resolve to anything different.
resource "cloudflare_record" "kanninja_www" {
  count           = local.kanninja_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.kanninja[0].id
  name            = "www"
  type            = "CNAME"
  content         = "kanninja.com"
  ttl             = 1
  proxied         = true
  allow_overwrite = true
}

resource "cloudflare_record" "kanninja_hosts" {
  for_each        = local.kanninja_hosts
  zone_id         = data.cloudflare_zone.kanninja[0].id
  name            = each.value
  type            = "A"
  content         = var.ingress_ip
  ttl             = 1
  proxied         = true
  allow_overwrite = true
  comment         = "kanNINJA ${each.value} — shared Caddy, kanninja namespace"
}

# ---------------------------------------------------------------------------
# agconn.com — AGCONN, a FIFTH product on the same cluster
#
# A bilingual farmworker platform. Deploys from its own repository
# (brandonkorous/AgConnect) into its own `agconn` namespace; Caddy reaches it
# cross-namespace, exactly like jotacular and kanNINJA.
#
#   agconn.com        the marketing site + PWA  -> web    (agconn namespace)
#   www.agconn.com    the same, by CNAME        -> web
#   api.agconn.com    the Hono API              -> api
#   admin.agconn.com  the admin console         -> admin
#
# The right-hand names are the SERVICE names Caddy proxies to, confirmed against
# deploy/k8s/base in the AgConnect repo: web, api, admin. There is no `mcp` here
# and no separate `frontend` — AGCONN's marketing pages and its app are the same
# Next.js Service, which is why the apex and the app share one record.
#
# ADMIN IS PUBLIC AND PROXIED, like the other two. That is worth a note because
# sparx's own admin host takes an Origin CA certificate instead (origin-ca.tf).
# AGCONN's admin is an ordinary Next.js app behind Clerk with no such
# arrangement, so it takes the same on-demand policy as everything else — and
# therefore needs its hostname in api-rest's PLATFORM_HOSTNAMES like the rest.
# ---------------------------------------------------------------------------
locals {
  agconn_enabled = var.cloudflare_enabled && var.agconn_dns_enabled

  # `api` and `admin` are plain A records at the ingress. The apex and `www` are
  # handled separately below because one is an A and the other a CNAME.
  agconn_hosts = local.agconn_enabled ? toset(["api", "admin"]) : toset([])
}

data "cloudflare_zone" "agconn" {
  count = local.agconn_enabled ? 1 : 0
  name  = "agconn.com"
}

resource "cloudflare_record" "agconn_root" {
  count           = local.agconn_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.agconn[0].id
  name            = "@"
  type            = "A"
  content         = var.ingress_ip
  ttl             = 1
  proxied         = true
  allow_overwrite = true
  comment         = "AGCONN web — shared Caddy, agconn namespace"
}

# AN `A` RECORD, NOT A CNAME — the one place this block deviates from jotacular
# and kanNINJA, and it is a correction rather than a preference.
#
# It was a CNAME to the apex, matching the other two. That failed the release on
# 2026-08-27 with:
#
#   Error: attempted to override existing record however didn't find an exact
#          match ... with module.dns.cloudflare_record.agconn_www
#
# `allow_overwrite` matches on name AND TYPE. agconn.com predates this cluster:
# AgConnect's own infra/terraform/dns.tf already published `www` as an A record
# at the GKE ingress, so there was no CNAME to overwrite and the provider will
# not convert one type into the other. jotacular and kanNINJA had no such
# incumbent record, which is why the CNAME form worked for them and cannot here.
#
# The two forms are equivalent behind Cloudflare's proxy — both resolve to the
# proxy and both reach this ingress — and an A record additionally lets
# `allow_overwrite` REPOINT the stale GKE address rather than needing it deleted
# by hand first. Caddy 301s www to the apex before any application code runs.
#
# Deleting the old record and reverting to a CNAME would also work. It is not
# worth a manual step in a zone Terraform now owns.
resource "cloudflare_record" "agconn_www" {
  count           = local.agconn_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.agconn[0].id
  name            = "www"
  type            = "A"
  content         = var.ingress_ip
  ttl             = 1
  proxied         = true
  allow_overwrite = true
  comment         = "AGCONN www — 301s to the apex at Caddy"
}

resource "cloudflare_record" "agconn_hosts" {
  for_each        = local.agconn_hosts
  zone_id         = data.cloudflare_zone.agconn[0].id
  name            = each.value
  type            = "A"
  content         = var.ingress_ip
  ttl             = 1
  proxied         = true
  allow_overwrite = true
  comment         = "AGCONN ${each.value} — shared Caddy, agconn namespace"
}
