# ---------------------------------------------------------------------------
# WizeLens telemetry store: ClickHouse, self-hosted in the cluster (namespace
# `wizelens`, manifests in the WizeLens repo, deploy/k8s/base/clickhouse.yaml).
#
# Decided 2026-10-18: spans, logs, metrics and their stats move out of the
# WizeLens Postgres server into ClickHouse, so searches over large data never
# slow sign-in, keys or alerts. Postgres keeps accounts and settings.
#
# What lives HERE: the ClickHouse password and a storage account for its
# backups. The StatefulSet, its NetworkPolicy and the nightly BACKUP CronJob
# are workloads, so they ship with the WizeLens deploy.
#
# WHY BACKUPS ARE NEW HERE: unlike Typesense in sparx (a derived index, rebuilt
# from Postgres), ClickHouse holds the only copy of the telemetry. The CronJob
# runs ClickHouse's own `BACKUP DATABASE ... TO AzureBlobStorage(...)`, so no
# extra image or sidecar reads the volume.
# ---------------------------------------------------------------------------

# Alphanumeric: it goes into a URL (http://wizelens:<password>@clickhouse:8123)
# and a dotenv line, and no byte needs escaping in either.
resource "random_password" "wizelens_clickhouse" {
  count   = local.wizelens_count
  length  = 40
  special = false
}

resource "azurerm_storage_account" "wizelens_backups" {
  count = local.wizelens_count

  # 3-24 lowercase alphanumeric, globally unique: "stwizelenschprodcus".
  name                     = "stwizelensch${var.environment}${local.loc}"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  account_kind             = "StorageV2"
  # Written nightly, read only to restore: Cool costs less to keep.
  access_tier = "Cool"
  tags        = merge(local.tags, { workload = "wizelens" })

  # ClickHouse's AzureBlobStorage engine signs with the account key.
  shared_access_key_enabled       = true
  allow_nested_items_to_be_public = false
  https_traffic_only_enabled      = true
  min_tls_version                 = "TLS1_2"

  blob_properties {
    delete_retention_policy {
      days = 7
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_storage_container" "wizelens_clickhouse_backups" {
  count                 = local.wizelens_count
  name                  = "clickhouse-backups"
  storage_account_id    = azurerm_storage_account.wizelens_backups[0].id
  container_access_type = "private"
}

# Nightly full backups, kept two weeks. The CronJob names each one by date.
resource "azurerm_storage_management_policy" "wizelens_backups" {
  count              = local.wizelens_count
  storage_account_id = azurerm_storage_account.wizelens_backups[0].id

  rule {
    name    = "expire-clickhouse-backups"
    enabled = true
    filters {
      blob_types   = ["blockBlob"]
      prefix_match = ["clickhouse-backups/"]
    }
    actions {
      base_blob {
        delete_after_days_since_modification_greater_than = 14
      }
    }
  }
}

locals {
  wizelens_clickhouse_secrets = var.wizelens_enabled ? {
    "WIZELENS-CLICKHOUSE-PASSWORD" = {
      value = random_password.wizelens_clickhouse[0].result
      type  = "password; the ClickHouse user `wizelens`, read by the StatefulSet and the cloud"
    }
    "WIZELENS-BACKUP-BLOB-CONNECTION" = {
      value = azurerm_storage_account.wizelens_backups[0].primary_connection_string
      type  = "connection-string; the nightly ClickHouse BACKUP only. Regenerating the key in the portal makes it stale"
    }
  } : {}
}

resource "azurerm_key_vault_secret" "wizelens_clickhouse" {
  for_each = local.wizelens_clickhouse_secrets

  name         = each.key
  value        = each.value.value
  key_vault_id = data.azurerm_key_vault.wizelens[0].id
  content_type = each.value.type
  tags         = local.tags

  lifecycle {
    prevent_destroy = true
  }
}
