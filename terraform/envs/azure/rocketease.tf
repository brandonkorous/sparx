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
  # Merged, not replaced, so turning rocketease_ai_enabled off REMOVES the AI
  # secrets rather than stranding entries that point at a deleted account.
  for_each = merge(local.rocketease_secrets, local.rocketease_ai_secrets, local.rocketease_claude_secrets)

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

# ---------------------------------------------------------------------------
# Azure OpenAI - image generation for the media pipeline (M12).
#
# RocketEase generates ad imagery through `packages/media`, which routes every
# job through a pinned model registry. The Azure adapter is preferred over the
# direct OpenAI one when both are configured, for the reason this section
# exists: the prompt and the brand material it carries stay inside a resource we
# own, under the Azure agreement, instead of going to a third party the
# subprocessor page has to name separately.
#
# ITS OWN ACCOUNT, not a share of jotDOJO's. kanNINJA reuses
# `oai-jotdojo-prod-eus2` and that is fine for a low-volume seam, but image
# generation is customer-facing, bursty, and bills per image. Sharing an account
# means sharing a rate ceiling with jotDOJO's recognition path, where the
# failure mode is a customer's render queueing behind somebody's handwriting.
# Separate accounts also separate the Azure cost metric, which is the only way
# to price the feature later (docs/media-generation.md section 9).
#
# THE DATA-RESIDENCY STORY IS DIFFERENT FROM jotDOJO'S, and this is not a
# preference. Image models offer ONLY the GlobalStandard SKU - there is no
# regional Standard to choose, the way whisper forced regional Standard above.
# GlobalStandard routes capacity across a geography rather than pinning it to
# eastus2. The model reports area US, so it stays in the United States, which
# matches what the subprocessor page already says about Microsoft Azure - but it
# is NOT the same "one region" claim jotDOJO can make, and anything
# customer-facing must not imply otherwise.
# ---------------------------------------------------------------------------

variable "rocketease_ai_enabled" {
  description = <<-EOT
    Master switch for the account, the image deployment and the four secrets
    pointing at them. Off is a real state: `packages/media` routes to the direct
    OpenAI adapter when OPENAI_API_KEY is set, and refuses honestly when nothing
    is configured at all - canGenerate() returns false and the "Generate image"
    button never renders.

    S0 has no base fee and a deployment's capacity is a rate ceiling rather than
    a reservation, so the cost of this section at zero usage is zero.
  EOT
  type        = bool
  default     = true
}

variable "rocketease_ai_location" {
  description = <<-EOT
    DELIBERATELY NOT var.location. Verified against this subscription on
    2026-08-30 rather than recalled, with the query the jotDOJO section records:

        az cognitiveservices model list -l REGION

        centralus       no image model at all
        eastus2         gpt-image-1, -1-mini, -1.5, -2   all GlobalStandard
        westus3         the same four
        swedencentral   the same four

    centralus - where the VNet, Postgres and AKS live - carries NO image model,
    so this account cannot follow them. It does not need to: the data plane is
    reached over HTTPS from the cluster and shares nothing with the VNet.

    eastus2 so one region explains the whole tenant's AI footprint.
  EOT
  type        = string
  default     = "eastus2"
}

variable "rocketease_ai_capacity" {
  description = <<-EOT
    Rate ceiling for the image deployment, in the units Azure quotas by. This
    subscription's GlobalStandard limits in eastus2 on 2026-08-30:

        gpt-image-1       3     gpt-image-1.5   9
        gpt-image-1-mini  4     gpt-image-2     2

    2 is the WHOLE gpt-image-2 quota. Media generation is a closed beta
    (feature_grant, default off), so the ceiling that matters first is
    MEDIA_CEILING_USD_PER_JOB, not throughput. Raise the Azure quota before
    raising this number, or the apply fails on a limit rather than a typo.
  EOT
  type        = number
  default     = 2
}

