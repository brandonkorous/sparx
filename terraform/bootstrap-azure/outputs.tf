# Everything below is non-sensitive. OIDC means there is no client secret, so
# these can be pasted into GitHub as repository VARIABLES rather than secrets —
# though secrets work too if you prefer them hidden from forks.

output "github_secrets" {
  description = "Set these on the repository, then the workflows authenticate with no stored credential."
  value = {
    AZURE_CLIENT_ID       = azuread_application.gha.client_id
    AZURE_TENANT_ID       = data.azurerm_client_config.current.tenant_id
    AZURE_SUBSCRIPTION_ID = var.subscription_id
  }
}

output "gh_cli_commands" {
  description = "Copy-paste to set the repository variables with the GitHub CLI."
  value = join("\n", [
    "gh variable set AZURE_CLIENT_ID       -R ${var.github_owner}/${var.github_repository} -b '${azuread_application.gha.client_id}'",
    "gh variable set AZURE_TENANT_ID       -R ${var.github_owner}/${var.github_repository} -b '${data.azurerm_client_config.current.tenant_id}'",
    "gh variable set AZURE_SUBSCRIPTION_ID -R ${var.github_owner}/${var.github_repository} -b '${var.subscription_id}'",
  ])
}

# The values terraform/envs/azure needs in its `backend "azurerm"` block.
output "backend_config" {
  description = "Remote state backend settings for terraform/envs/azure."
  value = {
    resource_group_name  = azurerm_resource_group.tfstate.name
    storage_account_name = azurerm_storage_account.tfstate.name
    container_name       = azurerm_storage_container.tfstate.name
    key                  = "envs/azure.tfstate"
  }
}

output "service_principal_object_id" {
  description = "Object id of the Actions identity — needed to grant it anything beyond the roles this module already assigns."
  value       = azuread_service_principal.gha.object_id
}
