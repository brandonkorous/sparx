# ---------------------------------------------------------------------------
# kanNINJA — a FOURTH product on this subscription, and the second to be given
# its own database server rather than a database on sparx's.
#
# Shared with sparx, jotDOJO and SilicaUI: the resource group, the VNet, the
# private DNS zone, the AKS cluster, the Caddy ingress and its reserved public
# IP. Owned outright by kanNINJA: this Postgres server, this Key Vault, this
# storage account, and (in terraform/bootstrap-azure/kanninja.tf) the CI
# identity that reads them.
#
# WHY ITS OWN SERVER, when jotDOJO started with a database on sparx's. A
# Flexible Server database is owned by the SERVER ADMIN unless something says
# otherwise, so a tenant database on sparx's server means the tenant's migration
# credential either IS `sparx_owner` — a credential that opens the sparx and
# piggles databases just as readily, sitting in a Secret in another namespace —
# or has to be minted for it by sparx's own release, because a server-level role
# is not something a tenant of that server can create for itself. jotacular.tf
# carries both halves of that arrangement and the Job that makes it work.
#
# Its own server removes the arrangement rather than reproducing it: kanNINJA is
# the admin of its own server, so its release creates its own roles, and nothing
# in the sparx pipeline has to know kanNINJA exists. B_Standard_B1ms is ~$12/mo,
# which is roughly what the coordination was worth.
#
# WHAT IS DELIBERATELY ABSENT HERE, versus jotacular.tf:
#
#   azure.extensions   kanNINJA's migrations contain ZERO `CREATE EXTENSION` —
#                      verified with
#                        grep -rhoiE 'create extension[^;]*' backend/drizzle/
#                      which returns nothing. Every primary key is
#                      `uuid DEFAULT gen_random_uuid()`, and that function has
#                      been in `pg_catalog` since PG 13. An allow-list entry
#                      would be inert, and an inert entry that looks load-bearing
#                      is worse than no entry.
#
#   Azure OpenAI       kanNINJA calls OpenAI directly through OPENAI_API_KEY.
#                      There is no Azure-hosted model seam to provision.
#
# DEPENDS ON jotacular.tf for `data.azurerm_client_config.current`, which is
# declared there and used here. If that file is ever removed, move the data
# block rather than deleting it.
# ---------------------------------------------------------------------------

variable "kanninja_enabled" {
  description = <<-EOT
    Master switch for this file. Off leaves kanNINJA with no database, no vault
    and no storage, which is the correct state right up until its repository is
    ready to deploy against them — an empty vault and an idle server both look
    configured and are not.

    Independent of the switch of the same name in terraform/bootstrap-azure:
    separate states, applied by different principals. That one governs the CI
    identity; this one governs what the identity is allowed to reach.
  EOT
  type        = bool
  default     = true
}

variable "kanninja_key_vault_name" {
  description = <<-EOT
    GLOBALLY unique across Azure (it is a DNS label), 3-24 characters,
    alphanumerics and hyphens, must start with a letter.

    Its own vault rather than a prefix inside sparx's, for the same reason
    jotDOJO has one: a vault is the smallest scope Key Vault RBAC can assign a
    role to. `Key Vault Secrets User` granted on a shared vault would let
    kanNINJA's pipeline read every sparx and jotDOJO credential in it.
  EOT
  type        = string
  default     = "kv-kanninja-prod-cus"

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9-]{1,22}[a-zA-Z0-9]$", var.kanninja_key_vault_name))
    error_message = "Key Vault names are 3-24 chars, start with a letter, end alphanumeric, and allow only letters, digits and hyphens."
  }
}

variable "kanninja_upload_origins" {
  description = <<-EOT
    Browser origins allowed to reach the attachments container directly.

    This is not decoration and it is not a nicety — see the CORS block on the
    storage account. kanNINJA's browser PUTs the file to Azure itself and GETs
    it back the same way; the API only ever signs the URL. Without a matching
    origin here every upload AND every download fails at preflight, with no
    server-side trace, because no request ever reaches the backend.

    `www.kanninja.com` is deliberately absent: Caddy 301s it to the apex before
    any application code runs, so a browser never holds it as an origin.

    Add `http://localhost:3000` only if you intend local development to write
    into the PRODUCTION container. It otherwise has no business here.
  EOT
  type        = list(string)
  default     = ["https://kanninja.com"]
}

