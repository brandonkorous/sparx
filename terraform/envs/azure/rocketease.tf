# ---------------------------------------------------------------------------
# RocketEase — a FIFTH product on this subscription, and the third given its own
# database server rather than a database on sparx's.
#
# Shared with sparx, jotDOJO, kanNINJA and AGCONN: the resource group, the VNet,
# the private DNS zone, the AKS cluster, the Caddy ingress and its reserved
# public IP. Owned outright by RocketEase: this Postgres server, this Key Vault,
# this storage account, and (in terraform/bootstrap-azure/rocketease.tf) the CI
# identity that reads them.
#
# WHY ITS OWN SERVER. Same reasoning as kanninja.tf, which this file follows
# closely: a Flexible Server database is owned by the SERVER ADMIN unless
# something says otherwise, so a tenant database on sparx's server means the
# tenant's migration credential either IS `sparx_owner` — which opens the sparx
# and piggles databases just as readily — or has to be minted for it by sparx's
# own release. Its own server removes the arrangement rather than reproducing
# it: RocketEase administers its own server, creates its own roles from its own
# pipeline, and nothing in the sparx release has to know it exists.
#
# WHAT IS DELIBERATELY ABSENT, versus jotacular.tf:
#
#   azure.extensions   RocketEase's migrations contain ZERO `CREATE EXTENSION`,
#                      verified rather than assumed with
#                        grep -rhoiE 'create extension[^;]*' apps/platform/db/migrations/
#                      which returns nothing, and again against pg-boss's own
#                      DDL (dist/plans.js), which returns nothing either. Every
#                      primary key is `uuid DEFAULT gen_random_uuid()`, and that
#                      function has been in `pg_catalog` since PG 13. An
#                      allow-list entry would be inert, and an inert entry that
#                      looks load-bearing is worse than none.
#
#   Azure OpenAI       RocketEase calls Anthropic and OpenAI directly over their
#                      public APIs (ANTHROPIC_API_KEY / OPENAI_API_KEY, both
#                      optional and both hand-loaded into the vault). There is
#                      no Azure-hosted model seam to provision, and both
#                      features are off — visibly, in the UI — when the key is
#                      absent.
#
# DEPENDS ON jotacular.tf for `data.azurerm_client_config.current`, which is
# declared there and used here. If that file is ever removed, move the data
# block rather than deleting it.
# ---------------------------------------------------------------------------

variable "rocketease_enabled" {
  description = <<-EOT
    Master switch for this file. Off leaves RocketEase with no database, no vault
    and no storage, which is the correct state right up until its pipeline is
    ready to deploy against them — an empty vault and an idle server both look
    configured and are not.

    Independent of the switch of the same name in terraform/bootstrap-azure:
    separate states, applied by different principals. That one governs the CI
    identity; this one governs what the identity is allowed to reach.
  EOT
  type        = bool
  default     = true
}

variable "rocketease_key_vault_name" {
  description = <<-EOT
    GLOBALLY unique across Azure (it is a DNS label), 3-24 characters,
    alphanumerics and hyphens, must start with a letter.

    Its own vault rather than a prefix inside sparx's, for the same reason
    kanNINJA has one: a vault is the smallest scope Key Vault RBAC can assign a
    role to. `Key Vault Secrets User` on a shared vault would let RocketEase's
    pipeline read every sparx, jotDOJO and kanNINJA credential in it.
  EOT
  type        = string
  default     = "kv-rocketease-prod-cus"

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9-]{1,22}[a-zA-Z0-9]$", var.rocketease_key_vault_name))
    error_message = "Key Vault names are 3-24 chars, start with a letter, end alphanumeric, and allow only letters, digits and hyphens."
  }
}