variable "rocketease_ai_text_capacity" {
  description = <<-EOT
    Rate ceiling for the drafting deployment, in thousands of tokens per minute.
    This subscription's DataZoneStandard limits in eastus2 on 2026-08-31:

        gpt-5.4       300     gpt-5.4-mini   1000
        gpt-5.5       333     gpt-5.4-nano   2000

    50 is deliberately a sixth of the quota rather than all of it: drafting is
    interactive and bursty, and leaving headroom means a second deployment (a
    cheaper tier, or a staging one) does not need a quota fight first. The real
    spend control is the per-workspace credit ledger in lib/ai/usage.
  EOT
  type        = number
  default     = 50
}

variable "rocketease_ai_video_capacity" {
  description = <<-EOT
    Rate ceiling for the Sora 2 deployment. This subscription's GlobalStandard
    limit in eastus2 on 2026-09-01 is 9 for sora-2, and 9 is all of it.

    Taking the whole quota is safe here in a way it would not be for text: a
    video job runs for one to five minutes, so nothing else is going to be
    competing for the same per-minute budget, and there is no second video
    deployment to leave room for. The control that matters is
    MEDIA_CEILING_USD_PER_JOB - Sora bills PER SECOND, so a 12-second clip
    costs roughly three times a 4-second one and throughput is not the risk.
  EOT
  type        = number
  default     = 9
}

locals {
  rocketease_ai_on    = var.rocketease_enabled && var.rocketease_ai_enabled
  rocketease_ai_count = local.rocketease_ai_on ? 1 : 0
  rocketease_ai_name  = "oai-rocketease-prod-eus2"

  # The deployment name, which is NOT the model name. It is the URL path
  # segment, and the platform reads it from AZURE-OPENAI-IMAGE-DEPLOYMENT rather
  # than assuming it - the model registry pins WHICH model, this says only what
  # this account calls it.
  rocketease_ai_deployment = "rocketease-images"

  # VERSION PINNED, and the choice is a deprecation question rather than a
  # quality one. Inference-deprecation dates in eastus2 on 2026-08-30:
  #
  #     gpt-image-1      2026-10-23   <- SEVEN WEEKS. Do not build on it.
  #     gpt-image-1.5    2026-12-16
  #     gpt-image-1-mini 2027-04-07
  #     gpt-image-2      2027-10-21   <- chosen
  #
  # jotDOJO's lesson applies here and is worth repeating: an EXISTING deployment
  # survives its own deprecation, so a stale pin only bites on a REBUILD, which
  # is precisely when nobody is watching. gpt-image-2 buys fourteen months.
  #
  # Capabilities read from the same catalogue rather than assumed:
  # imageGenerations true, imageEdits true, area US.
  rocketease_ai_model   = "gpt-image-2"
  rocketease_ai_version = "2026-04-21"

  # TEXT, on the SAME account. Drafting ran on Claude until 2026-08-31; see the
  # Foundry section below for why it cannot. One account, one key, one endpoint
  # is a real simplification over two - and unlike images, text gets
  # DataZoneStandard, so the prompts carrying a customer's brand voice and
  # strategy stay inside the United States.
  #
  # gpt-5.4 rather than -mini: this product's whole value is the copy, drafting
  # is low-volume and interactive, and the credit ledger in lib/ai/usage is what
  # actually caps the bill. Swapping tier is one line here plus one vault value.
  rocketease_ai_text_deployment = "rocketease-text"
  rocketease_ai_text_model      = "gpt-5.4"
  rocketease_ai_text_version    = "2026-03-05"

  # VIDEO, on the same account again. Sora 2 is a first-party OpenAI model, so
  # unlike Claude it is not a Marketplace purchase and the Sponsored
  # subscription can actually deploy it.
  #
  # Inference-deprecation is why this takes the LATER of the two versions
  # offered in eastus2 on 2026-09-01 (2025-10-06 and 2025-12-08), the same
  # reasoning as gpt-image-2 above: an existing deployment survives its own
  # deprecation, so a stale pin only bites on a rebuild.
  #
  # The video data plane is NOT the images one. It is the v1 async job API
  # (/openai/v1/video/generations/jobs), the model travels in the BODY rather
  # than the URL path, and a job takes one to five minutes - so it is polled,
  # never run inline.
  rocketease_ai_video_deployment = "rocketease-video"
  rocketease_ai_video_model      = "sora-2"
  rocketease_ai_video_version    = "2025-12-08"
}

