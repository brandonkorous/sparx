# jotDOJO became jotacular. These blocks make that a STATE MOVE rather than a
# destroy-and-recreate.
#
# Terraform tracks a resource by its ADDRESS, not by what it points at. Rename
# the label and Terraform sees the old address gone and a new one appeared, and
# plans exactly that: `azurerm_postgresql_flexible_server_database.jotdojo`
# DESTROYED and `.jotacular` created — an empty database where jotDOJO's rows
# were. The same for the storage account holding everything anyone uploaded, the
# Key Vault holding every credential, and the OpenAI account whose endpoint is
# baked into eleven secrets.
#
# The release's `Refuse a destructive plan` step would have caught all of it, so
# the danger here was never a silent deletion — it was a release that could not
# advance until somebody worked out why a rename wanted to delete a database.
#
# ONE BLOCK PER RESOURCE, NOT PER INSTANCE. Every one of these carries `count` or
# `for_each`, and a `moved` block naming the resource moves all of its instances
# — including the twenty key-vault secrets keyed by name.
#
# The PHYSICAL names are deliberately unchanged; only these addresses moved. See
# the note at the head of jotacular.tf for why, and what it would take to move
# them too.
#
# Safe to delete once applied everywhere; no cost to leaving them.

moved {
  from = azurerm_postgresql_flexible_server_database.jotdojo
  to   = azurerm_postgresql_flexible_server_database.jotacular
}

moved {
  from = azurerm_key_vault.jotdojo
  to   = azurerm_key_vault.jotacular
}

moved {
  from = azurerm_key_vault_secret.jotdojo
  to   = azurerm_key_vault_secret.jotacular
}

moved {
  from = azurerm_storage_account.jotdojo
  to   = azurerm_storage_account.jotacular
}

moved {
  from = azurerm_storage_container.jotdojo
  to   = azurerm_storage_container.jotacular
}

moved {
  from = azurerm_cognitive_account.jotdojo
  to   = azurerm_cognitive_account.jotacular
}

moved {
  from = azurerm_cognitive_deployment.jotdojo
  to   = azurerm_cognitive_deployment.jotacular
}

# The passwords. A destroy-and-recreate here mints NEW ones, which would strand
# every connection string already in jotacular's running pods and its vault.
moved {
  from = random_password.jotdojo_owner
  to   = random_password.jotacular_owner
}

moved {
  from = random_password.jotdojo_app
  to   = random_password.jotacular_app
}

moved {
  from = random_password.jotdojo_auth_secret
  to   = random_password.jotacular_auth_secret
}