variable "rocketease_upload_origins" {
  description = <<-EOT
    Browser origins allowed to reach the media container directly.

    THIS IS LOAD-BEARING, not a nicety. RocketEase's browser PUTs the file to
    Azure itself and GETs it back the same way; the server only ever signs a SAS
    (apps/platform/lib/storage/azure.ts — bytes never transit the cluster).
    Nothing server-side can grant the browser that access on its behalf, and
    nothing server-side sees the failure when it is missing: every upload AND
    every download fails at preflight, with no request reaching the app to log.

    Only `app.rocketease.com` — the apex is the marketing site and uploads
    nothing. `www.rocketease.com` is deliberately absent: Caddy 301s it to the
    apex before any application code runs, so a browser never holds it as an
    origin.

    Add `http://localhost:5001` only if you intend local development to write
    into the PRODUCTION container. It otherwise has no business here.
  EOT
  type        = list(string)
  default     = ["https://app.rocketease.com"]
}

locals {
  rocketease_count = var.rocketease_enabled ? 1 : 0
}

# ---------------------------------------------------------------------------
# Network
#
# Flexible Server requires a subnet DELEGATED to it, and a delegated subnet can
# host nothing else — hence a dedicated /28 per tenant rather than sharing one.
#
# 10.20.16.64/28 is the next free block. The allocation so far:
#
#   10.20.16.0/28   snet-psql              sparx
#   10.20.16.16/28  snet-psql-jotacular    jotacular
#   10.20.16.32/28  snet-psql-kanninja     kanNINJA
#   10.20.16.48/28  snet-psql-agconn       AGCONN
#   10.20.16.64/28  snet-psql-rocketease   THIS
#
# The next product takes 10.20.16.80/28. There is room for 11 more before the
# /24 boundary and far more before the VNet's /16 runs out.
# ---------------------------------------------------------------------------
resource "azurerm_subnet" "rocketease_postgres" {
  count                = local.rocketease_count
  name                 = "snet-psql-rocketease"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.20.16.64/28"]

  # Azure ADDS this itself when a Flexible Server is placed in the subnet — the
  # server needs it to reach backup storage. Declaring it is not decoration:
  # without it Terraform sees an undeclared endpoint, plans to REMOVE it, and the
  # next apply quietly degrades database backups.
  service_endpoints = ["Microsoft.Storage"]

  delegation {
    name = "fs"
    service_delegation {
      name = "Microsoft.DBforPostgreSQL/flexibleServers"
      actions = [
        "Microsoft.Network/virtualNetworks/subnets/join/action",
      ]
    }
  }
}

# ---------------------------------------------------------------------------
# Postgres 18
#
# Reuses the SHARED private DNS zone, which maps
# `<server>.postgres.database.azure.com` to a private IP for anything inside the
# VNet. It is per-VNet rather than per-server — a second zone would be a second
# copy of the same mapping, not isolation.
#
# The practical consequence, identical to every other server here: you cannot
# reach this database from a laptop. Migrations run as an in-cluster Job (see
# the deploy job in the RocketEase repo's .github/workflows/ci.yml). That is not
# a limitation to work around with a temporary firewall rule; it is the reason
# there is no firewall rule to get wrong.
# ---------------------------------------------------------------------------
resource "azurerm_postgresql_flexible_server" "rocketease" {
  count               = local.rocketease_count
  name                = "psql-rocketease-${var.environment}-${local.loc}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  version    = var.postgres_version
  sku_name   = var.postgres_sku
  storage_mb = var.postgres_storage_mb

  administrator_login    = "rocketease_owner"
  administrator_password = random_password.rocketease_owner[0].result

  delegated_subnet_id           = azurerm_subnet.rocketease_postgres[0].id
  private_dns_zone_id           = azurerm_private_dns_zone.postgres.id
  public_network_access_enabled = false

  # 7 days is the free minimum, and point-in-time restore is the entire reason
  # to pay for managed Postgres rather than running one in the cluster.
  backup_retention_days        = 7
  geo_redundant_backup_enabled = false

  # No HA. It doubles compute cost, and the cluster in front of it runs on a
  # Free-tier control plane with no SLA — buying HA for the database alone would
  # be incoherent.
  zone = "1"

  tags = local.tags

  depends_on = [azurerm_private_dns_zone_virtual_network_link.postgres]

  lifecycle {
    # Losing this is losing RocketEase's data. Removing the flag is a deliberate
    # two-step, exactly like every other server in this file's neighbourhood.
    prevent_destroy = true
  }
}