resource "azurerm_cognitive_account" "rocketease" {
  count               = local.rocketease_ai_count
  name                = local.rocketease_ai_name
  location            = var.rocketease_ai_location
  resource_group_name = azurerm_resource_group.main.name

  # AIServices, NOT OpenAI, since the portal upgrade on 2026-09-01. Terraform
  # treats `kind` as an in-place update rather than a replacement, so leaving
  # this as "OpenAI" did not threaten the data - it quietly REVERTED the
  # upgrade on the next apply, which is worse for being silent.
  #
  # What the upgrade did and did not do, measured rather than assumed:
  #   - both deployments survived, same names and capacities
  #   - the endpoint host moved from *.openai.azure.com to
  #     *.cognitiveservices.azure.com. BOTH still answer 200 on the images and
  #     chat data planes, so the vault value below switching hosts on the next
  #     apply is safe. Verified with live calls, not with the portal's promise.
  #   - QUOTA DID NOT CHANGE. gpt-image-2 stayed at 2 RPM in the OpenAI.*
  #     namespace; no AIServices.* image quota appeared. Resource kind decides
  #     which model families can be deployed, not the per-model rate limit.
  kind     = "AIServices"
  sku_name = "S0"
  tags     = local.tags

  # Set BY the portal upgrade, and it FORCES REPLACEMENT if config disagrees.
  # This is the trap in converting a resource by hand: `kind` was a harmless
  # in-place update, but this one would have destroyed and recreated an account
  # that soft-deletes and holds a global DNS label. `prevent_destroy` below
  # catches it, so the failure mode is a stuck pipeline rather than a lost
  # subdomain - but stuck is still broken.
  project_management_enabled = true

  # Required by the provider whenever project management is on, and the portal
  # upgrade assigned one already (principal 8df7c01c...). Declaring it here
  # ADOPTS that identity rather than creating a second one.
  identity {
    type = "SystemAssigned"
  }

  # REQUIRED, not cosmetic. Without a custom subdomain the account answers only
  # on the regional shared host, which does not serve the /openai/deployments/
  # data plane the adapter builds its URLs against.
  custom_subdomain_name = local.rocketease_ai_name

  # Public, for the reason recorded in the jotDOJO section: AKS egress leaves
  # through an AKS-managed SNAT address with no stable Terraform handle, so a
  # network ACL built on it would break silently the first time AKS rotated it.
  # The real hardening is managed identity, which removes the key rather than
  # the network path, and is a project rather than a line.
  public_network_access_enabled = true

  lifecycle {
    # A Cognitive Services account SOFT-DELETES and holds its name, including
    # the custom subdomain - a global DNS label. A careless destroy costs
    # oai-rocketease-prod-eus2 for the retention window, and every secret below
    # has to be rewritten against a new name.
    prevent_destroy = true
  }
}

resource "azurerm_cognitive_deployment" "rocketease_images" {
  count                = local.rocketease_ai_count
  name                 = local.rocketease_ai_deployment
  cognitive_account_id = azurerm_cognitive_account.rocketease[0].id

  model {
    format  = "OpenAI"
    name    = local.rocketease_ai_model
    version = local.rocketease_ai_version
  }

  sku {
    # GlobalStandard is the ONLY SKU image models offer - see the section
    # header. This is not the regional-vs-global choice jotDOJO had to make.
    name     = "GlobalStandard"
    capacity = var.rocketease_ai_capacity
  }

  # Hold the pin until Azure retires it, then move rather than go dark.
  version_upgrade_option = "OnceCurrentVersionExpired"
}

