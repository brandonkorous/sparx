# ---------------------------------------------------------------------------
# WizeLens's CI identity AND its Key Vault.
#
# The identity is here for the reason every product's is: an app registration is
# a tenant-wide directory object, and only a human holds the Microsoft Graph
# rights to create one. See the header of kanninja.tf.
#
# THE VAULT IS HERE TOO, which kanNINJA and RocketEase do not do, and that is
# about ORDER. Their vaults live in terraform/envs/azure and are data sources
# here, which makes the first rollout three steps: the release creates the vault
# and then 403s writing its own secrets, a human applies this file to grant the
# release write access, and the release runs again. Creating the vault here —
# exactly as main.tf does for sparx's own vault, for the same reason — makes it
# two steps with no red release in between:
#
#   1. a human applies this file (vault + identity + every role on the vault)
#   2. the sparx release applies terraform/envs/azure/wizelens.tf, which reads
#      the vault as a data source and writes the generated secrets into it
#
# Applying them in the other order fails cleanly at plan time with
# "Key Vault not found" from envs/azure, which is the signal to do step 1.
# ---------------------------------------------------------------------------

variable "wizelens_enabled" {
  description = <<-EOT
    Master switch. Off leaves WizeLens with no vault and its repository with no
    Azure identity. Independent of the switch of the same name in
    terraform/envs/azure: separate states, applied by different principals.
  EOT
  type        = bool
  default     = true
}

variable "wizelens_github_repository" {
  description = <<-EOT
    `owner/repo` whose Actions runs may assume WizeLens's Azure identity.
    Verified 2026-10-17 with `gh api repos/brandonkorous/wizelens`: private,
    default branch `main`.
  EOT
  type        = string
  default     = "brandonkorous/wizelens"
}

variable "wizelens_github_subject_prefix" {
  description = <<-EOT
    The literal prefix of the OIDC `sub` claim GitHub mints for this repository.

    THE NUMERICALLY-QUALIFIED FORM, read back on 2026-10-17 rather than built by
    hand (see the long note on kanninja_github_subject_prefix for why the two
    forms exist and what a mismatch looks like):

        gh api repos/brandonkorous/wizelens/actions/oidc/customization/sub \
          --jq .sub_claim_prefix

    If WizeLens ever fails with AADSTS700213, re-run that first.
  EOT
  type        = string
  default     = "repo:brandonkorous@13042540/wizelens@1421677864"

  validation {
    condition     = startswith(var.wizelens_github_subject_prefix, "repo:") && !endswith(var.wizelens_github_subject_prefix, ":")
    error_message = "Paste sub_claim_prefix verbatim: it starts with `repo:` and has no trailing colon."
  }
}

variable "wizelens_key_vault_name" {
  description = <<-EOT
    GLOBALLY unique (a DNS label), 3-24 characters. Checked available with
    Microsoft.KeyVault/checkNameAvailability on 2026-10-17. Keep in step with
    the variable of the same name in terraform/envs/azure/wizelens.tf.
  EOT
  type        = string
  default     = "kv-wizelens-prod-cus"
}

locals {
  wizelens_count = var.wizelens_enabled ? 1 : 0
  wizelens_repo  = var.wizelens_github_repository
}

# ---------------------------------------------------------------------------
# The vault, in the WORKLOAD resource group beside every other product's.
#
# Its own vault rather than a share of sparx's: a vault is the smallest scope
# Key Vault RBAC can assign, so `Secrets User` on a shared one would let
# WizeLens's pipeline read every other product's credentials.
# ---------------------------------------------------------------------------
resource "azurerm_key_vault" "wizelens" {
  count               = local.wizelens_count
  name                = var.wizelens_key_vault_name
  location            = var.location
  resource_group_name = "rg-${var.workload}-${var.environment}-${local.loc}"
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = "standard"
  tags                = merge(local.tags, { workload = "wizelens", purpose = "secrets" })

  rbac_authorization_enabled = true

  # 90 days, the maximum, and it can never be changed after creation. This vault
  # holds WIZELENS-CLOUD-AUTH-SECRET, which encrypts every stored 2FA secret, so
  # a mistaken delete must stay recoverable for as long as Azure allows.
  soft_delete_retention_days = 90

  # OFF while WizeLens Cloud holds no customer data, exactly like RocketEase: it
  # is one-way, and with it on a mistaken destroy during setup reserves the name
  # for 90 days. Turn it on before the first real customer signs up.
  purge_protection_enabled = false

  lifecycle {
    prevent_destroy = true
  }
}