resource "azurerm_postgresql_flexible_server_database" "rocketease" {
  count     = local.rocketease_count
  name      = "rocketease"
  server_id = azurerm_postgresql_flexible_server.rocketease[0].id
  collation = "en_US.utf8"
  charset   = "utf8"

  lifecycle {
    prevent_destroy = true
  }
}

# ---------------------------------------------------------------------------
# Key Vault
#
# Replaces the pile of GitHub Actions secrets this would otherwise need — about
# forty, once every provider OAuth pair is loaded. That is the point of it:
# adding a credential becomes `az keyvault secret set` and nothing else moves,
# and rotating one does not require a repository setting to be edited by whoever
# happens to hold admin on it.
#
# Terraform owns SIX secrets here (see the bottom of this file) — the ones it
# generates or derives. The server admin PASSWORD is deliberately not among
# them: it is already carried inside DATABASE-ADMIN-URL, and it is surfaced as a
# sensitive output for incident use. Everything else — SMTP, Stripe, Anthropic,
# OpenAI, the provider OAuth pairs, and TOKEN-MASTER-KEY — is loaded once by hand
# and never appears in this configuration. A secret Terraform does not own is a
# secret that cannot leak through a plan file.
# ---------------------------------------------------------------------------
resource "azurerm_key_vault" "rocketease" {
  count               = local.rocketease_count
  name                = var.rocketease_key_vault_name
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = "standard"
  tags                = local.tags

  # RBAC, not the legacy access-policy model — same choice as every other vault
  # here. Access policies cannot be scoped by role and do not appear in
  # `az role assignment list`, so they drift invisibly.
  rbac_authorization_enabled = true

  soft_delete_retention_days = 7

  # OFF, deliberately, and this is a pre-launch setting rather than a permanent
  # one. With purge protection ON a deleted vault NAME is unusable for the whole
  # retention window even by its owner, which turns a mistaken destroy during
  # setup into a week of waiting or a renamed vault. Turn it on once RocketEase
  # is carrying real customer data — it is a one-way switch, so not before.
  purge_protection_enabled = false

  lifecycle {
    prevent_destroy = true
  }
}

# ---------------------------------------------------------------------------
# Media storage
#
# THE CORS BLOCK IS LOAD-BEARING. RocketEase's browser talks to this account
# directly in BOTH directions: the server signs a short-lived SAS and the browser
# PUTs the bytes to Azure and later GETs them back the same way
# (apps/platform/lib/storage/azure.ts). Nothing server-side can grant the browser
# that access on its behalf, and nothing server-side sees the failure when it is
# missing.
#
# `x-ms-blob-type` is in the header list because Azure REQUIRES it on a direct
# PUT and rejects the request without it. That makes it non-safelisted, which
# makes the PUT preflighted. The driver documents the same header from the client
# side, where its absence surfaces as a generic 400 that names nothing.
#
# GET and HEAD are here, not just PUT, because RocketEase reads straight from
# Blob — previews, report artifacts and the media a provider pulls at publish
# time are all signed URLs the browser or the provider fetches directly.
#
# Private container. Every access is a signed URL with a 10-minute (upload) or
# 60-minute (download) life; anonymous access is never granted.
# ---------------------------------------------------------------------------
resource "azurerm_storage_account" "rocketease" {
  count = local.rocketease_count

  # Storage account names are globally unique, 3-24 chars, lowercase
  # alphanumeric ONLY — no hyphens, which is why this cannot reuse local.suffix.
  name                     = "strocketease${var.environment}${local.loc}"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  account_kind             = "StorageV2"
  access_tier              = "Hot"
  tags                     = local.tags

  # The app signs SAS URLs with the account key, so shared-key auth stays on.
  # The key itself never leaves the server. Everything else is closed.
  shared_access_key_enabled       = true
  allow_nested_items_to_be_public = false
  https_traffic_only_enabled      = true
  min_tls_version                 = "TLS1_2"

  blob_properties {
    # A deleted blob is recoverable for a week. Asset deletion removes the ROW
    # first and tolerates a failed blob delete, so the dangerous direction is a
    # blob deleted while its row survives. This is the cheap insurance.
    delete_retention_policy {
      days = 7
    }

    cors_rule {
      allowed_origins = var.rocketease_upload_origins
      allowed_methods = ["GET", "HEAD", "PUT", "OPTIONS"]
      allowed_headers = ["content-type", "x-ms-blob-type"]
      # `etag` is what a client uses to detect a changed blob; `x-ms-request-id`
      # correlates a failed upload in the browser with the request on Azure's
      # side. `*` would satisfy the provider too and expose every response header
      # to script for no reason.
      exposed_headers    = ["etag", "x-ms-request-id"]
      max_age_in_seconds = 3600
    }
  }
}