resource "azurerm_cognitive_deployment" "rocketease_text" {
  count                = local.rocketease_ai_count
  name                 = local.rocketease_ai_text_deployment
  cognitive_account_id = azurerm_cognitive_account.rocketease[0].id

  model {
    format  = "OpenAI"
    name    = local.rocketease_ai_text_model
    version = local.rocketease_ai_text_version
  }

  sku {
    # US-only inference, which image models cannot offer. Text is where it
    # matters most: an image prompt describes a scene, a drafting prompt
    # carries the brand voice, the strategy and whatever the customer pasted in.
    name     = "DataZoneStandard"
    capacity = var.rocketease_ai_text_capacity
  }

  version_upgrade_option = "OnceCurrentVersionExpired"
}

resource "azurerm_cognitive_deployment" "rocketease_video" {
  count                = local.rocketease_ai_count
  name                 = local.rocketease_ai_video_deployment
  cognitive_account_id = azurerm_cognitive_account.rocketease[0].id

  model {
    format  = "OpenAI"
    name    = local.rocketease_ai_video_model
    version = local.rocketease_ai_video_version
  }

  sku {
    # GlobalStandard is the only SKU sora-2 offers. Video cannot have the
    # DataZoneStandard treatment text gets, which is a real difference worth
    # knowing: a video prompt leaves the US even though a drafting prompt does not.
    name     = "GlobalStandard"
    capacity = var.rocketease_ai_video_capacity
  }

  version_upgrade_option = "OnceCurrentVersionExpired"
}

locals {
  # Six secrets, five of them not secret at all. They are here because the
  # vault is the ONLY channel the release reads: ci.yml builds the platform-env
  # Secret from vault entries and nothing else, so a value that is not here
  # cannot reach the container.
  rocketease_ai_secrets = local.rocketease_ai_on ? {
    "AZURE-OPENAI-ENDPOINT" = {
      value = azurerm_cognitive_account.rocketease[0].endpoint
      type  = "url; not secret. The adapter strips a trailing slash itself"
    }
    "AZURE-OPENAI-API-KEY" = {
      value = azurerm_cognitive_account.rocketease[0].primary_access_key
      type  = "account key; regenerating it in the portal makes this value stale"
    }
    "AZURE-OPENAI-API-VERSION" = {
      # NO DEFAULT IN THE CODE. The adapter reports itself unconfigured without
      # this, deliberately: Azure changes behaviour across versions and a
      # guessed one produces a 400 that reads like a bug in our request builder.
      #
      # Confirmed 2026-08-30 against Microsoft Learn as the version the
      # images/generations data plane requires. Not yet exercised against a live
      # call, because the deployment did not exist when it was written.
      value = "2025-04-01-preview"
      type  = "api version; images/generations data plane. Read from MS Learn 2026-08-30"
    }
    "AZURE-OPENAI-IMAGE-DEPLOYMENT" = {
      value = azurerm_cognitive_deployment.rocketease_images[0].name
      type  = "deployment name; not secret. NOT the model name"
    }
    "AZURE-OPENAI-TEXT-DEPLOYMENT" = {
      # Setting this is what switches drafting to Azure OpenAI. Unset, the
      # platform falls back to the Anthropic transport, which needs its own key.
      value = azurerm_cognitive_deployment.rocketease_text[0].name
      type  = "deployment name; not secret. Presence of this selects the azure-openai text transport"
    }
    "AZURE-OPENAI-TEXT-API-VERSION" = {
      # SEPARATE from the images one on purpose: the two data planes version
      # independently, and pinning them together means an images upgrade
      # silently changes what drafting sends.
      value = "2024-10-21"
      type  = "api version; chat/completions data plane. Confirmed against a live call 2026-08-31"
    }
    "AZURE-OPENAI-VIDEO-DEPLOYMENT" = {
      # Presence of this is what makes video generation offerable at all; the
      # adapter reports itself unconfigured without it, so nothing appears in
      # the UI rather than failing at the vendor.
      value = azurerm_cognitive_deployment.rocketease_video[0].name
      type  = "deployment name; not secret. Travels in the request BODY, not the URL path"
    }
    "AZURE-OPENAI-VIDEO-API-VERSION" = {
      # Literally the string "preview" - not a date. That is what the v1 video
      # job API takes (Microsoft Learn, read 2026-09-01), and it is why this is
      # a THIRD api-version rather than a reuse of either of the others.
      value = "preview"
      type  = "api version; v1 video job data plane. Read from MS Learn 2026-09-01"
    }
  } : {}
}

