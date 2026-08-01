# DNS moved into a reusable module. These blocks make that a STATE MOVE rather
# than a destroy-and-recreate.
#
# Without them Terraform sees 27 resources disappear from the root module and 27
# appear inside `module.dns`, and plans exactly that: every platform A record
# deleted and re-added. Cloudflare would answer NXDOMAIN for the gap — the whole
# platform dark for however long the apply takes, for a refactor that changes no
# record value at all.
#
# Safe to delete once applied everywhere; no cost to leaving them.

moved {
  from = cloudflare_record.sparx_works_root
  to   = module.dns.cloudflare_record.sparx_works_root
}

moved {
  from = cloudflare_record.sparx_works_www
  to   = module.dns.cloudflare_record.sparx_works_www
}

moved {
  from = cloudflare_record.sparx_works_app
  to   = module.dns.cloudflare_record.sparx_works_app
}

moved {
  from = cloudflare_record.sparx_works_workbench
  to   = module.dns.cloudflare_record.sparx_works_workbench
}

moved {
  from = cloudflare_record.sparx_works_api
  to   = module.dns.cloudflare_record.sparx_works_api
}

moved {
  from = cloudflare_record.sparx_works_mcp
  to   = module.dns.cloudflare_record.sparx_works_mcp
}

moved {
  from = cloudflare_record.sparx_works_graphql
  to   = module.dns.cloudflare_record.sparx_works_graphql
}

moved {
  from = cloudflare_record.sparx_works_media
  to   = module.dns.cloudflare_record.sparx_works_media
}

moved {
  from = cloudflare_record.sparx_works_media_direct
  to   = module.dns.cloudflare_record.sparx_works_media_direct
}

moved {
  from = cloudflare_record.sparx_zone_root
  to   = module.dns.cloudflare_record.sparx_zone_root
}

moved {
  from = cloudflare_record.sparx_zone_wildcard
  to   = module.dns.cloudflare_record.sparx_zone_wildcard
}

moved {
  from = cloudflare_record.sparx_zone_customers
  to   = module.dns.cloudflare_record.sparx_zone_customers
}

moved {
  from = cloudflare_record.sparx_zone_mcp
  to   = module.dns.cloudflare_record.sparx_zone_mcp
}

moved {
  from = cloudflare_record.sparx_email_root
  to   = module.dns.cloudflare_record.sparx_email_root
}

moved {
  from = cloudflare_record.sparx_email_postal_admin
  to   = module.dns.cloudflare_record.sparx_email_postal_admin
}

moved {
  from = cloudflare_record.sparx_email_mail_a
  to   = module.dns.cloudflare_record.sparx_email_mail_a
}

moved {
  from = cloudflare_record.sparx_email_mx
  to   = module.dns.cloudflare_record.sparx_email_mx
}

moved {
  from = cloudflare_record.sparx_email_spf
  to   = module.dns.cloudflare_record.sparx_email_spf
}

moved {
  from = cloudflare_record.sparx_email_mailgun_tracking
  to   = module.dns.cloudflare_record.sparx_email_mailgun_tracking
}

moved {
  from = cloudflare_record.sparx_email_mailgun_dkim
  to   = module.dns.cloudflare_record.sparx_email_mailgun_dkim
}

moved {
  from = cloudflare_record.sparx_email_dkim
  to   = module.dns.cloudflare_record.sparx_email_dkim
}

moved {
  from = cloudflare_record.sparx_email_dmarc
  to   = module.dns.cloudflare_record.sparx_email_dmarc
}

moved {
  from = cloudflare_record.marketing_root
  to   = module.dns.cloudflare_record.marketing_root
}

moved {
  from = cloudflare_record.marketing_www
  to   = module.dns.cloudflare_record.marketing_www
}

moved {
  from = cloudflare_record.wize_works_admin
  to   = module.dns.cloudflare_record.wize_works_admin
}

moved {
  from = cloudflare_access_application.admin
  to   = module.dns.cloudflare_access_application.admin
}

moved {
  from = cloudflare_access_policy.admin_operators
  to   = module.dns.cloudflare_access_policy.admin_operators
}