locals {
  kanninja_count = var.kanninja_enabled ? 1 : 0
}

# ---------------------------------------------------------------------------
# Network
#
# Flexible Server requires a subnet DELEGATED to it, and a delegated subnet can
# host nothing else — hence a third /28 rather than sharing either existing one.
#
# ADDRESSING, and why this specific block. The Postgres subnets are packed
# consecutively immediately above the AKS subnet:
#
#     snet-aks              10.20.0.0/20     10.20.0.0   - 10.20.15.255
#     snet-psql   (sparx)   10.20.16.0/28    10.20.16.0  - 10.20.16.15
#     snet-psql-jotacular   10.20.16.16/28   10.20.16.16 - 10.20.16.31
#     snet-psql-kanninja    10.20.16.32/28   10.20.16.32 - 10.20.16.47   <- this
#
# The next product takes 10.20.16.48/28. There is room for 13 more before the
# /24 boundary and far more before the VNet's /16 runs out, so this pattern does
# not need revisiting.
# ---------------------------------------------------------------------------
resource "azurerm_subnet" "kanninja_postgres" {
  count                = local.kanninja_count
  name                 = "snet-psql-kanninja"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.20.16.32/28"]

  # Azure ADDS this itself when a Flexible Server is placed in the subnet — the
  # server needs it to reach backup storage. Declaring it is not optional
  # bookkeeping: without it Terraform sees an undeclared endpoint, plans to
  # REMOVE it, and the next apply quietly degrades database backups. See the
  # same note on snet-psql in main.tf, where it was found the hard way.
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
# Reuses the SHARED private DNS zone. The zone maps
# `<server>.postgres.database.azure.com` to a private IP for anything inside the
# VNet, and it is per-VNet rather than per-server — a second zone would be a
# second copy of the same mapping, not isolation.
#
# The practical consequence, identical to every other server here: you cannot
# reach this database from a laptop. Migrations run as an in-cluster Job. That
# is not a limitation to work around with a temporary firewall rule; it is the
# reason there is no firewall rule to get wrong.
#
# VERSION 18, against a Supabase source on an older major. That direction is
# fine — the schema arrives from the drizzle baseline rather than the dump, and
# the data is restored `--data-only`. What is NOT fine is a `pg_dump` CLIENT
# older than the Supabase SERVER: it refuses at the version check. Whatever
# image the migration Job runs must carry a client at least as new as the source.
# ---------------------------------------------------------------------------
resource "azurerm_postgresql_flexible_server" "kanninja" {
  count               = local.kanninja_count
  name                = "psql-kanninja-${var.environment}-${local.loc}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  version    = var.postgres_version
  sku_name   = var.postgres_sku
  storage_mb = var.postgres_storage_mb

  administrator_login    = "kanninja_owner"
  administrator_password = random_password.kanninja_owner[0].result

  delegated_subnet_id           = azurerm_subnet.kanninja_postgres[0].id
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
    # Losing this is losing kanNINJA's data. Removing the flag is a deliberate
    # two-step, exactly like every other server in this file's neighbourhood.
    prevent_destroy = true
  }
}

resource "azurerm_postgresql_flexible_server_database" "kanninja" {
  count     = local.kanninja_count
  name      = "kanninja"
  server_id = azurerm_postgresql_flexible_server.kanninja[0].id
  collation = "en_US.utf8"
  charset   = "utf8"

  lifecycle {
    prevent_destroy = true
  }
}