# ---------------------------------------------------------------------------
# The identity
# ---------------------------------------------------------------------------
resource "azuread_application" "wizelens_gha" {
  count        = local.wizelens_count
  display_name = "gha-wizelens-prod"
  owners       = [data.azurerm_client_config.current.object_id]
}

resource "azuread_service_principal" "wizelens_gha" {
  count     = local.wizelens_count
  client_id = azuread_application.wizelens_gha[0].client_id
  owners    = [data.azurerm_client_config.current.object_id]
}

# Pushes to main: the deploy workflow's own context.
resource "azuread_application_federated_identity_credential" "wizelens_main" {
  count          = local.wizelens_count
  application_id = azuread_application.wizelens_gha[0].id
  display_name   = "github-main"
  description    = "Pushes to main in ${local.wizelens_repo}."
  audiences      = ["api://AzureADTokenExchange"]
  issuer         = "https://token.actions.githubusercontent.com"
  subject        = "${var.wizelens_github_subject_prefix}:ref:refs/heads/main"
}

# Jobs bound to a `prod` GitHub Environment get an environment subject instead,
# so adding a manual approval gate later is a workflow change, not an Azure one.
resource "azuread_application_federated_identity_credential" "wizelens_environment" {
  count          = local.wizelens_count
  application_id = azuread_application.wizelens_gha[0].id
  display_name   = "github-environment-prod"
  description    = "Jobs bound to the `prod` GitHub Environment in ${local.wizelens_repo}."
  audiences      = ["api://AzureADTokenExchange"]
  issuer         = "https://token.actions.githubusercontent.com"
  subject        = "${var.wizelens_github_subject_prefix}:environment:prod"
}

# ---------------------------------------------------------------------------
# Roles. The same asymmetry as every product: WizeLens's pipeline DEPLOYS, so it
# may only READ its vault; sparx's release PROVISIONS, so it may write it.
# ---------------------------------------------------------------------------
resource "azurerm_role_assignment" "wizelens_gha_kv" {
  count                = local.wizelens_count
  scope                = azurerm_key_vault.wizelens[0].id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azuread_service_principal.wizelens_gha[0].object_id
}

# A kubeconfig, not authority inside the cluster. See kanninja_gha_aks.
resource "azurerm_role_assignment" "wizelens_gha_aks" {
  count                = local.wizelens_count
  scope                = "/subscriptions/${var.subscription_id}"
  role_definition_name = "Azure Kubernetes Service Cluster User Role"
  principal_id         = azuread_service_principal.wizelens_gha[0].object_id
}

# The human: loads the secrets Terraform must never own (the auth secret, SMTP).
resource "azurerm_role_assignment" "wizelens_operator_kv" {
  count                = local.wizelens_count
  scope                = azurerm_key_vault.wizelens[0].id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = data.azurerm_client_config.current.object_id
}

# sparx's release, which writes the generated database secrets from
# terraform/envs/azure/wizelens.tf.
resource "azurerm_role_assignment" "wizelens_sparx_release_kv" {
  count                = local.wizelens_count
  scope                = azurerm_key_vault.wizelens[0].id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = azuread_service_principal.gha.object_id
}

# ---------------------------------------------------------------------------
output "wizelens_github_setup" {
  description = "Repository VARIABLES (public identifiers, not secrets) to set on the WizeLens repo so its deploy workflow can authenticate."
  value = var.wizelens_enabled ? [
    "gh variable set AZURE_CLIENT_ID       -R ${local.wizelens_repo} -b '${azuread_application.wizelens_gha[0].client_id}'",
    "gh variable set AZURE_TENANT_ID       -R ${local.wizelens_repo} -b '${data.azurerm_client_config.current.tenant_id}'",
    "gh variable set AZURE_SUBSCRIPTION_ID -R ${local.wizelens_repo} -b '${var.subscription_id}'",
    "gh variable set AZURE_KEY_VAULT_NAME  -R ${local.wizelens_repo} -b '${var.wizelens_key_vault_name}'",
  ] : []
}
