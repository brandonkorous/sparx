# Cloudflare Origin CA certificate for admin.wize.works (the WizeWorks operator
# console). This is the durable fix for the one host that sits behind Cloudflare
# Access: Access intercepts the ACME challenge path, so Caddy can never obtain a
# Let's Encrypt cert while proxied (see the failure documented in
# cloudflare.tf §wize.works and the Caddyfile admin block). An Origin CA cert
# sidesteps ACME entirely — Cloudflare signs it, it's trusted by Cloudflare's
# edge in Full(strict), it's valid 15 years, and it never renews. `proxied`
# stays true (matching cloudflare.tf) so there is zero drift.
#
# Flow: TF generates key + CSR → Cloudflare signs (Origin CA) → cert + key land
# in Secret Manager → bootstrap.yml (components=caddy) syncs them into the
# `caddy-admin-origin` k8s TLS secret → Caddy mounts it and the admin.wize.works
# block references it via `tls`.
#
# Gated on var.cloudflare_origin_ca_enabled (an explicit opt-in, not just
# cloudflare_enabled): the create needs the token to carry an extra permission
# (below), so you flip this once that's in place. While false the cert isn't
# created — but then the caddy bootstrap's cert-sync guard refuses to roll Caddy
# with the (cert-less) admin tls directive, so the two move together: enable +
# apply, then run components=caddy. Extend the same pattern to the rest of the
# non-tenant fleet later (docs discussion 2026-07-05) or migrate to ACME DNS-01.
#
# Auth: the cert is signed with the standard cloudflare_api_token — the legacy
# "Origin CA Key" is DEPRECATED and NOT used. That token must carry Zone → SSL
# and Certificates → Edit on top of its DNS/Access scopes, else the create fails
# with a Cloudflare auth error (10000).

locals {
  origin_ca_enabled = var.cloudflare_enabled && var.cloudflare_origin_ca_enabled
}

resource "tls_private_key" "admin_origin" {
  count     = local.origin_ca_enabled ? 1 : 0
  algorithm = "RSA"
  rsa_bits  = 2048
}

resource "tls_cert_request" "admin_origin" {
  count           = local.origin_ca_enabled ? 1 : 0
  private_key_pem = tls_private_key.admin_origin[0].private_key_pem

  subject {
    common_name = "admin.wize.works"
  }
}

# Cloudflare signs the CSR. requested_validity 5475 days = 15 years (the max), so
# this effectively never needs renewal.
resource "cloudflare_origin_ca_certificate" "admin" {
  count              = local.origin_ca_enabled ? 1 : 0
  csr                = tls_cert_request.admin_origin[0].cert_request_pem
  hostnames          = ["admin.wize.works"]
  request_type       = "origin-rsa"
  requested_validity = 5475
}

# Cert + key → Secret Manager. Deliberately NOT in the secrets module's secret_ids
# list (main.tf): those are containers whose values are added out-of-band, whereas
# these values are TF-generated, so container + version are co-located here. The
# bootstrap caddy step reads `admin-origin-cert` / `admin-origin-key`.
resource "google_secret_manager_secret" "admin_origin_cert" {
  count     = local.origin_ca_enabled ? 1 : 0
  secret_id = "admin-origin-cert"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "admin_origin_cert" {
  count       = local.origin_ca_enabled ? 1 : 0
  secret      = google_secret_manager_secret.admin_origin_cert[0].id
  secret_data = cloudflare_origin_ca_certificate.admin[0].certificate
}

resource "google_secret_manager_secret" "admin_origin_key" {
  count     = local.origin_ca_enabled ? 1 : 0
  secret_id = "admin-origin-key"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "admin_origin_key" {
  count       = local.origin_ca_enabled ? 1 : 0
  secret      = google_secret_manager_secret.admin_origin_key[0].id
  secret_data = tls_private_key.admin_origin[0].private_key_pem
}