# ---------------------------------------------------------------------------
# Key Vault
#
# Replaces roughly sixty individual GitHub Actions secrets. That is the point of
# it: adding a credential becomes `az keyvault secret set` and nothing else
# moves, and rotating one does not require a repository setting to be edited by
# whoever happens to hold admin on it.
#
# Terraform owns SIX secrets here — the ones it generates or derives (see the
# bottom of this file). The server admin PASSWORD is deliberately not among
# them: it is already carried inside DATABASE-ADMIN-URL, and it is surfaced as a
# sensitive output for incident use. jotDOJO publishes its owner password as a
# vault secret because SPARX's release has to read it to bootstrap a role on a
# server jotDOJO does not own; kanNINJA owns its server, so nothing external
# ever needs that value and it should not sit in a second place. Everything else (Stripe, OpenAI, Resend, the Google
# sign-in client, INTEGRATION_ENCRYPTION_KEY, the MCP token pair, and the ~25
# integration OAuth client pairs) is loaded once by hand and never appears in
# this configuration. A secret Terraform does not own is a secret that cannot
# leak through a plan file.
# ---------------------------------------------------------------------------
resource "azurerm_key_vault" "kanninja" {
  count               = local.kanninja_count
  name                = var.kanninja_key_vault_name
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = "standard"
  tags                = local.tags

  # RBAC, not the legacy access-policy model — same choice as sparx's and
  # jotDOJO's vaults. Access policies cannot be scoped by role and do not appear
  # in `az role assignment list`, so they drift invisibly.
  rbac_authorization_enabled = true

  soft_delete_retention_days = 7

  # OFF, deliberately, and this is a pre-launch setting rather than a permanent
  # one. With purge protection ON a deleted vault NAME is unusable for the whole
  # retention window even by its owner, which turns a mistaken destroy during
  # setup into a week of waiting or a renamed vault. Turn it on once kanNINJA is
  # carrying real customer data — it is a one-way switch, so not before.
  purge_protection_enabled = false

  lifecycle {
    prevent_destroy = true
  }
}

# ---------------------------------------------------------------------------
# Card attachments
#
# THE CORS BLOCK IS LOAD-BEARING. kanNINJA's browser talks to this account
# directly in BOTH directions: the API signs a short-lived SAS and the browser
# PUTs the bytes to Azure and later GETs them back the same way
# (backend/src/config/azure-storage.ts — "attachment bytes never transit the
# cluster"). Nothing server-side can grant the browser that access on its
# behalf, and nothing server-side sees the failure when it is missing.
#
# This is a WIDER method set than sparx's media account, and the difference is
# real rather than carelessness: sparx streams reads back through api-rest, so
# its account allows only PUT + OPTIONS. kanNINJA reads straight from Blob, so
# GET and HEAD have to be here too.
#
# `x-ms-blob-type` is in the header list because Azure REQUIRES it on a direct
# PUT and rejects the request without it. That makes it non-safelisted, which
# makes it part of the preflight. azure-storage.ts documents the same header
# from the client side, where its absence surfaces as a generic 400 that names
# nothing.
#
# Private container. Every access is a signed URL with a 15-minute (upload) or
# 60-minute (download) life; anonymous access is never granted.
# ---------------------------------------------------------------------------
resource "azurerm_storage_account" "kanninja" {
  count = local.kanninja_count

  # Storage account names are globally unique, 3-24 chars, lowercase
  # alphanumeric ONLY — no hyphens, which is why this cannot reuse local.suffix.
  name                     = "stkanninja${var.environment}${local.loc}"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  account_kind             = "StorageV2"
  access_tier              = "Hot"
  tags                     = local.tags

  # The backend signs SAS URLs with the account key, so shared-key auth stays
  # on. The key itself never leaves the backend. Everything else is closed.
  shared_access_key_enabled       = true
  allow_nested_items_to_be_public = false
  https_traffic_only_enabled      = true
  min_tls_version                 = "TLS1_2"

  blob_properties {
    # A deleted blob is recoverable for a week. The delete path in
    # routes/cards/attachments.ts removes the ROW first and tolerates a failed
    # blob delete (logging an orphan), so the dangerous direction is a blob
    # deleted while its row survives. This is the cheap insurance against it.
    delete_retention_policy {
      days = 7
    }

    cors_rule {
      allowed_origins = var.kanninja_upload_origins
      allowed_methods = ["GET", "HEAD", "PUT", "OPTIONS"]
      allowed_headers = ["content-type", "x-ms-blob-type"]
      # `etag` is what a client uses to detect a changed blob; `x-ms-request-id`
      # is what correlates a failed upload in the browser with the request on
      # Azure's side. `*` would satisfy the provider too and expose every
      # response header to script for no reason.
      exposed_headers    = ["etag", "x-ms-request-id"]
      max_age_in_seconds = 3600
    }
  }
}

resource "azurerm_storage_container" "kanninja_attachments" {
  count = local.kanninja_count
  # Matches env.AZURE_STORAGE_CONTAINER's default in backend/src/config/env.ts.
  # Renaming it here without setting that variable orphans every existing
  # attachment path, which are stored relative to the container root.
  name                  = "card-attachments"
  storage_account_id    = azurerm_storage_account.kanninja[0].id
  container_access_type = "private"
}

