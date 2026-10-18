# ---------------------------------------------------------------------------
# WizeLens — a SEVENTH product on this subscription, given its own database
# server like kanNINJA and RocketEase.
#
# Shared with the others: the resource group, the VNet, the private DNS zone,
# the AKS cluster, the Caddy ingress and its public IP. Owned by WizeLens: this
# Postgres server, its generated secrets, and the Key Vault, which is created in
# terraform/bootstrap-azure/wizelens.tf (the header there explains why the vault
# is there and not here) and only READ here.
#
# WHY ITS OWN SERVER: the reasoning at the top of rocketease.tf, unchanged. On a
# shared server the migration credential would be `sparx_owner`.
#
# WHAT IS DELIBERATELY ABSENT, versus rocketease.tf:
#
#   azure.extensions   WizeLens Cloud's migrations contain no CREATE EXTENSION,
#                      checked 2026-10-17 against js/packages/cloud/src/db and
#                      src/auth in the WizeLens repo, Better Auth tables included.
#   storage account    None for the app: the marketing site is static files in
#                      its own image. ClickHouse BACKUPS have one, in
#                      wizelens-clickhouse.tf (added 2026-10-18).
#   Azure OpenAI       WizeLens gives the customer's own AI agent scoped read
#                      access; the service itself calls no model (checked
#                      2026-10-17: no model client in js/packages/cloud).
#
# MIGRATIONS RUN AT BOOT, NOT IN A JOB, and that shapes the app role below. The
# cloud is also a self-hosted product (`docker compose up`), so it migrates
# itself when it starts. The role it connects as therefore needs CREATE on the
# `public` schema of ITS OWN database — and nothing on any other.
# ---------------------------------------------------------------------------

variable "wizelens_enabled" {
  description = <<-EOT
    Master switch for this file. Independent of the switch of the same name in
    terraform/bootstrap-azure, which must be applied FIRST: the vault this file
    writes into is created there.
  EOT
  type        = bool
  default     = true
}

variable "wizelens_key_vault_name" {
  description = "The vault terraform/bootstrap-azure/wizelens.tf creates. Keep the two in step."
  type        = string
  default     = "kv-wizelens-prod-cus"
}

locals {
  wizelens_count = var.wizelens_enabled ? 1 : 0
}

data "azurerm_key_vault" "wizelens" {
  count               = local.wizelens_count
  name                = var.wizelens_key_vault_name
  resource_group_name = azurerm_resource_group.main.name
}

