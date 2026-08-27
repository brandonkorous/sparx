# ---------------------------------------------------------------------------
# AGCONN — everything a FOURTH product needs from sparx's Azure footprint.
#
# AGCONN (agconn.com) is a bilingual farmworker platform. It lives in its own
# repository (brandonkorous/AgConnect) and deploys from its own pipeline. Like
# jotacular and kanNINJA it is a tenant of this subscription, not part of sparx.
#
# ONE FILE, deliberately, and it is the removal story. Everything AGCONN owns in
# this subscription is here; deleting it and running `terraform apply` takes the
# whole product's infrastructure with it and touches nothing of sparx's.
#
# WHAT IS DIFFERENT ABOUT THIS TENANT, AND IT IS THE WHOLE SHAPE OF THE FILE:
# AGCONN'S DATA LAYER IS NOT ON AZURE. Postgres and object storage stay on
# Supabase (`aws-1-us-east-2`), by decision on 2026-08-26. AGCONN moves COMPUTE
# only — it takes a namespace on the cluster, a Key Vault for its ~45 secrets,
# and a CI identity, and it keeps talking to Supabase over the public internet.
#
# So this file has two halves and two switches:
#
#   agconn_enabled       the vault. ON. This is what the pipeline needs today.
#   agconn_data_enabled  Postgres + storage. OFF. Written out in full so the
#                        later decision is one variable rather than a design
#                        session, but not provisioned, because a Flexible Server
#                        with no database in it is ~$14/mo of nothing and, per
#                        jotacular's own note, "an empty vault and an idle server
#                        both look configured and are not."
#
# TWO SWITCHES RATHER THAN ONE, because one would force a choice between paying
# for an idle server and having no vault, and AGCONN needs the vault now.
#
# WHAT IS NOT HERE: the workloads. Terraform does not manage workloads in this
# environment (see providers.tf) and must not start to. AGCONN's Deployments,
# Services and namespace are Kustomize YAML in the AGCONN repo under
# `deploy/k8s/`. The only cluster-side change sparx owns is the Caddy routing
# table (k8s/ingress/Caddyfile) plus the TLS allow-list entries in
# wizeworks/services/api-rest/src/routes/internal/domain-check.ts.
#
# ALSO NOT HERE: the CI identity and every role assignment. Those are in
# terraform/bootstrap-azure/agconn.tf, for the reason jotDOJO discovered the
# hard way — this environment is applied by the RELEASE, whose identity holds
# subscription Contributor and nothing more. Contributor cannot grant roles, and
# a directory app registration is tenant-wide rather than subscription-scoped.
# Both fail with a 403 at APPLY time, after a green plan and a green validate.
#
# NOTE ON `data.azurerm_client_config.current`: it is declared once for this
# whole root module, in jotacular.tf. Do not re-declare it here.
# ---------------------------------------------------------------------------

variable "agconn_enabled" {
  description = <<-EOT
    Master switch for AGCONN's Key Vault and, transitively, for whether this
    product exists in this subscription at all.

    ON, because the vault is the thing AGCONN's pipeline reads on every deploy.
    It costs a rounding error: Standard tier has no base fee, secret storage is
    free, and operations are $0.03 per 10,000.

    Independent of the switch of the same name in terraform/bootstrap-azure:
    separate states, applied by different principals at different times, so
    neither can read the other's variables. That one governs the CI identity;
    this one governs what the identity is allowed to reach.
  EOT
  type        = bool
  default     = true
}