output "rocketease_openai_endpoint" {
  description = "Azure OpenAI data plane for RocketEase image generation. Null when rocketease_ai_enabled is false."
  value       = local.rocketease_ai_on ? azurerm_cognitive_account.rocketease[0].endpoint : null
}

# ---------------------------------------------------------------------------
# Microsoft Foundry - Claude for AI drafting.
#
# DORMANT SINCE 2026-08-31. Drafting runs on gpt-5.4 on the Azure OpenAI
# account above; see rocketease_ai_text_deployment.
#
# This section argued that consolidating on one vendor did NOT mean switching to
# GPT, because Claude is in the Foundry catalogue. The reasoning held; the
# subscription did not. A Sponsored subscription cannot transact in Azure
# Marketplace, so a partner model cannot be deployed here at all - measured, not
# inferred, and written up on rocketease_claude_deployment_enabled below.
#
# Kept rather than deleted because it is a switch, not a dead end: the account
# exists, the deployment is one flag, and lib/ai/transport/ picks a transport
# from configuration. Restoring Claude is a vault value, not a rewrite - which
# is the property that was missing when this had to be switched in a hurry.
#
# A SECOND ACCOUNT, not the OpenAI one above. Claude is `kind = "AIServices"`
# (Foundry); image generation is `kind = "OpenAI"`. They are different resource
# kinds with different data planes, so this cannot be a deployment on the
# existing account.
#
# THE RESIDENCY STORY IS BETTER HERE THAN FOR IMAGES, and that is worth stating
# because it is not uniform across this file. Image models offer GlobalStandard
# only. Claude's Hosted-on-Azure versions also offer DataZoneStandard, which
# keeps inference inside the United States - so the text prompts, which carry a
# customer's brand voice and strategy, do NOT leave the US, while image prompts
# may. Anthropic's own note: for deployments hosted on Azure, prompts and
# completions remain within Azure; only usage metadata and safety-flagged
# content egress.
# ---------------------------------------------------------------------------

variable "rocketease_claude_enabled" {
  description = <<-EOT
    Master switch for the Foundry resource, the Claude deployment and the three
    secrets pointing at them. Off is a real state: with ANTHROPIC_API_KEY unset
    the platform hides every AI drafting control and returns AI_UNCONFIGURED,
    which is the behaviour lib/ai/client.ts has always had.
  EOT
  type        = bool
  default     = true
}

variable "rocketease_claude_deployment_enabled" {
  description = <<-EOT
    The Claude DEPLOYMENT, separate from the account above and OFF by default.

    FLIPPING THIS TO TRUE ACCEPTS ANTHROPIC'S COMMERCIAL TERMS on behalf of the
    organization named in rocketease_claude_organization_name. The
    `modelProviderData` block below is an attestation, and the Cognitive
    Services RP uses it to accept the Azure Marketplace offer - there is no
    separate click-through anywhere. Treat this variable as the signature.

      https://www.anthropic.com/legal/commercial-terms
      https://www.anthropic.com/legal/aup

    OFF BECAUSE THE SUBSCRIPTION CANNOT TRANSACT IN AZURE MARKETPLACE, which is
    measured rather than inferred (2026-08-31):

        quotaId               Sponsored_2016-01-01
        accepted agreements   0, and none can be accepted

    A Sponsored subscription is one of the types Microsoft excludes from
    Marketplace third-party purchases, alongside Free Trial, Azure Pass,
    Visual Studio/MSDN and student. Claude is a partner model, so it is bought
    through Marketplace, so it cannot be deployed here at all. Every attempt
    returns the same opaque 715-123420.

    TWO THINGS THIS IS NOT, both ruled out by experiment rather than by reading:

      - not modelProviderData. The resource below now sends it, and the error
        is unchanged. (It was still a real bug: without it the first attempt
        failed with InvalidModelProviderData, so this would have blocked the
        deployment even on an eligible subscription.)
      - not quota. Capacity 1 fails identically to capacity 13, with 0/40
        GlobalStandard and 0/13 DataZoneStandard free and no soft-deleted
        account holding TPM (`az cognitiveservices account list-deleted`).
        Microsoft's troubleshooting table maps 715-123420 to quota; here that
        is a red herring, and following it cost an afternoon.

    To unblock: convert this subscription to Pay-As-You-Go, or put the Foundry
    account on one that already is. Then flip this to true - which is also the
    act that accepts the Anthropic terms above.
  EOT
  type        = bool
  default     = false
}

