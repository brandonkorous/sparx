# Cloudflare Origin CA certificate for admin.wize.works (the WizeWorks operator
# console) — the one host that cannot use ACME.
#
# WHY NOT ACME. Cloudflare Access sits in front of admin.wize.works and answers
# every request itself, including /.well-known/acme-challenge/*, with its own
# login page. Both http-01 and tls-alpn-01 therefore fail for as long as the
# record is proxied — and unproxying it would remove the access gate that stands
# in for operator MFA. An Origin CA certificate sidesteps ACME entirely:
# Cloudflare signs it, its own edge trusts it, it is valid 15 years, and it
# never renews.
#
# HOW THIS DIFFERS FROM THE GCP COPY. envs/prod parks the cert + key in Secret
# Manager and relies on bootstrap.yml (components=caddy) to sync them into the
# `caddy-admin-origin` k8s secret. Azure has neither of those, and the gap was
# not theoretical: on 2026-08-01 Caddy rolled with the admin `tls` directive
# pointing at files nothing had ever written, and because Caddy fails config
# load as a UNIT that one missing file took down all ~40 hostnames rather than
# just this one. So this file writes the k8s Secret DIRECTLY — no out-of-band
# sync step exists to forget, and the certificate and its consumer move together
# in a single `terraform apply`.
#
# CURRENT STATE. The secret presently holds a self-signed stopgap created by
# hand during that incident, and the host serves correctly on it because
# wize.works is on SSL mode `full`, which accepts any origin certificate.
# Applying this replaces the stopgap with a real Origin CA cert, which is what
# makes SSL mode `full (strict)` possible — under plain `full` the edge→origin
# hop is encrypted but the origin is never authenticated.
#
# AUTH. Signing uses the ordinary cloudflare_api_token; the legacy account-level
# "Origin CA Key" is deprecated and deliberately not used. That token MUST carry
# Zone → SSL and Certificates → Edit on top of its DNS/Access scopes. Without it
# the create fails with 1016 "User is not authorized" — which is exactly why
# this is gated behind its own variable rather than var.cloudflare_enabled: the
# DNS records must stay appliable with a token that cannot sign certificates.

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

# requested_validity 5475 days = 15 years, the maximum Cloudflare allows, so this
# effectively never needs renewal — deliberate, because there is no renewal
# automation for it and a silent expiry would take the console down.
resource "cloudflare_origin_ca_certificate" "admin" {
  count              = local.origin_ca_enabled ? 1 : 0
  csr                = tls_cert_request.admin_origin[0].cert_request_pem
  hostnames          = ["admin.wize.works"]
  request_type       = "origin-rsa"
  requested_validity = 5475
}

# The Secret the ingress mounts at /certs/admin. `kubernetes.io/tls` rather than
# Opaque so the keys are exactly tls.crt / tls.key, which is what the Caddyfile's
# (tls_admin_origin) snippet reads.
#
# This intentionally OVERWRITES the hand-made self-signed stopgap of the same
# name. Caddy does not watch the file, so the pod must be restarted afterwards to
# pick the new certificate up — `kubectl rollout restart deploy/caddy -n
# sparx-prod`, or simply the next deploy.
resource "kubernetes_secret" "caddy_admin_origin" {
  count = local.origin_ca_enabled ? 1 : 0

  metadata {
    name      = "caddy-admin-origin"
    namespace = "sparx-prod"
  }

  type = "kubernetes.io/tls"

  data = {
    "tls.crt" = cloudflare_origin_ca_certificate.admin[0].certificate
    "tls.key" = tls_private_key.admin_origin[0].private_key_pem
  }
}
