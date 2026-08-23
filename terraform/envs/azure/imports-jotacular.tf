# =========================================================================
# jotacular.com — ADOPTING five records that already existed
# =========================================================================
# jotacular.com was added to the Cloudflare account and its records were created
# by hand before modules/dns described them. That left the module planning to
# CREATE five records that already answer, which is not a no-op: Cloudflare does
# not adopt on create, so the `www` CNAME fails with 81057, and the four A
# records are the worse half — duplicates are permitted, so the apply would go
# GREEN while leaving the domain with two competing answers.
#
# `import` fixes it properly: Terraform takes ownership of the existing records
# and converges them, rather than racing them. The blocks live here and not in
# modules/dns because an import block is only valid in the ROOT module — its
# `to` reaches into the module instead.
#
# Each id is `<zone_id>/<record_id>`, and the record id is looked up rather than
# pasted, so this carries no literal that goes stale the day a record is
# recreated. The lookups are `for_each`/`count`-guarded on the same flag as the
# records themselves, so turning jotacular DNS off turns these off with it
# rather than leaving a dangling reference.
#
# ONCE THIS HAS APPLIED CLEANLY, THIS WHOLE FILE CAN BE DELETED. An import block
# is a one-shot instruction; after the records are in state it is inert, and the
# only thing it still does is make every future plan depend on five data lookups
# that fail loudly if someone deletes a record by hand.

locals {
  # ONE condition, shared. `ingress.tf` passes this same local to the module as
  # `jotacular_dns_enabled`, so the lookups below and the records they adopt can
  # never disagree — switching jotacular DNS off removes both halves together,
  # rather than leaving an import block pointed at an address that stopped
  # existing.
  jotacular_dns_enabled = true

  jotacular_on    = var.cloudflare_enabled && local.jotacular_dns_enabled
  jotacular_adopt = local.jotacular_on ? toset(["jotacular.com"]) : toset([])
  jotacular_hosts = local.jotacular_on ? toset(["app", "api", "mcp"]) : toset([])
}

data "cloudflare_zone" "jotacular" {
  count = local.jotacular_on ? 1 : 0
  name  = "jotacular.com"
}

data "cloudflare_record" "jotacular_root" {
  count    = local.jotacular_on ? 1 : 0
  zone_id  = data.cloudflare_zone.jotacular[0].id
  hostname = "jotacular.com"
  type     = "A"
}

data "cloudflare_record" "jotacular_www" {
  count    = local.jotacular_on ? 1 : 0
  zone_id  = data.cloudflare_zone.jotacular[0].id
  hostname = "www.jotacular.com"
  type     = "CNAME"
}

data "cloudflare_record" "jotacular_hosts" {
  for_each = local.jotacular_hosts
  zone_id  = data.cloudflare_zone.jotacular[0].id
  hostname = "${each.value}.jotacular.com"
  type     = "A"
}

import {
  for_each = local.jotacular_adopt
  to       = module.dns.cloudflare_record.jotacular_root[0]
  id       = "${data.cloudflare_zone.jotacular[0].id}/${data.cloudflare_record.jotacular_root[0].id}"
}

import {
  for_each = local.jotacular_adopt
  to       = module.dns.cloudflare_record.jotacular_www[0]
  id       = "${data.cloudflare_zone.jotacular[0].id}/${data.cloudflare_record.jotacular_www[0].id}"
}

import {
  for_each = local.jotacular_hosts
  to       = module.dns.cloudflare_record.jotacular_hosts[each.key]
  id       = "${data.cloudflare_zone.jotacular[0].id}/${data.cloudflare_record.jotacular_hosts[each.key].id}"
}
