variable "project_id" {
  type        = string
  description = "GCP project ID for Sparx prod."
}

variable "region" {
  type    = string
  default = "us-central1"
}

variable "cloudflare_api_token" {
  type        = string
  sensitive   = true
  default     = ""
  description = "Cloudflare API token. Leave empty until domain transfers from GoDaddy complete."
}

variable "cloudflare_enabled" {
  type        = bool
  default     = false
  description = "Flip to true once sparx.works has been transferred to Cloudflare and var.cloudflare_api_token is set."
}

variable "ops_email" {
  type        = string
  description = "Notification target for Cloud Monitoring alerts. Use a group/distribution address."
  default     = "ops@sparx.works"
}

# DKIM TXT value for postal._domainkey.sparx.email. Postal generates the
# key pair at `postal initialize` (first boot of the postal-web pod); after
# that, copy the TXT value out of Postal Admin → DNS Setup and either set
# this variable in your tfvars or replace the default below directly.
#
# Placeholder default lets the apply succeed before Postal is bootstrapped.
# Mail clients will see a malformed DKIM record and reject signatures
# until this is populated, which is fine — we're not sending yet.
variable "sparx_email_dkim_value" {
  type        = string
  default     = "v=DKIM1; k=rsa; p=PENDING_POSTAL_BOOTSTRAP"
  description = "DKIM TXT value for <selector>._domainkey.sparx.email. Populate after first Postal bootstrap."
}

# Postal v3 puts a unique selector on each Server (DNS-safe random
# suffix like `postal-fID0Sm`). Both the selector and the value come
# from the Postal admin UI: Server -> Domains -> DNS Setup. Bump both
# together when a Server is rotated.
variable "sparx_email_dkim_selector" {
  type        = string
  default     = "postal"
  description = "DKIM selector chunk that prefixes ._domainkey for the per-server record (e.g. 'postal-fID0Sm')."
}

# Web Push (docs/69 A-6). The VAPID PUBLIC key is non-secret (handed to every
# browser at subscribe time), so it lives as a plain var, not in Secret Manager.
# The matching private key is the `vapid-private-key` secret. Generate both once
# with `npx web-push generate-vapid-keys`; set this in terraform.tfvars and the
# same value as VAPID_PUBLIC_KEY in app-env-configmap.yaml. Empty → push-worker
# acks every message as a no-op (deployable before keys exist).
variable "vapid_public_key" {
  type        = string
  default     = ""
  description = "VAPID application-server PUBLIC key (base64url). Non-secret; consumed by push-worker + the dashboard."
}
