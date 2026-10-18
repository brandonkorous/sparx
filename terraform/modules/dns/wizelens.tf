# =========================================================================
# wizelens.com + wizelens.dev — WizeLens, a SEVENTH product on the same cluster
# =========================================================================
# The profiler from brandonkorous/wizelens. Deploys from its own repository into
# its own `wizelens` namespace; Caddy reaches it cross-namespace, exactly like
# RocketEase.
#
#   wizelens.com        marketing site and docs  -> site   (wizelens namespace)
#   www.wizelens.com    CNAME to the apex        -> (301 at Caddy)
#   app.wizelens.com    WizeLens Cloud           -> cloud
#   mcp.wizelens.com    Cloud's MCP endpoint     -> cloud  (only /_wizelens/mcp)
#   wizelens.dev       the same address         -> (301 to wizelens.com at Caddy)
#   www.wizelens.dev    CNAME to the .dev apex   -> (301 to wizelens.com at Caddy)
#
# .dev only redirects. Everything people read lives on .com, so search ranking
# and upkeep stay in one place.
#
# In its own file rather than appended to main.tf, because that file is already
# past a thousand lines and nothing here shares a local with it.
#
# CERTIFICATES: all six names are allow-listed in api-rest's PLATFORM_HOSTNAMES,
# because their Caddy blocks use the ON-DEMAND policy. See the note above
# rocketease_root for what a missing entry looks like (a 525 for that host alone).
locals {
  wizelens_enabled = var.cloudflare_enabled && var.wizelens_dns_enabled

  # Each zone's apex takes an A record at the ingress and its `www` a CNAME to
  # that apex. `app` and `mcp` exist only on .com.
  wizelens_zones = local.wizelens_enabled ? toset(["wizelens.com", "wizelens.dev"]) : toset([])
}

data "cloudflare_zone" "wizelens" {
  for_each = local.wizelens_zones
  name     = each.value
}

resource "cloudflare_record" "wizelens_root" {
  for_each        = local.wizelens_zones
  zone_id         = data.cloudflare_zone.wizelens[each.value].id
  name            = "@"
  type            = "A"
  content         = var.ingress_ip
  ttl             = 1
  proxied         = true
  allow_overwrite = true
  comment         = each.value == "wizelens.com" ? "WizeLens marketing site — shared Caddy, wizelens namespace" : "WizeLens .dev — 301s to wizelens.com at Caddy"
}

# CNAME at the apex is not possible, so `www` is the CNAME and the apex is the A
# record. Caddy 301s every www and .dev name to https://wizelens.com.
resource "cloudflare_record" "wizelens_www" {
  for_each        = local.wizelens_zones
  zone_id         = data.cloudflare_zone.wizelens[each.value].id
  name            = "www"
  type            = "CNAME"
  content         = each.value
  ttl             = 1
  proxied         = true
  allow_overwrite = true
  comment         = "WizeLens www — 301s to wizelens.com at Caddy"
}

resource "cloudflare_record" "wizelens_app" {
  count           = local.wizelens_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.wizelens["wizelens.com"].id
  name            = "app"
  type            = "A"
  content         = var.ingress_ip
  ttl             = 1
  proxied         = true
  allow_overwrite = true
  comment         = "WizeLens Cloud — shared Caddy, wizelens namespace"
}

# Cloud's MCP endpoint under its own name. Same Cloud pods as `app`; Caddy
# rewrites `/` and `/mcp` to /_wizelens/mcp and 404s every other path.
resource "cloudflare_record" "wizelens_mcp" {
  count           = local.wizelens_enabled ? 1 : 0
  zone_id         = data.cloudflare_zone.wizelens["wizelens.com"].id
  name            = "mcp"
  type            = "A"
  content         = var.ingress_ip
  ttl             = 1
  proxied         = true
  allow_overwrite = true
  comment         = "WizeLens MCP — shared Caddy, wizelens namespace"
}
