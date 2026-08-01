# The module declares only that it NEEDS the Cloudflare provider — it does not
# configure one. The calling env owns the `provider "cloudflare"` block and its
# API token, so the same module serves the GCP env and the Azure env without
# either one's credentials leaking into the other's state.
terraform {
  required_version = ">= 1.9"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.40"
    }
  }
}