variable "agconn_data_enabled" {
  description = <<-EOT
    Master switch for AGCONN's Postgres Flexible Server, its database, its
    Storage Account, and the five secrets derived from them.

    OFF, and off is the CORRECT state, not an unfinished one. AGCONN's data
    lives on Supabase and the decision on 2026-08-26 was to leave it there for
    now. Everything below is written out so that turning it on is one variable
    plus a data migration, rather than starting from a blank file — but nothing
    is provisioned, so nothing is billed and nothing sits empty pretending to be
    configured.

    TURNING IT ON IS NOT SUFFICIENT BY ITSELF. Three things happen in the AGCONN
    repo at the same time, and none of them are here:

      1. The connection pools have to fit. `packages/db/src/pools.ts` declares 13
         named pools whose `max` values sum to 111. `var.postgres_sku` is
         B_Standard_B1ms, whose max_connections is 50 — a TIER-SPECIFIC CEILING,
         not a tunable, and Azure's built-in PgBouncer is not offered on the
         Burstable tier (verified: the `pgbouncer.enabled` parameter returns
         ServerConfigurationNotAllowed on psql-kanninja-prod-cus). Today those
         pools sit behind Supabase's own pooler, which is why 111 has never
         mattered. On a private Flexible Server it fails under load, as
         `too many connections`, from whichever pool happened to be 51st.
      2. The restricted role. `agconn_app` must be NOBYPASSRLS — 18 of AGCONN's
         39 migrations set FORCE ROW LEVEL SECURITY, and a BYPASSRLS role is
         exempt from every one of them while the policies still read as though
         they were being enforced.
      3. The storage layer. `services/api/src/lib/supabase-storage.ts` is written
         against the Supabase SDK and would be reimplemented against
         @azure/storage-blob.

    None of that is Terraform's problem, but flipping this without it produces a
    deploy that looks provisioned and cannot serve.
  EOT
  type        = bool
  default     = false
}

variable "agconn_key_vault_name" {
  description = <<-EOT
    GLOBALLY unique across Azure (it is a DNS label), 3-24 characters,
    alphanumerics and hyphens, must start with a letter. This one is 18.

    Its own vault rather than a prefix inside sparx's, for the same reason
    jotacular and kanNINJA each have one: a vault is the smallest scope Key Vault
    RBAC can assign a role to. `Key Vault Secrets User` granted on a shared vault
    would let AGCONN's pipeline read every sparx, jotacular and kanNINJA
    credential in it.
  EOT
  type        = string
  default     = "kv-agconn-prod-cus"

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9-]{1,22}[a-zA-Z0-9]$", var.agconn_key_vault_name))
    error_message = "Key Vault names are 3-24 chars, start with a letter, end alphanumeric, and allow only letters, digits and hyphens."
  }
}

locals {
  agconn_count      = var.agconn_enabled ? 1 : 0
  agconn_data_count = var.agconn_enabled && var.agconn_data_enabled ? 1 : 0
}

