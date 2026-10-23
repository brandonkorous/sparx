# ---------------------------------------------------------------------------
# The identity the RELEASE applies this bootstrap with.
#
# Before this file the bootstrap was applied from a laptop, with its state on
# that laptop: every grant in it was a memory someone had to act on, and every
# merge that touched it drifted until they did. Now the release's `bootstrap`
# job applies it on every commit to main, against remote state, under this
# identity. The laptop is only for the FIRST apply in a new subscription (see
# README.md), because nothing can grant this identity its own rights.
#
# WHAT IT CAN DO, and every right is the least that does the job:
#
#   Contributor (subscription)   the resource groups, the state account, vaults.
#   Blob Data Contributor        read and write ITS OWN state (tfstate account).
#   RBAC Administrator           grant ONLY the roles in local.bootstrap_roles,
#     with a condition           and remove only those. It cannot grant Owner,
#                                User Access Administrator, or RBAC Administrator,
#                                so it cannot raise its own rights.
#   Graph Application.ReadWrite.OwnedBy   create app registrations and change the
#                                ones it owns (it is an owner of every one here).
#   Graph Application.Read.All   read the apps and service principals it plans.
#
# WHAT IT CANNOT DO: change its own Graph permissions. A change to the Graph
# grants below needs a person with Privileged Role Administrator to apply; the
# release fails loudly with a 403 if it tries.
#
# ONLY the `bootstrap` GitHub Environment can assume it, and that environment is
# limited to main (the setup commands in outputs.tf). Pull requests cannot.
# ---------------------------------------------------------------------------

locals {
  # Every role any file in this module grants. Add a role here when a file
  # starts granting a new one, or the release's apply fails with a 403.
  bootstrap_roles = [
    "Azure Kubernetes Service Cluster User Role",
    "Azure Kubernetes Service RBAC Cluster Admin",
    "Contributor",
    "Key Vault Secrets Officer",
    "Key Vault Secrets User",
    "Storage Blob Data Contributor",
  ]

  bootstrap_role_guids = join(", ", [for r in data.azurerm_role_definition.bootstrap : basename(r.role_definition_id)])

  bootstrap_graph_roles = ["Application.ReadWrite.OwnedBy", "Application.Read.All"]
}

data "azurerm_role_definition" "bootstrap" {
  for_each = toset(local.bootstrap_roles)
  name     = each.value
  scope    = "/subscriptions/${var.subscription_id}"
}

resource "azuread_application" "bootstrap" {
  display_name = "gha-${local.suffix}-bootstrap"
  owners       = [var.operator_object_id]
}

resource "azuread_service_principal" "bootstrap" {
  client_id = azuread_application.bootstrap.client_id
  owners    = [var.operator_object_id]
}

resource "azuread_application_federated_identity_credential" "bootstrap" {
  application_id = azuread_application.bootstrap.id
  display_name   = "gh-env-bootstrap"
  description    = "The release's bootstrap job on ${local.repo} (GitHub Environment `bootstrap`, main only)."
  audiences      = ["api://AzureADTokenExchange"]
  issuer         = "https://token.actions.githubusercontent.com"
  subject        = "repo:${local.repo}:environment:bootstrap"
}

resource "azurerm_role_assignment" "bootstrap_contributor" {
  scope                = "/subscriptions/${var.subscription_id}"
  role_definition_name = "Contributor"
  principal_id         = azuread_service_principal.bootstrap.object_id
}

resource "azurerm_role_assignment" "bootstrap_blob" {
  scope                = azurerm_storage_account.tfstate.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azuread_service_principal.bootstrap.object_id
}

# The condition is Azure's own constrained-delegation form: a write must name a
# listed role, and a delete must remove one.
resource "azurerm_role_assignment" "bootstrap_rbac_admin" {
  scope                = "/subscriptions/${var.subscription_id}"
  role_definition_name = "Role Based Access Control Administrator"
  principal_id         = azuread_service_principal.bootstrap.object_id
  condition_version    = "2.0"
  condition            = <<-EOT
    (
     (
      !(ActionMatches{'Microsoft.Authorization/roleAssignments/write'})
     )
     OR
     (
      @Request[Microsoft.Authorization/roleAssignments:RoleDefinitionId] ForAnyOfAnyValues:GuidEquals {${local.bootstrap_role_guids}}
     )
    )
    AND
    (
     (
      !(ActionMatches{'Microsoft.Authorization/roleAssignments/delete'})
     )
     OR
     (
      @Resource[Microsoft.Authorization/roleAssignments:RoleDefinitionId] ForAnyOfAnyValues:GuidEquals {${local.bootstrap_role_guids}}
     )
    )
  EOT
}

data "azuread_application_published_app_ids" "well_known" {}

data "azuread_service_principal" "msgraph" {
  client_id = data.azuread_application_published_app_ids.well_known.result["MicrosoftGraph"]
}

resource "azuread_app_role_assignment" "bootstrap_graph" {
  for_each            = toset(local.bootstrap_graph_roles)
  app_role_id         = data.azuread_service_principal.msgraph.app_role_ids[each.value]
  principal_object_id = azuread_service_principal.bootstrap.object_id
  resource_object_id  = data.azuread_service_principal.msgraph.object_id
}
