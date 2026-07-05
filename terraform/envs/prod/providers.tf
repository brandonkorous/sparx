terraform {
  required_version = ">= 1.9.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.10"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 6.10"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.40"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.12"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

provider "cloudflare" {
  # Single token for everything, including Origin CA (origin-ca.tf). Since Aug 2022
  # the provider signs Origin CA cert requests with the API token — the legacy,
  # now-DEPRECATED "Origin CA Key" (api_user_service_key) is no longer needed. The
  # token must carry Zone → SSL and Certificates → Edit in addition to its DNS/
  # Access scopes.
  api_token = var.cloudflare_api_token
}
