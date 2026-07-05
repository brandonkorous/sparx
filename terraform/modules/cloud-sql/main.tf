resource "random_id" "instance_suffix" {
  byte_length = 3
}

resource "google_sql_database_instance" "primary" {
  name             = "${var.name_prefix}-pg-${random_id.instance_suffix.hex}"
  database_version = "POSTGRES_18"
  region           = var.region

  settings {
    tier              = var.tier
    edition           = var.edition
    availability_type = var.availability_type
    disk_size         = var.disk_size_gb
    disk_type         = "PD_SSD"
    disk_autoresize   = true

    database_flags {
      name  = "cloudsql.iam_authentication"
      value = "on"
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = var.network_id
    }

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7
      backup_retention_settings {
        retained_backups = 7
        retention_unit   = "COUNT"
      }
    }

    insights_config {
      query_insights_enabled  = true
      record_application_tags = true
      record_client_address   = false
    }

    maintenance_window {
      day          = 2 # Tuesday
      hour         = 2 # 02:00 UTC — matches the maintenance window in docs/20
      update_track = "stable"
    }

    deletion_protection_enabled = var.deletion_protection
  }

  deletion_protection = var.deletion_protection
}

resource "google_sql_database" "sparx" {
  name     = "sparx"
  instance = google_sql_database_instance.primary.name
}

resource "random_password" "app_user" {
  length      = 32
  special     = false
  min_lower   = 4
  min_upper   = 4
  min_numeric = 4
}

resource "google_sql_user" "app" {
  name     = "sparx_app"
  instance = google_sql_database_instance.primary.name
  password = random_password.app_user.result
}

# WizeWorks operator role (docs/apps/admin/build-plan.md §2 D3/D6). Used ONLY by
# the admin console's Better Auth instance + its wize_admin schema helpers, never
# by tenant app code. NOBYPASSRLS (same posture as sparx_app) so it can never read
# a tenant table even if one were granted by mistake — enforced at the schema-grant
# layer in the 20261007000000_wize_admin_operator_schema migration, which also
# CREATEs the wize_admin schema + tables and GRANTs them to this role.
#
# Provisioning order: this user must exist BEFORE that migration runs (the
# migration's grants target it). `terraform apply` this ahead of the migration
# pipeline; the migration's guarded CREATE ROLE is only a local-dev fallback.
resource "random_password" "operator_user" {
  length      = 32
  special     = false
  min_lower   = 4
  min_upper   = 4
  min_numeric = 4
}

resource "google_sql_user" "operator" {
  name     = "wize_operator"
  instance = google_sql_database_instance.primary.name
  password = random_password.operator_user.result
}
