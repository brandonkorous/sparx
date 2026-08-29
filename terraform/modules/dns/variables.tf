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

variable "wizeworks_dns_enabled" {
  description = <<-EOT
    Whether to manage the wize.works APEX records for the WizeWorks marketing
    site. The `admin` record in the same zone is unconditional and unaffected —
    it predates this and belongs to the operator console.

    DEFAULTS **OFF**, matching every other brand switch here. Turning it on
    REPOINTS the apex: the records are written with `allow_overwrite`, so this is
    a cutover rather than an adoption, and it should ride a window rather than
    whichever apply comes next.

    PRECONDITIONS, to be verified in-cluster rather than assumed — the same list
    that gated kanNINJA and AGCONN:

      1. `site` is Running 1/1 in the `wizeworks` namespace.
      2. `curl http://site.wizeworks.svc.cluster.local/api/health` returns 200
         from inside the cluster.
      3. Caddy is already serving the `wize.works` host block.
      4. `wize.works` and `www.wize.works` are in PLATFORM_HOSTNAMES in
         api-rest's domain-check route, and api-rest has been rolled since.

    (4) is the one that fails confusingly: without it, on-demand TLS is denied
    at the ask endpoint and the site presents a CERTIFICATE error rather than a
    404, which reads like a DNS or Caddy problem and is neither.
  EOT
  type        = bool
  default     = false
}

variable "agconn_dns_enabled" {
  description = <<-EOT
    Whether to manage the agconn.com zone's records.

    DEFAULTS **OFF**, matching kanninja_dns_enabled and for a related but not
    identical reason. kanNINJA was live on GKE and flipping its switch WAS the
    cutover. AGCONN is not live anywhere — agconn.com currently resolves to
    Cloudflare and returns an error page, because the GKE origin it was pointed
    at is gone. So turning this on cannot take a working product down.

    What it CAN do is publish four hostnames that answer nothing. Caddy serves
    on-demand TLS, and a hostname routed before its Services exist gets a
    certificate request for a backend that is not there. Flip this only once
    `kubectl -n agconn get pods` shows web, api and admin Running.

    ONE THING TO CHECK BEFORE FLIPPING IT, and it is not visible from here: the
    `data "cloudflare_zone"` lookup below runs as var.cloudflare_api_token, which
    is SPARX's token. agconn.com was previously managed from the AgConnect repo's
    own terraform with its own token, so the two may sit in different Cloudflare
    accounts. If they do, this fails at plan time with a zone-not-found rather
    than anything mentioning permissions. Either scope sparx's token to the
    agconn.com zone, or leave agconn.com's DNS in AgConnect's terraform and drop
    this block — both are defensible; what is not defensible is two states
    writing the same records.
  EOT
  type        = bool
  default     = false
}

variable "rocketease_dns_enabled" {
  description = <<-EOT
    Whether to manage the rocketease.com zone's records.

    DEFAULTS **OFF**, matching kanninja_dns_enabled and agconn_dns_enabled.
    rocketease.com is already in Cloudflare but RocketEase is not live anywhere,
    so turning this on cannot take a working product down.

    What it CAN do is publish three hostnames that answer nothing. Caddy serves
    on-demand TLS, and a hostname routed before its Services exist produces a
    certificate request for a backend that is not there. Flip this only once
    `kubectl -n rocketease get pods` shows web, platform and worker Running and
    the platform answers /api/health with 200 — not merely with a pod that
    started, because the health route reports `ok:false` until the queue schema
    exists (the worker creates it on boot).

    THE ZONE IS NOT EMPTY. `allow_overwrite` matches on name AND TYPE and will
    not convert an A record into a CNAME, so if anything already publishes `@`,
    `www` or `app` in this zone with a different type, the apply fails with
    "attempted to override existing record however didn't find an exact match"
    — naming neither the incumbent nor the conflict. That is precisely what
    agconn.com did; see the note above `cloudflare_record.agconn_www`. Check the
    zone's existing records before flipping this.

    The `data "cloudflare_zone"` lookup runs as var.cloudflare_api_token, which
    is SPARX's token. If rocketease.com sits in a different Cloudflare account,
    this fails at plan time with a zone-not-found rather than anything mentioning
    permissions.
  EOT
  type        = bool
  default     = false
}