# ---------------------------------------------------------------------------
# Key Vault — ACTIVE. The only thing this file provisions today.
#
# WHAT IT REPLACES, and this is the reason it exists rather than a preference.
# AGCONN currently carries ~45 GitHub Actions secrets. GitHub secrets are WRITE
# ONLY: there is no API to read one back, so adding a single key means
# reconstructing every one of them from a copy kept somewhere else, and
# `gh secret set` REPLACES. A typo there is an outage on the next deploy.
#
# Key Vault makes each secret an individually readable, writable, VERSIONED
# object, so adding one is `az keyvault secret set` and nothing else. It also
# brings audit logs, RBAC and rollback, none of which a repo secret has.
#
# WHAT GOES IN IT. With the data layer staying on Supabase, TERRAFORM GENERATES
# NOTHING — every value is human-set, including the four that would otherwise
# have been minted here:
#
#   DATABASE-URL / DIRECT-URL        Supabase pooler (6543) and direct (5432).
#                                    Prisma's schema engine reads DIRECT_URL
#                                    (packages/db/prisma.config.ts) because
#                                    transaction-mode pooling breaks its
#                                    prepared statements.
#   SUPABASE-URL / SUPABASE-SERVICE-ROLE-KEY   object storage.
#   CLERK-*                          two instances: the app and the admin app.
#   TWILIO-* / RESEND-* / STRIPE-*   messaging and billing.
#   SENTRY-* / POSTHOG-* / MAPBOX    observability and maps.
#   AUDIT-HMAC-KEY, PARTICIPANT-PEPPER, ADMIN-BEARER-TOKEN,
#   WAITLIST-TOKEN-SECRET, INTERNAL-REVALIDATE-SECRET, CLERK-ENCRYPTION-KEY
#
# The AGCONN repo's .env.example is the authority on that list, not this comment.
#
# NAMES ARE UPPERCASE-KEBAB, matching jotacular and kanNINJA, whose pipelines map
# a vault name to an env name with `${name//_/-}` — a case-PRESERVING
# substitution. sparx's own pipeline uses `tr 'a-z-' 'A-Z_'` and therefore
# lowercase names. Two conventions, each internally consistent, and mixing them
# produces a secret that reads as present in the portal and is never found at
# deploy time.
# ---------------------------------------------------------------------------
resource "azurerm_key_vault" "agconn" {
  count               = local.agconn_count
  name                = var.agconn_key_vault_name
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = "standard"
  tags                = local.tags

  # RBAC, not the legacy access-policy model. Access policies are per-vault ACLs
  # that Terraform and the portal fight over; RBAC is the same role system the
  # rest of this configuration already uses.
  rbac_authorization_enabled = true

  soft_delete_retention_days = 7

  # Deliberately FALSE until AGCONN launches, matching jotacular and kanNINJA.
  # Purge protection is ONE-WAY — once true it can never be set false, and a
  # destroyed vault keeps its NAME reserved for the whole retention window, so
  # rebuilding means picking a new name. Before launch, a single early teardown
  # would cost `kv-agconn-prod-cus` for a week to fix nothing.
  #
  # FLIP THIS TO TRUE AT LAUNCH. Same one-line change either way, and after there
  # are real workers with real I-9s behind these credentials the argument
  # reverses completely.
  purge_protection_enabled = false

  lifecycle {
    # With purge protection deliberately off, this is the ONLY thing standing
    # between a careless destroy and a vault that has to be rebuilt under a
    # different name. The ~45 values inside are mostly NOT regenerable by us —
    # they belong to Clerk, Twilio, Stripe and Resend — so losing them is a
    # transcription exercise across four vendors' dashboards.
    prevent_destroy = true
  }
}

# ---------------------------------------------------------------------------
# ===========================================================================
# BELOW HERE: DEFERRED. Everything from this line is gated on
# `agconn_data_enabled`, which is false. Read the variable's description before
# turning it on — the Terraform is the easy half.
# ===========================================================================
# ---------------------------------------------------------------------------

# Flexible Server requires a subnet DELEGATED to it, which cannot host anything
# else — hence a dedicated /28 per tenant rather than sharing one.
#
# 10.20.16.48/28 is the next free block. The allocation so far, and the reason
# this is written down rather than counted each time:
#
#   10.20.16.0/28   snet-psql              sparx
#   10.20.16.16/28  snet-psql-jotacular    jotacular
#   10.20.16.32/28  snet-psql-kanninja     kanNINJA
#   10.20.16.48/28  snet-psql-agconn       THIS
#
# The /28 is reserved by convention while this block is disabled — nothing holds
# it in Azure, so a fifth tenant onboarded first would take it and this comment
# is the only thing stopping that.
resource "azurerm_subnet" "agconn_postgres" {
  count                = local.agconn_data_count
  name                 = "snet-psql-agconn"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.20.16.48/28"]

  # Azure ADDS this itself when a Flexible Server is placed in the subnet — the
  # server needs it to reach backup storage. Declaring it is not decoration:
  # without it Terraform sees an undeclared endpoint, plans to REMOVE it, and the
  # next apply quietly degrades database backups.
  service_endpoints = ["Microsoft.Storage"]

  delegation {
    name = "fs"
    service_delegation {
      name = "Microsoft.DBforPostgreSQL/flexibleServers"
      actions = [
        "Microsoft.Network/virtualNetworks/subnets/join/action",
      ]
    }
  }
}