# ---------------------------------------------------------------------------
# The Anthropic attestation. Sent with the deployment, and legally meaningful:
# these three values are what the Marketplace offer is accepted UNDER, so they
# describe the real organization using the model rather than anything handy.
# ---------------------------------------------------------------------------

variable "rocketease_claude_organization_name" {
  description = "Legal entity using Claude. RocketEase is a WizeWorks LLC product; see apps/web/lib/site.ts in the app repo."
  type        = string
  default     = "WizeWorks LLC"
}

variable "rocketease_claude_country_code" {
  description = "Two-letter ISO country code for that entity. California, so US."
  type        = string
  default     = "US"

  validation {
    condition     = length(var.rocketease_claude_country_code) == 2
    error_message = "Must be a two-letter ISO country code."
  }
}

variable "rocketease_claude_industry" {
  description = "Industry of that entity. LOWERCASE — Foundry matches its portal dropdown exactly."
  type        = string
  default     = "technology"

  validation {
    condition = contains([
      "technology", "finance", "healthcare", "education",
      "retail", "manufacturing", "government", "media", "other",
    ], var.rocketease_claude_industry)
    error_message = "industry must be one of the lowercase values Foundry accepts."
  }
}

variable "rocketease_claude_capacity" {
  description = <<-EOT
    Rate ceiling for the Claude deployment. This subscription's eastus2 limits
    on 2026-08-30, read with `az cognitiveservices usage list -l eastus2`:

        GlobalStandard.claude-opus-5.Azure      40
        DataZoneStandard.claude-opus-5.Azure    13   <- what we use
        DataZoneStandard.claude-opus-4-8.Azure  13
        GlobalStandard.claude-sonnet-4-6        80

    13 is the WHOLE DataZoneStandard quota for this model. Drafting is
    interactive and low-volume; the ledger cap in lib/ai/usage is what actually
    protects the bill.
  EOT
  type        = number
  default     = 13
}

locals {
  rocketease_claude_on    = var.rocketease_enabled && var.rocketease_claude_enabled
  rocketease_claude_count = local.rocketease_claude_on ? 1 : 0
  # The account is free to exist; only the DEPLOYMENT hits the Marketplace.
  rocketease_claude_deploy_count = local.rocketease_claude_on && var.rocketease_claude_deployment_enabled ? 1 : 0
  rocketease_claude_name         = "ai-rocketease-prod-eus2"

  # The deployment name is what goes in the `model` field of every request -
  # NOT the model id, though it defaults to it. Kept identical here so a bill
  # line, a metric and AI_MODEL all read the same, which is the convention the
  # jotDOJO section set.
  rocketease_claude_deployment = "claude-opus-5"

  # MODEL AND VERSION PINNED, and the choice was forced by quota rather than
  # preference. Verified against this subscription on 2026-08-30:
  #
  #   claude-sonnet-5   quota 0 on EVERY sku - cannot be deployed at all,
  #                     despite being the platform's configured AI_MODEL default
  #   claude-opus-5     v2 (Hosted on Azure), GlobalStandard 40 / DataZone 13
  #   claude-opus-4-8   v2, same shape
  #
  # VERSION "2" IS LOAD-BEARING: version 1 is Hosted on Anthropic and offers
  # GlobalStandard only. Version 2 is Hosted on Azure and is the only one that
  # can be a DataZoneStandard deployment, which is the whole point of the sku
  # below.
  rocketease_claude_model   = "claude-opus-5"
  rocketease_claude_version = "2"
}