# ---------------------------------------------------------------------------
# Generated credentials
# ---------------------------------------------------------------------------

# The server admin. kanNINJA owns its own server, so this is the credential its
# migrations run as — no cross-tenant Job, no borrowed `sparx_owner`.
resource "random_password" "kanninja_owner" {
  count   = local.kanninja_count
  length  = 32
  special = true
  # Azure rejects some punctuation in an admin password outright. This set
  # additionally survives a connection string, a psql `-v` substitution and a
  # dotenv line without all three having to agree about escaping.
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# The RESTRICTED role the application connects as, created by kanNINJA's own
# release from the admin URL.
#
# WHAT THIS BUYS HERE, honestly stated: kanNINJA enforces authorization in
# Fastify middleware and has NO row-level security — `0009_enable_rls.sql` was
# dropped in the re-baseline precisely because it enabled RLS with zero
# policies. So this role is not a tenancy boundary the way jotDOJO's is. It is
# narrower and still worth having: the application cannot execute DDL, so a SQL
# injection or a mistaken migration path cannot drop or alter a table. Defence
# in depth, not an access-control mechanism — do not let a future reader mistake
# it for one.
resource "random_password" "kanninja_app" {
  count            = local.kanninja_count
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
resource "random_password" "kanninja_auth_secret" {
  count   = local.kanninja_count
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
# sslmode=require: Flexible Server enforces TLS and the `postgres` driver will
# not negotiate it implicitly.
# ---------------------------------------------------------------------------
locals {
  kanninja_server = var.kanninja_enabled ? azurerm_postgresql_flexible_server.kanninja[0].fqdn : ""

  kanninja_secrets = var.kanninja_enabled ? {
    "DATABASE-URL" = {
      value = "postgresql://kanninja_app:${urlencode(random_password.kanninja_app[0].result)}@${local.kanninja_server}:5432/kanninja?sslmode=require"
      type  = "connection-string; the APPLICATION role. Rotate by tainting random_password.kanninja_app"
    }
    "DATABASE-ADMIN-URL" = {
      value = "postgresql://kanninja_owner:${urlencode(random_password.kanninja_owner[0].result)}@${local.kanninja_server}:5432/kanninja?sslmode=require"
      type  = "connection-string; migrations and role creation ONLY, never the running app"
    }
    "KANNINJA-APP-PASSWORD" = {
      value = random_password.kanninja_app[0].result
      type  = "password; the db-role Job sets this on kanninja_app. Must match DATABASE-URL"
    }
    "BETTER-AUTH-SECRET" = {
      value = random_password.kanninja_auth_secret[0].result
      type  = "key material; ROTATING THIS SIGNS EVERY USER OUT"
    }
    "AZURE-STORAGE-ACCOUNT" = {
      value = azurerm_storage_account.kanninja[0].name
      type  = "account name; not secret, carried here so one lookup finds everything"
    }
    "AZURE-STORAGE-KEY" = {
      value = azurerm_storage_account.kanninja[0].primary_access_key
      type  = "storage key; regenerating it in the portal makes this value stale"
    }
  } : {}
}

resource "azurerm_key_vault_secret" "kanninja" {
  for_each = local.kanninja_secrets

  name         = each.key
  value        = each.value.value
  key_vault_id = azurerm_key_vault.kanninja[0].id
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

output "kanninja_key_vault_name" {
  description = "Vault holding kanNINJA's secrets. Set as AZURE_KEY_VAULT_NAME on the kanninja repo."
  value       = var.kanninja_enabled ? azurerm_key_vault.kanninja[0].name : null
}

output "kanninja_postgres_fqdn" {
  description = "Private FQDN of kanNINJA's Postgres server. Resolvable only from inside the VNet."
  value       = var.kanninja_enabled ? azurerm_postgresql_flexible_server.kanninja[0].fqdn : null
}

output "kanninja_storage_account" {
  description = "Blob account backing card attachments."
  value       = var.kanninja_enabled ? azurerm_storage_account.kanninja[0].name : null
}

output "kanninja_owner_password" {
  description = <<-EOT
    Server admin password. Needed only to reach the database by hand in an
    incident — the release reads DATABASE-ADMIN-URL from the vault instead, and
    nothing in normal operation wants this value.
  EOT
  value       = var.kanninja_enabled ? random_password.kanninja_owner[0].result : null
  sensitive   = true
}