# A SEPARATE SERVER, not a second database on sparx's — matching what jotacular
# and kanNINJA ended up with. Flexible Server bills per server, so this is the
# one line item in this file that is not effectively free.
#
# Private-endpoint only. The consequence is the one every tenant here lives with:
# you cannot reach the database from a laptop, so migrations and any restore run
# as an in-cluster Job. That is already how AGCONN's `db-migrate` Job works.
resource "azurerm_postgresql_flexible_server" "agconn" {
  count               = local.agconn_data_count
  name                = "psql-agconn-${var.environment}-${local.loc}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  version    = var.postgres_version
  sku_name   = var.postgres_sku
  storage_mb = var.postgres_storage_mb

  administrator_login    = "agconn_owner"
  administrator_password = random_password.agconn_owner[0].result

  delegated_subnet_id           = azurerm_subnet.agconn_postgres[0].id
  private_dns_zone_id           = azurerm_private_dns_zone.postgres.id
  public_network_access_enabled = false

  # 7 days is the free minimum. The reason to pay for managed Postgres at all is
  # point-in-time restore; going below the floor would defeat the purpose.
  #
  # WORTH A DECISION BEFORE THIS TURNS ON: AGCONN holds I-9s, signed audit
  # binders and funder-facing reporting. If its compliance story needs more than
  # seven days of PITR, that is a cost question to settle here rather than after
  # the first incident.
  backup_retention_days        = 7
  geo_redundant_backup_enabled = false

  zone = "1"

  tags = local.tags

  depends_on = [azurerm_private_dns_zone_virtual_network_link.postgres]

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_postgresql_flexible_server_database" "agconn" {
  count     = local.agconn_data_count
  name      = "agconn"
  server_id = azurerm_postgresql_flexible_server.agconn[0].id
  collation = "en_US.utf8"
  charset   = "utf8"

  lifecycle {
    prevent_destroy = true
  }
}

# NO `azurerm_postgresql_flexible_server_configuration` FOR `azure.extensions`,
# and that absence is a finding rather than an omission.
#
# `azure.extensions` defaults to EMPTY, and until a name appears there
# `CREATE EXTENSION` fails with "extension is not allow-listed" — inside the
# MIGRATION RUNNER, after roles exist and pods have already rolled, which is why
# it reads as an application error rather than an infrastructure one.
#
# AGCONN needs none. Verified 2026-08-26 across all 39 migrations:
#
#     grep -rhoiE 'CREATE EXTENSION [^;]+' packages/db/prisma/migrations/
#     -> no matches
#
# The only Postgres features used beyond core SQL are `gen_random_uuid()` and
# `tsvector`, both built into PG 13+ and neither requiring an extension.
# psql-kanninja-prod-cus likewise carries an empty value.
#
# RE-RUN THAT GREP before the first migration against this server. A migration
# added between now and then could introduce one, and the failure mode gives no
# hint that a server parameter is what is wrong.

# ---------------------------------------------------------------------------
# Blob storage — job photos, compliance evidence, grant reports, certificates.
#
# FOUR CONTAINERS, matching the four Supabase buckets one-for-one so that object
# keys do not move: every key is `<tenantId>/<scopeId>/<random>.<ext>` and the
# tenant prefix is referenced from database rows.
#
# `allow_nested_items_to_be_public = false` is the important line, and it is the
# one behaviour that does NOT map cleanly from Supabase. `job-photos` is a PUBLIC
# bucket there. Azure refuses anonymous access outright with this set, so at
# cutover either photos get served through the API behind a short-lived SAS URL
# (recommended — this same account holds I-9s and signed audit binders, and one
# storage rule beats two), or this account gets relaxed and every future
# container has to get its access level right forever.
#
# NO `cors_rule`, unlike kanNINJA's account. AGCONN uploads THROUGH the API; the
# browser never PUTs to storage directly. Add one naming https://agconn.com the
# day that changes — without a matching origin every upload AND download fails at
# preflight, with no server-side trace, because no request reaches the backend.
# ---------------------------------------------------------------------------
resource "azurerm_storage_account" "agconn" {
  count = local.agconn_data_count

  # Storage account names are globally unique, 3-24 chars, lowercase alphanumeric
  # ONLY — no hyphens, which is why this does not read like the other names here.
  # "stagconnprodcus" = 15.
  name                     = "stagconn${var.environment}${local.loc}"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  account_kind             = "StorageV2"
  access_tier              = "Hot"
  tags                     = local.tags

  min_tls_version                 = "TLS1_2"
  https_traffic_only_enabled      = true
  allow_nested_items_to_be_public = false
  shared_access_key_enabled       = true

  blob_properties {
    delete_retention_policy {
      days = 7
    }
  }
}