# ---------------------------------------------------------------------------
# Network. 10.20.16.80/28 is the next free block. The allocation so far:
#
#   10.20.16.0/28   snet-psql              sparx
#   10.20.16.16/28  snet-psql-jotacular    jotacular
#   10.20.16.32/28  snet-psql-kanninja     kanNINJA
#   10.20.16.48/28  snet-psql-agconn       AGCONN (in config, absent in Azure
#                                          on 2026-10-17 — still reserved)
#   10.20.16.64/28  snet-psql-rocketease   RocketEase
#   10.20.16.80/28  snet-psql-wizelens     THIS
#
# The next product takes 10.20.16.96/28.
# ---------------------------------------------------------------------------
resource "azurerm_subnet" "wizelens_postgres" {
  count                = local.wizelens_count
  name                 = "snet-psql-wizelens"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.20.16.80/28"]

  # Azure adds this itself for backups; undeclared, the next plan removes it.
  service_endpoints = ["Microsoft.Storage"]

  delegation {
    name = "fs"
    service_delegation {
      name    = "Microsoft.DBforPostgreSQL/flexibleServers"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

# ---------------------------------------------------------------------------
# Postgres 18, VNet-private. Reachable only from inside the cluster.
# ---------------------------------------------------------------------------
resource "azurerm_postgresql_flexible_server" "wizelens" {
  count               = local.wizelens_count
  name                = "psql-wizelens-${var.environment}-${local.loc}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  version    = var.postgres_version
  sku_name   = var.postgres_sku
  storage_mb = var.postgres_storage_mb

  administrator_login    = "wizelens_owner"
  administrator_password = random_password.wizelens_owner[0].result

  delegated_subnet_id           = azurerm_subnet.wizelens_postgres[0].id
  private_dns_zone_id           = azurerm_private_dns_zone.postgres.id
  public_network_access_enabled = false

  # 7 days is the free minimum; point-in-time restore is why this is managed.
  backup_retention_days        = 7
  geo_redundant_backup_enabled = false

  # No HA, for the reason every server here gives: the cluster has no SLA.
  zone = "1"

  tags = merge(local.tags, { workload = "wizelens" })

  depends_on = [azurerm_private_dns_zone_virtual_network_link.postgres]

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_postgresql_flexible_server_database" "wizelens" {
  count     = local.wizelens_count
  name      = "wizelens"
  server_id = azurerm_postgresql_flexible_server.wizelens[0].id
  collation = "en_US.utf8"
  charset   = "utf8"

  lifecycle {
    prevent_destroy = true
  }
}

# ---------------------------------------------------------------------------
# Generated credentials. Same character set as rocketease.tf: it survives a
# connection string, a psql `-v` substitution and a dotenv line.
# ---------------------------------------------------------------------------
resource "random_password" "wizelens_owner" {
  count            = local.wizelens_count
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# `wizelens_app`, created by the WizeLens deploy (its db-role Job). It owns what
# it migrates in `wizelens` and can reach no other database on any server.
resource "random_password" "wizelens_app" {
  count            = local.wizelens_count
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# The first account's one-time token. Generated here so it can be read with
# `az keyvault secret show` instead of fished out of a pod log. It only matters
# while the cloud has no accounts, so regenerating it is harmless.
resource "random_password" "wizelens_setup_token" {
  count   = local.wizelens_count
  length  = 32
  special = false
}

# The auth secret: signs sessions AND encrypts every stored 2FA secret.
# Alphanumeric for the reason rocketease_auth_secret gives (no byte a dotenv
# parser can trim). Written to the vault ONCE — see wizelens_auth_secret below.
resource "random_password" "wizelens_auth_secret" {
  count   = local.wizelens_count
  length  = 64
  special = false
}

# ---------------------------------------------------------------------------
# Vault contents. UPPERCASE-KEBAB, because a vault name cannot hold `_`; the
# deploy maps `-` back to `_`.
# ---------------------------------------------------------------------------
locals {
  wizelens_server = var.wizelens_enabled ? azurerm_postgresql_flexible_server.wizelens[0].fqdn : ""

  # TWO SSL MODES, on purpose. The app's driver (node-postgres 8) treats
  # `require` as `verify-full` today and warns that pg 9 will weaken it to plain
  # libpq `require` (encrypted, server certificate unchecked). Asking for
  # verify-full by name keeps the check through that upgrade; Azure's server
  # certificate chains to a public root Node already trusts, verified with a
  # live `select 1` from the cloud pod on 2026-10-18.
  #
  # The ADMIN URL stays `require`: only psql in the db-role Job reads it, and
  # libpq's verify-full needs a root certificate file that image does not carry.
  wizelens_secrets = var.wizelens_enabled ? {
    "DATABASE-URL" = {
      value = "postgresql://wizelens_app:${urlencode(random_password.wizelens_app[0].result)}@${local.wizelens_server}:5432/wizelens?sslmode=verify-full"
      type  = "connection-string; the APPLICATION role. Rotate by tainting random_password.wizelens_app"
    }
    "DATABASE-ADMIN-URL" = {
      value = "postgresql://wizelens_owner:${urlencode(random_password.wizelens_owner[0].result)}@${local.wizelens_server}:5432/wizelens?sslmode=require"
      type  = "connection-string; the db-role Job ONLY, never the running app"
    }
    "WIZELENS-APP-PASSWORD" = {
      value = random_password.wizelens_app[0].result
      type  = "password; the db-role Job sets this on wizelens_app. Must match DATABASE-URL"
    }
    "WIZELENS-CLOUD-SETUP-TOKEN" = {
      value = random_password.wizelens_setup_token[0].result
      type  = "first-account token; used only while the cloud has no accounts"
    }
  } : {}
}

resource "azurerm_key_vault_secret" "wizelens" {
  for_each = local.wizelens_secrets

  name         = each.key
  value        = each.value.value
  key_vault_id = data.azurerm_key_vault.wizelens[0].id
  content_type = each.value.type
  tags         = local.tags

  lifecycle {
    # Versioned, so a rewrite is safe; a destroy soft-deletes the NAME.
    prevent_destroy = true
  }
}

# ---------------------------------------------------------------------------
# WIZELENS-CLOUD-AUTH-SECRET — generated here, but WRITTEN ONCE AND NEVER AGAIN.
#
# This is the TOKEN-MASTER-KEY problem from rocketease.tf, solved differently.
# RocketEase keeps its key out of Terraform because a random_password is
# regenerated by a taint, a `-replace` or a provider change, and a swapped key
# silently breaks everything encrypted under it — here, every 2FA login.
#
# Rather than a hand-run `az keyvault secret set`, two locks make the first
# value permanent:
#
#   ignore_changes = [value]   a regenerated random_password never reaches the
#                              vault, and a rotation set by hand (`2:new,1:old`,
#                              the cloud's own format) is never reverted
#   prevent_destroy            no apply can delete or replace the secret, so
#                              its first version is the one that stays
#
# Its own resource, not an entry in azurerm_key_vault_secret.wizelens, because
# ignore_changes cannot differ per for_each key.
# ---------------------------------------------------------------------------
resource "azurerm_key_vault_secret" "wizelens_auth_secret" {
  count        = local.wizelens_count
  name         = "WIZELENS-CLOUD-AUTH-SECRET"
  value        = random_password.wizelens_auth_secret[0].result
  key_vault_id = data.azurerm_key_vault.wizelens[0].id
  content_type = "key material; signs sessions and encrypts 2FA secrets. Rotate as 2:new,1:old, never replace"
  tags         = local.tags

  lifecycle {
    ignore_changes  = [value]
    prevent_destroy = true
  }
}

output "wizelens_postgres_fqdn" {
  description = "Private FQDN of WizeLens's Postgres server. Resolvable only from inside the VNet."
  value       = var.wizelens_enabled ? azurerm_postgresql_flexible_server.wizelens[0].fqdn : null
}

output "wizelens_owner_password" {
  description = "Server admin password, for incidents only. The deploy reads DATABASE-ADMIN-URL from the vault."
  value       = var.wizelens_enabled ? random_password.wizelens_owner[0].result : null
  sensitive   = true
}
