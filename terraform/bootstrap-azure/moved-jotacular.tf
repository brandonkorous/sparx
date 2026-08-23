# jotDOJO became jotacular. The same state moves as
# terraform/envs/azure/moved-jotacular.tf, for the CI identity.
#
# What a destroy-and-recreate costs here is a different currency: an
# `azuread_application` carries a CLIENT ID, and a new one is a new id. Every
# `AZURE_CLIENT_ID` secret in jotacular's repository would stop working, its
# federated credentials would be gone, and the fix would be a manual round-trip
# through two repositories to re-issue something that never needed to change.
#
# The application's DISPLAY NAME does move to `gha-jotacular-prod` — that is an
# attribute, updated in place, and it is the string a human reads in the portal.
#
# No block for `data.azurerm_key_vault` — a data source is re-read on every plan
# rather than tracked, so renaming its label costs nothing. Its `name` still
# points at `kv-jotdojo-prod-cus`, which is the vault that actually exists.
#
# Safe to delete once applied; no cost to leaving them.

moved {
  from = azuread_application.jotdojo_gha
  to   = azuread_application.jotacular_gha
}

moved {
  from = azuread_service_principal.jotdojo_gha
  to   = azuread_service_principal.jotacular_gha
}

moved {
  from = azuread_application_federated_identity_credential.jotdojo_branch
  to   = azuread_application_federated_identity_credential.jotacular_branch
}

moved {
  from = azuread_application_federated_identity_credential.jotdojo_environment
  to   = azuread_application_federated_identity_credential.jotacular_environment
}

moved {
  from = azurerm_role_assignment.jotdojo_gha_kv
  to   = azurerm_role_assignment.jotacular_gha_kv
}

moved {
  from = azurerm_role_assignment.jotdojo_gha_aks
  to   = azurerm_role_assignment.jotacular_gha_aks
}

moved {
  from = azurerm_role_assignment.jotdojo_operator_kv
  to   = azurerm_role_assignment.jotacular_operator_kv
}

moved {
  from = azurerm_role_assignment.jotdojo_sparx_release_kv
  to   = azurerm_role_assignment.jotacular_sparx_release_kv
}