# One container per Supabase bucket. Names must match the BUCKETS map in
# services/api/src/lib/supabase-storage.ts, or its Azure successor.
resource "azurerm_storage_container" "agconn" {
  for_each = local.agconn_data_count == 1 ? toset([
    "job-photos",
    "compliance-evidence",
    "grant-reports",
    "certs",
  ]) : toset([])

  name                  = each.value
  storage_account_id    = azurerm_storage_account.agconn[0].id
  container_access_type = "private"
}

# ---------------------------------------------------------------------------
# Generated credentials — minted here, written here, never typed by a person.
#
# Only the DATA-layer secrets are generated. Everything AGCONN reads today is
# human-set (see the Key Vault comment above), because nothing in Azure can mint
# a credential Clerk, Twilio, Stripe or Supabase controls.
#
# WHERE THE VALUES LIVE: in Terraform state, which is the honest cost of this
# approach. State is in `stsparxprodcustfstate` behind `use_azuread_auth`, and it
# ALREADY holds `random_password.postgres_admin` — the credential to sparx's
# entire server. These add nothing to that blast radius.
# ---------------------------------------------------------------------------

resource "random_password" "agconn_owner" {
  count   = local.agconn_data_count
  length  = 32
  special = true
  # The same exclusions as the server admin beside it. Postgres accepts more than
  # this; these survive a connection string, a psql `-v` substitution and a dotenv
  # line without all three having to agree about escaping.
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# The RESTRICTED role the application connects as. NOT the owner, and this is the
# single most important line in the deferred half.
#
# PostgreSQL exempts superusers and BYPASSRLS roles from EVERY policy, including
# `FORCE ROW LEVEL SECURITY`. AGCONN sets that on 18 of its 39 migrations. An
# owner connection string therefore turns the whole tenant boundary off while
# every policy still reads as though it were being enforced — which is exactly
# the state AGCONN is in TODAY against Supabase, whose `postgres` role carries
# BYPASSRLS. Moving here is what fixes it, and only if this role is what
# DATABASE-URL points at.
#
# The role itself is created by a `db-role` Job in AGCONN's pipeline, modelled on
# kanNINJA's, which runs `ALTER ROLE agconn_app PASSWORD` with the value below.
resource "random_password" "agconn_app" {
  count            = local.agconn_data_count
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

locals {
  agconn_server = local.agconn_data_count == 1 ? azurerm_postgresql_flexible_server.agconn[0].fqdn : ""

  # `content_type` is not decoration: `az keyvault secret show` prints it, so it
  # is the only thing telling whoever opens this vault which values may safely be
  # regenerated and which would strand something.
  agconn_data_secrets = local.agconn_data_count == 1 ? {
    "DATABASE-URL" = {
      value = "postgresql://agconn_app:${urlencode(random_password.agconn_app[0].result)}@${local.agconn_server}:5432/agconn?sslmode=require"
      type  = "connection-string; the RESTRICTED role. Rotate by tainting random_password.agconn_app"
    }
    "DIRECT-URL" = {
      # Same value as DATABASE-URL. AGCONN's packages/db/prisma.config.ts reads
      # DIRECT_URL for schema-engine operations because transaction-mode pooling
      # breaks Prisma's prepared statements. Against a direct Flexible Server
      # there is no pooler and the distinction collapses — but the code still
      # reads the variable, so it has to be present or `prisma migrate deploy`
      # falls back to the placeholder and fails obscurely.
      value = "postgresql://agconn_app:${urlencode(random_password.agconn_app[0].result)}@${local.agconn_server}:5432/agconn?sslmode=require"
      type  = "connection-string; read by prisma.config.ts. Same value as DATABASE-URL here"
    }
    "DATABASE-ADMIN-URL" = {
      value = "postgresql://agconn_owner:${urlencode(random_password.agconn_owner[0].result)}@${local.agconn_server}:5432/agconn?sslmode=require"
      type  = "connection-string; migrations and role creation ONLY, never the running app"
    }
    "AGCONN-APP-PASSWORD" = {
      # The same password as the one inside DATABASE-URL, carried separately
      # because the db-role Job runs `ALTER ROLE agconn_app PASSWORD` with it.
      # Two names, one value, on purpose.
      value = random_password.agconn_app[0].result
      type  = "password; the db-role Job sets this on agconn_app. Must match DATABASE-URL"
    }
    "AZURE-STORAGE-ACCOUNT" = {
      value = azurerm_storage_account.agconn[0].name
      type  = "account name; not secret, carried here so one lookup finds everything"
    }
    "AZURE-STORAGE-KEY" = {
      value = azurerm_storage_account.agconn[0].primary_access_key
      type  = "storage key; regenerating it in the portal makes this value stale"
    }
  } : {}
}

# Writing these requires `Key Vault Secrets Officer` on this vault for SPARX's
# release identity — granted in terraform/bootstrap-azure/agconn.tf. Contributor
# does NOT imply it: Key Vault's data plane is its own RBAC surface, and without
# the assignment this fails with a 403 that never mentions a missing role.
#
# READ THE ASYMMETRY, IT IS THE POINT. sparx's release holds Secrets OFFICER here
# because it PROVISIONS. AGCONN's release holds Secrets USER because it DEPLOYS,
# and must never be able to rewrite a credential it is about to ship.
resource "azurerm_key_vault_secret" "agconn" {
  for_each = local.agconn_data_secrets

  name         = each.key
  value        = each.value.value
  key_vault_id = azurerm_key_vault.agconn[0].id
  content_type = each.value.type
  tags         = local.tags

  lifecycle {
    # A vault secret is VERSIONED, so rewriting one is additive and safe. A
    # DESTROY is not: it soft-deletes the NAME, and with purge protection
    # deliberately off that is a name held hostage for the retention window.
    prevent_destroy = true
  }
}

# ---------------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------------

output "agconn_key_vault_name" {
  description = "Vault holding AGCONN's secrets. Set as AZURE_KEY_VAULT_NAME on the AgConnect repo."
  value       = var.agconn_enabled ? azurerm_key_vault.agconn[0].name : null
}

output "agconn_postgres_fqdn" {
  description = "Private FQDN of AGCONN's Postgres server, resolvable only from inside the VNet. Null while agconn_data_enabled is false — AGCONN's database is on Supabase."
  value       = local.agconn_data_count == 1 ? azurerm_postgresql_flexible_server.agconn[0].fqdn : null
}

output "agconn_storage_account" {
  description = "Blob account for job photos, compliance evidence, grant reports and certificates. Null while agconn_data_enabled is false — AGCONN's objects are on Supabase Storage."
  value       = local.agconn_data_count == 1 ? azurerm_storage_account.agconn[0].name : null
}

output "agconn_owner_password" {
  description = <<-EOT
    Server admin password. Needed only to reach the database by hand in an
    incident — the pipeline reads DATABASE-ADMIN-URL from the vault instead, and
    nothing in normal operation wants this value.
  EOT
  value       = local.agconn_data_count == 1 ? random_password.agconn_owner[0].result : null
  sensitive   = true
}
