output "resource_group" {
  description = "Resource group holding everything in this environment."
  value       = azurerm_resource_group.main.name
}

output "aks_name" {
  description = "Cluster name. Get credentials with the `kubeconfig_command` output."
  value       = azurerm_kubernetes_cluster.main.name
}

output "kubeconfig_command" {
  description = "Run this to point kubectl at the new cluster."
  value       = "az aks get-credentials --resource-group ${azurerm_resource_group.main.name} --name ${azurerm_kubernetes_cluster.main.name}"
}

output "postgres_fqdn" {
  description = "Private FQDN of the Postgres server. Only resolvable from inside the VNet."
  value       = azurerm_postgresql_flexible_server.main.fqdn
}

# The two connection strings the k8s Secret needs.
#
# `sparx_owner` is the Azure admin login, used for migrations and the hand-edited
# RLS SQL. `sparx_app` does NOT exist yet — it is created by
# packages/db/docker/init/01-roles.sql, which Azure will never run for us (that
# script is a Docker-image entrypoint convention, not a Postgres feature). It has
# to be applied once by hand against this server before the apps can connect.
# See README.md in this directory.
#
# sslmode=require: Flexible Server enforces TLS, and Prisma will not negotiate it
# implicitly.
output "database_url_owner" {
  description = "AUTH_DATABASE_URL — owner role, used by migrations and api-mcp token introspection."
  value       = "postgresql://sparx_owner:${urlencode(random_password.postgres_admin.result)}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/sparx?sslmode=require"
  sensitive   = true
}

output "postgres_admin_password" {
  description = "Generated admin password. Needed to create the sparx_app role by hand the first time."
  value       = random_password.postgres_admin.result
  sensitive   = true
}

output "ingress_ip" {
  description = <<-EOT
    The reserved public IP every platform hostname resolves to. Pin the Caddy
    Service to it with the azure-pip-name annotation (see k8s/azure) — an
    unpinned Service takes an ephemeral address instead and DNS goes stale the
    next time it is recreated.
  EOT
  value       = azurerm_public_ip.ingress.ip_address
}

output "ingress_pip_name" {
  description = "Name for the k8s Service's service.beta.kubernetes.io/azure-pip-name annotation."
  value       = azurerm_public_ip.ingress.name
}
