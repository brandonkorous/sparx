# Edge rules for sparx.works (SI-7), applied by the release like every other record here.
#
# A scraper on rotating residential IPs walks /market/* facet combinations, 6-20 values at once,
# ~400k requests a day. The web app already 404s more than 4 selections (MAX_FACET_SELECTIONS in
# sparx/apps/web/lib/browse-params.ts), but each request still reaches the origin. 4 commas means
# at least 5 selections whichever facets they sit in, so no URL the app accepts is blocked here.
#
# Off until var.cloudflare_waf_enabled: the token needs Zone > Zone WAF > Edit, and Cloudflare allows
# one ruleset per phase per zone, so a hand-made custom rule must be imported or deleted first.
resource "cloudflare_ruleset" "sparx_works_custom" {
  count       = var.cloudflare_enabled && var.cloudflare_waf_enabled ? 1 : 0
  zone_id     = data.cloudflare_zone.sparx_works[0].id
  name        = "sparx.works custom rules"
  description = "Managed by terraform/modules/dns/waf.tf"
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  rules {
    action      = "block"
    description = "Facet-crawl flood: /market/* selecting more facets than the app allows (SI-7)"
    enabled     = true
    expression  = "(starts_with(http.request.uri.path, \"/market/\") and (http.request.uri.query wildcard \"*,*,*,*,*\" or http.request.uri.query wildcard \"*%2c*%2c*%2c*%2c*\"))"
  }
}