resource "azurerm_storage_container" "rocketease_media" {
  count = local.rocketease_count
  # Matches AZURE_STORAGE_CONTAINER in the production overlay and the driver's
  # default. Renaming it here without setting that variable orphans every
  # existing object — keys are stored relative to the container root.
  name                  = "media"
  storage_account_id    = azurerm_storage_account.rocketease[0].id
  container_access_type = "private"
}

# ---------------------------------------------------------------------------
# Generated credentials
# ---------------------------------------------------------------------------

# The server admin. RocketEase owns its own server, so this is the credential its
# migrations run as — no cross-tenant Job, no borrowed `sparx_owner`.
resource "random_password" "rocketease_owner" {
  count   = local.rocketease_count
  length  = 32
  special = true
  # Azure rejects some punctuation in an admin password outright. This set
  # additionally survives a connection string, a psql `-v` substitution and a
  # dotenv line without all three having to agree about escaping.
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# The RESTRICTED role the application connects as, created by RocketEase's own
# release (the db-role Job) from the admin URL.
#
# WHAT THIS BUYS, honestly stated: RocketEase enforces tenancy in application
# code — `requireWorkspace()` on every request — and has no row-level security.
# So this role is not a tenancy boundary and must not be mistaken for one. It is
# narrower and still worth having: the application cannot execute DDL in
# `public`, so a SQL injection or a mistaken migration path cannot drop or alter
# a table.
#
# ONE EXCEPTION, GRANTED ON PURPOSE: the role OWNS the `pgboss` schema. pg-boss
# v12 issues CREATE SCHEMA, CREATE TABLE and CREATE TABLE ... PARTITION OF at
# runtime, in both the web process and the worker, so a role with no DDL
# anywhere cannot run the queue at all. The grant is scoped to that schema and
# nothing else.
resource "random_password" "rocketease_app" {
  count            = local.rocketease_count
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# Better Auth session-signing key material, so ALPHANUMERIC ONLY — deliberately.
#
# Better Auth uses the secret's exact bytes as key material. A dotenv parser
# cannot distinguish a trailing carriage return from a CRLF line ending, and
# trimming one silently reconstructs a DIFFERENT key: every session invalid,
# nothing logged, no configuration visibly wrong. sparx lost every operator's 2FA
# to exactly this. 48 alphanumeric characters carry ~285 bits and cannot express
# the bug at all — entropy was never the scarce thing, unambiguous bytes were.
#
# ROTATING THIS SIGNS EVERY USER OUT.
resource "random_password" "rocketease_auth_secret" {
  count   = local.rocketease_count
  length  = 48
  special = false
  upper   = true
  lower   = true
  numeric = true
}

# ---------------------------------------------------------------------------
# Vault contents
#
# NAMES ARE UPPERCASE-KEBAB. Key Vault secret names allow only alphanumerics and
# hyphens — an underscore is rejected outright — so the release maps `_` to `-`
# on read: DATABASE_URL in the container is DATABASE-URL here.
#
# sslmode=require: Flexible Server enforces TLS and neither the `postgres` driver
# (the app) nor `pg` (pg-boss) will negotiate it implicitly.
# ---------------------------------------------------------------------------
locals {
  rocketease_server = var.rocketease_enabled ? azurerm_postgresql_flexible_server.rocketease[0].fqdn : ""

  rocketease_secrets = var.rocketease_enabled ? {
    "DATABASE-URL" = {
      value = "postgresql://rocketease_app:${urlencode(random_password.rocketease_app[0].result)}@${local.rocketease_server}:5432/rocketease?sslmode=require"
      type  = "connection-string; the APPLICATION role. Rotate by tainting random_password.rocketease_app"
    }
    "DATABASE-ADMIN-URL" = {
      value = "postgresql://rocketease_owner:${urlencode(random_password.rocketease_owner[0].result)}@${local.rocketease_server}:5432/rocketease?sslmode=require"
      type  = "connection-string; migrations and role creation ONLY, never the running app"
    }
    "ROCKETEASE-APP-PASSWORD" = {
      value = random_password.rocketease_app[0].result
      type  = "password; the db-role Job sets this on rocketease_app. Must match DATABASE-URL"
    }
    "BETTER-AUTH-SECRET" = {
      value = random_password.rocketease_auth_secret[0].result
      type  = "key material; ROTATING THIS SIGNS EVERY USER OUT"
    }

    # ---------------------------------------------------------------------
    # TOKEN-MASTER-KEY IS DELIBERATELY NOT HERE. DO NOT ADD IT.
    #
    # It is the AES-256-GCM key that encrypts every stored provider OAuth token
    # (apps/platform/lib/crypto.ts, envelopes bound to the row id).
    # Terraform-managed secrets are REGENERATED whenever their random_password is
    # replaced — a taint, a provider upgrade that changes the resource, a
    # `-replace`, or someone tidying state. Every one of those would silently
    # swap the key, and every previously stored token would fail to decrypt with
    # an auth-tag error that names nothing.
    #
    # Losing it is not recoverable by re-running anything: the ciphertext is only
    # meaningful under the exact key that produced it. Every connected Instagram,
    # Facebook, LinkedIn and TikTok account would have to be reconnected by the
    # customer.
    #
    # So it is set ONCE, BY HAND, and lives only in this vault:
    #
    #   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
    #   az keyvault secret set --vault-name kv-rocketease-prod-cus \
    #     --name TOKEN-MASTER-KEY --value '<that value>'
    #
    # 32 bytes, base64. It is safe to generate only while `connection` holds zero
    # rows, and there is no warning when that stops being true.
    # ---------------------------------------------------------------------
    "AZURE-STORAGE-ACCOUNT" = {
      value = azurerm_storage_account.rocketease[0].name
      type  = "account name; not secret, carried here so one lookup finds everything"
    }
    "AZURE-STORAGE-KEY" = {
      value = azurerm_storage_account.rocketease[0].primary_access_key
      type  = "storage key; regenerating it in the portal makes this value stale"
    }
  } : {}
}

resource "azurerm_key_vault_secret" "rocketease" {
  for_each = local.rocketease_secrets

  name         = each.key
  value        = each.value.value
  key_vault_id = azurerm_key_vault.rocketease[0].id
  content_type = each.value.type
  tags         = local.tags

  lifecycle {
    # A vault secret is VERSIONED, so rewriting one is additive and safe. A
    # DESTROY is not: it soft-deletes the NAME, and with purge protection off
    # that is still a name held for the retention window. Every value here is
    # regenerable; the availability of the name during an incident is not.
    prevent_destroy = true
  }
}

# ---------------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------------

output "rocketease_key_vault_name" {
  description = "Vault holding RocketEase's secrets. Set as AZURE_KEY_VAULT_NAME on the RocketEase repo."
  value       = var.rocketease_enabled ? azurerm_key_vault.rocketease[0].name : null
}

output "rocketease_postgres_fqdn" {
  description = "Private FQDN of RocketEase's Postgres server. Resolvable only from inside the VNet."
  value       = var.rocketease_enabled ? azurerm_postgresql_flexible_server.rocketease[0].fqdn : null
}

output "rocketease_storage_account" {
  description = "Blob account backing uploaded media, renditions and report artifacts."
  value       = var.rocketease_enabled ? azurerm_storage_account.rocketease[0].name : null
}

output "rocketease_owner_password" {
  description = <<-EOT
    Server admin password. Needed only to reach the database by hand in an
    incident — the release reads DATABASE-ADMIN-URL from the vault instead, and
    nothing in normal operation wants this value.
  EOT
  value       = var.rocketease_enabled ? random_password.rocketease_owner[0].result : null
  sensitive   = true
}
