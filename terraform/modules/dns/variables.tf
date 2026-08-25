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

variable "jotacular_dns_enabled" {
  description = <<-EOT
    Whether to manage the jotacular.com zone's records.

    Separate from `cloudflare_enabled` because the zone must ALREADY EXIST in the
    Cloudflare account: `data "cloudflare_zone" "jotacular"` is a lookup, and a plan
    fails outright if the domain has not been added there yet. That failure is
    clear on its own ("no zone found"), but it would block every OTHER record this
    module manages — sparx and piggles included — for a product that is not live.

    So this defaults ON, matching the other brands, and exists as the switch to
    flip if jotacular.com is ever removed from the account or handed to a different
    registrar mid-migration. Turning it off drops only jotDOJO's records.
  EOT
  type        = bool
  default     = true
}

variable "kanninja_dns_enabled" {
  description = <<-EOT
    Whether to manage the kanninja.com zone's records.

    DEFAULTS **OFF**, and that is the opposite of every other brand in this
    module for one reason: kanNINJA IS ALREADY LIVE, served from GKE, with these
    records pointing at a Google address managed by hand.

    Turning this on does not "start managing" those records — `allow_overwrite`
    means it REPOINTS them at var.ingress_ip, which is this cluster. That is the
    DNS cutover itself. Doing it before kanNINJA's workloads are running in the
    `kanninja` namespace and answering health checks takes the product down.

    So flipping this to true is a deliberate, scheduled act performed in the
    cutover window (docs/azure-migration-plan.md, Phase 5), not a default that
    someone inherits by running `terraform apply` for an unrelated reason.

    Like jotacular_dns_enabled, this is also separate from `cloudflare_enabled`
    because `data "cloudflare_zone" "kanninja"` is a LOOKUP: the zone must exist
    in the account or the plan fails and blocks every other record this module
    manages.
  EOT
  type        = bool
  default     = false
}
