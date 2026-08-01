# Inputs for the DNS module.
#
# WHY THIS MODULE EXISTS. Every A record in main.tf used to read
# `google_compute_address.ingress.address` directly, so the platform's entire
# public DNS was welded to a GCP resource. Pointing DNS at an AKS or EKS cluster
# meant rewriting 27 resources or forking the file — the same "one copy per
# cloud" pattern that had already produced two divergent Caddyfiles.
#
# Cloudflare is neither a GCP nor an Azure service. Where the traffic lands is
# an INPUT, not something the DNS layer should know how to derive. So the
# provider-specific part is exactly one variable, and moving the platform
# between clouds is a change to which env passes it — not a change here.

variable "ingress_ip" {
  description = <<-EOT
    The address every platform A record points at: the ingress load balancer's
    public IP.

    GCP passes `google_compute_address.ingress.address`; Azure passes the
    `azurerm_public_ip` reserved for the AKS load balancer. Reserve it statically
    on whichever provider — an ephemeral address changes when the Service is
    recreated, and DNS then points at nothing until someone notices.
  EOT
  type        = string
}

variable "cloudflare_enabled" {
  description = <<-EOT
    Master switch. When false the module creates nothing, so a `terraform apply`
    without a Cloudflare token still succeeds — the same guard the records
    carried individually before they moved here.
  EOT
  type        = bool
  default     = false
}

variable "operator_access_emails" {
  description = <<-EOT
    Emails allowed through the Cloudflare Access policy on admin.wize.works.
    Access is the load-bearing gate in front of the operator console until
    operator MFA ships (docs/16 §2.4), so this list is a security control, not a
    convenience.
  EOT
  type        = list(string)
  default     = []
}

variable "sparx_email_dkim_selector" {
  description = "DKIM selector for the sparx.email sending domain."
  type        = string
  default     = ""
}

variable "sparx_email_dkim_value" {
  description = "DKIM public key TXT value for the sparx.email sending domain."
  type        = string
  default     = ""
}