resource "azurerm_cognitive_account" "rocketease_claude" {
  count               = local.rocketease_claude_count
  name                = local.rocketease_claude_name
  location            = var.rocketease_ai_location
  resource_group_name = azurerm_resource_group.main.name
  kind                = "AIServices"
  sku_name            = "S0"
  tags                = local.tags

  # REQUIRED. The Anthropic data plane is served from
  # `https://<subdomain>.services.ai.azure.com/anthropic`, which does not exist
  # without a custom subdomain - the request 404s against the regional host.
  custom_subdomain_name = local.rocketease_claude_name

  public_network_access_enabled = true

  lifecycle {
    # Soft-deletes and holds the name, including the global DNS label.
    prevent_destroy = true
  }
}

# azapi, NOT azurerm_cognitive_deployment. The only reason is modelProviderData:
# azurerm cannot send it (#31140) and Anthropic deployments are refused without
# it. Everything else about this resource is ordinary.
resource "azapi_resource" "rocketease_claude" {
  count     = local.rocketease_claude_deploy_count
  type      = "Microsoft.CognitiveServices/accounts/deployments@2025-10-01-preview"
  name      = local.rocketease_claude_deployment
  parent_id = azurerm_cognitive_account.rocketease_claude[0].id

  # REQUIRED. The provider's baked schema has no modelProviderData, so leaving
  # validation on strips the one field this whole resource exists to send.
  schema_validation_enabled = false

  body = {
    sku = {
      # US-only inference. See the section header - this is the one place in
      # this file where we can make that promise, so we make it.
      name     = "DataZoneStandard"
      capacity = var.rocketease_claude_capacity
    }
    properties = {
      model = {
        # Anthropic, not OpenAI. The format decides which data plane serves it.
        format  = "Anthropic"
        name    = local.rocketease_claude_model
        version = local.rocketease_claude_version
      }

      # The attestation. This is what accepts the Marketplace offer.
      modelProviderData = {
        organizationName = var.rocketease_claude_organization_name
        countryCode      = var.rocketease_claude_country_code
        industry         = var.rocketease_claude_industry
      }

      # A partner model follows the Claude API lifecycle. Move rather than go
      # dark - but only once the pinned version actually expires, so a new
      # default never silently changes what drafting runs on.
      versionUpgradeOption = "OnceCurrentVersionExpired"
      raiPolicyName        = "Microsoft.DefaultV2"
    }
  }

  # The deployment NAME is what AI-MODEL carries, so it has to come back out.
  response_export_values = ["name"]
}

locals {
  # None of these three is secret except the key, and they are here for the
  # reason the rest of this file records: the vault is the only channel the
  # release reads.
  # Gated on the DEPLOYMENT: publishing a base URL with no model behind it
  # would point the app at an endpoint that 404s, which is worse than off.
  rocketease_claude_secrets = local.rocketease_claude_deploy_count > 0 ? {
    "ANTHROPIC-BASE-URL" = {
      # Built from the NAME, not from `.endpoint`. A Foundry account's endpoint
      # attribute is the cognitiveservices.azure.com host, which does not serve
      # the Anthropic data plane; that lives on services.ai.azure.com.
      value = "https://${azurerm_cognitive_account.rocketease_claude[0].name}.services.ai.azure.com/anthropic"
      type  = "url; not secret. The SDK appends /v1/messages"
    }
    "ANTHROPIC-API-KEY" = {
      value = azurerm_cognitive_account.rocketease_claude[0].primary_access_key
      type  = "Foundry account key. Sent as x-api-key, which Foundry accepts unchanged"
    }
    "AI-MODEL" = {
      value = azapi_resource.rocketease_claude[0].name
      type  = "DEPLOYMENT name, which is what the model field carries. Not a model id"
    }
  } : {}
}

output "rocketease_claude_base_url" {
  description = "Anthropic-compatible data plane for RocketEase AI drafting. Null when rocketease_claude_enabled is false."
  value       = local.rocketease_claude_on ? "https://${azurerm_cognitive_account.rocketease_claude[0].name}.services.ai.azure.com/anthropic" : null
}
