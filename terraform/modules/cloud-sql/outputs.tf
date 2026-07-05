output "instance_name" {
  value = google_sql_database_instance.primary.name
}

output "connection_name" {
  value       = google_sql_database_instance.primary.connection_name
  description = "Pass to Cloud SQL Auth Proxy as -instances."
}

output "private_ip" {
  value = google_sql_database_instance.primary.private_ip_address
}

output "database_name" {
  value = google_sql_database.sparx.name
}

output "app_user" {
  value = google_sql_user.app.name
}

output "app_password" {
  value     = random_password.app_user.result
  sensitive = true
}

output "operator_user" {
  value = google_sql_user.operator.name
}

# The wize_operator password — assemble OPERATOR_DATABASE_URL out-of-band from
# this + the private IP (see the operator-database-url secret comment in
# envs/prod/main.tf). Read with: terraform output -raw cloud_sql_operator_password.
output "operator_password" {
  value     = random_password.operator_user.result
  sensitive = true
}
