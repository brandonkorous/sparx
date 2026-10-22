# ---------------------------------------------------------------------------
# WizeWorks — the Key Vault for the parent company's marketing site (wize.works).
#
# The site had no secrets, so it had no vault (see bootstrap-azure/wizeworks.tf).
# It now has one: the WizeLens ingest key the site sends its traces with. More
# will follow (contact delivery needs CONTACT_TO and a provider credential).
#
# Its own vault rather than a secret in sparx's: a vault is the smallest scope
# Key Vault RBAC can grant, and a shared vault would let this pipeline read every
# sparx credential.
#
# ORDER, because the two halves live in different states:
#   1. this file          applied by the sparx release (on merge to main).
#   2. bootstrap-azure    applied by hand; it looks this vault up and grants the
#                         pipeline `Key Vault Secrets User` and the operator
#                         `Key Vault Secrets Officer`. Before step 1 it fails.
#
# NAMES ARE LOWERCASE-KEBAB here. The wizeworks pipeline reads one name verbatim:
# `wizelens-key-wizeworks-site`.
# ---------------------------------------------------------------------------

variable "wizeworks_enabled" {
  description = <<-EOT
    Master switch for the WizeWorks Key Vault. Independent of the switch of the
    same name in terraform/bootstrap-azure, which governs the CI identity.
    Standard tier has no base fee; operations are $0.03 per 10,000.
  EOT
  type        = bool
  default     = true
}

variable "wizeworks_key_vault_name" {
  description = "Globally unique (a DNS label), 3-24 characters. Keep in step with the variable of the same name in terraform/bootstrap-azure."
  type        = string
  default     = "kv-wizeworks-prod-cus"

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9-]{1,22}[a-zA-Z0-9]$", var.wizeworks_key_vault_name))
    error_message = "Key Vault names are 3-24 chars, start with a letter, end alphanumeric, and allow only letters, digits and hyphens."
  }
}

resource "azurerm_key_vault" "wizeworks" {
  count               = var.wizeworks_enabled ? 1 : 0
  name                = var.wizeworks_key_vault_name
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = "standard"
  tags                = local.tags

  # RBAC, matching every other vault here.
  rbac_authorization_enabled = true

  soft_delete_retention_days = 7

  # False for the same reason as AGCONN's: purge protection is one-way, and a
  # torn-down vault keeps its name reserved for the whole retention window.
  # Everything in it today is regenerable from the WizeLens dashboard.
  purge_protection_enabled = false

  lifecycle {
    prevent_destroy = true
  }
}

output "wizeworks_key_vault_name" {
  description = "Vault holding the WizeWorks site's secrets. Set as AZURE_KEY_VAULT_NAME on the wizeworks repo."
  value       = var.wizeworks_enabled ? azurerm_key_vault.wizeworks[0].name : null
}
