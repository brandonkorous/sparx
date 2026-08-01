# Public DNS for the platform, on the GCP deployment.
#
# The records themselves live in ../../modules/dns and are shared verbatim with
# the Azure env. This file exists only to say WHERE traffic lands — which on GCP
# is the regional static address fronting the GKE ingress.
#
# That single line is the entire provider-specific part of the platform's DNS.
# It used to be 27 lines: every A record read `google_compute_address.ingress`
# directly, so the DNS layer knew it was on GCP and could not point anywhere
# else without being rewritten.
module "dns" {
  source = "../../modules/dns"

  ingress_ip         = google_compute_address.ingress.address
  cloudflare_enabled = var.cloudflare_enabled

  operator_access_emails    = var.operator_access_emails
  sparx_email_dkim_selector = var.sparx_email_dkim_selector
  sparx_email_dkim_value    = var.sparx_email_dkim_value
}
