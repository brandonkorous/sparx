# ---------------------------------------------------------------------------
# jotDOJO — everything a SECOND product needs from sparx's Azure footprint.
#
# jotDOJO (jotdojo.com) lives in its own repository (jotDOJO) and deploys from
# its own pipeline. It is NOT part of sparx and not part of piggles: piggles
# ships inside this repo and therefore shares this repo's Key Vault, its
# `sparx-app-secrets`, and its release. jotDOJO shares none of those — only the
# CLUSTER and the DATABASE SERVER, both of which are defined here, which is the
# entire reason this file exists.
#
# ONE FILE, deliberately, and it is the removal story. Everything jotDOJO owns
# in this subscription is in this file; deleting it and running `terraform apply`
# takes the whole product's infrastructure with it and touches nothing of
# sparx's. That property is worth more than filing each resource next to its
# same-typed neighbours, and it is why the variables are co-located here too
# rather than in variables.tf.
#
# WHAT IS NOT HERE: the workloads. Terraform does not manage workloads in this
# environment (see providers.tf) and must not start to. jotDOJO's Deployments,
# Services and namespace are plain YAML in the jotDOJO repo under `infra/k8s/`
# — its ADR-026 rules out Helm and Kustomize, and nothing here overrides that.
# The only cluster-side change sparx owns is the Caddy routing table
# (k8s/ingress/Caddyfile) plus the TLS allow-list entries in
# wizeworks/services/api-rest/src/routes/internal/domain-check.ts.
# ---------------------------------------------------------------------------

variable "jotdojo_enabled" {
  description = <<-EOT
    Master switch for the whole file. Off leaves jotDOJO with no database, no
    vault, no storage and no CI identity — which is the correct state until the
    jotDOJO repo is actually ready to deploy, because an empty Key Vault and an
    unused app registration are both things that look configured and are not.

    Turning it on is additive and cheap: see the cost note on each resource. The
    only line item that is not effectively free is storage, and that bills by
    consumption from zero.
  EOT
  type        = bool
  default     = true
}

variable "jotdojo_github_repository" {
  description = <<-EOT
    `owner/repo` of the repository whose Actions runs may assume jotDOJO's Azure
    identity. The FEDERATED SUBJECT is built from this string, and Entra matches a
    subject EXACTLY — a fork, a rename, or a different repo under the same owner
    produces a different subject and simply cannot authenticate.

    VERIFIED against the repository's own remote on 2026-08-21:
    `git remote -v` in the checkout reports
    https://github.com/brandonkorous/jotdojo.git. Read from git rather than
    transcribed from a message, deliberately — see the casing note.

    CASE MATTERS, AND THIS IS THE CASE THAT BITES. GitHub's OIDC `sub` claim
    carries the repository's canonical casing, so the repo is `jotdojo` in this
    string even though the local DIRECTORY is `jotDOJO` and the product is
    styled jotDOJO everywhere a human reads it. GitHub routes a browser to
    either spelling, which is exactly why the wrong one survives review: it
    works in every place except the token exchange, where it produces
    "no matching federated identity credential" with nothing in the message
    pointing at the letter that is wrong.

    The DIRECTORY name is not this value and never was. Only what GitHub serves
    reaches the token.
  EOT
  type        = string
  default     = "brandonkorous/jotdojo"

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.jotdojo_github_repository))
    error_message = "jotdojo_github_repository must be in `owner/repo` form."
  }
}

variable "jotdojo_github_branches" {
  description = <<-EOT
    Branches whose pushes may assume the identity. One federated credential is
    created per entry.

    `main` ONLY. This briefly carried `master` as well, because the checkout was
    created by a `git init` old enough to default to it and there was no remote to
    settle the question. It is settled now: the repository publishes from `main`,
    matching every other repo here.

    THE LOCAL CHECKOUT WAS STILL ON `master` WHEN THIS WAS WRITTEN. That rename
    has to actually happen — `git branch -m master main` — before the first
    deploy, or the workflow runs on a ref no credential here matches and the
    token exchange fails with "no matching federated identity credential",
    which says nothing about branches.

    Adding a branch is free if one is ever needed: federated credentials cost
    nothing, an app supports 20, and a credential for a ref that never receives a
    push is inert.
  EOT
  type        = set(string)
  default     = ["main"]
}

variable "jotdojo_key_vault_name" {
  description = <<-EOT
    GLOBALLY unique across all of Azure (it is a DNS label), 3-24 characters,
    alphanumerics and hyphens, must start with a letter.

    Kept separate from sparx's vault rather than sharing one with a name prefix.
    A vault is the smallest thing Key Vault RBAC can scope a role to, so one
    vault per product is the only way jotDOJO's pipeline can read jotDOJO's
    secrets without also being able to read every sparx credential — the
    `Key Vault Secrets User` role below would otherwise grant exactly that.
  EOT
  type        = string
  default     = "kv-jotdojo-prod-cus"

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9-]{1,22}[a-zA-Z0-9]$", var.jotdojo_key_vault_name))
    error_message = "Key Vault names are 3-24 chars, start with a letter, end alphanumeric, and allow only letters, digits and hyphens."
  }
}

locals {
  jotdojo_count = var.jotdojo_enabled ? 1 : 0
  jotdojo_repo  = var.jotdojo_github_repository
}

# The caller's tenant, subscription and object id. bootstrap-azure declares its
# own copy; this environment had never needed one because nothing in it addressed
# the directory until the vault and the app registration below.
#
# `object_id` is the identity running Terraform — a human at `az login` locally,
# the Actions service principal in CI. It is used for the two OWNER/OFFICER
# grants, which is why applying this file as one identity and then loading
# secrets as another leaves the second one unable to write: the role went to
# whoever ran the apply.
data "azurerm_client_config" "current" {}

# ---------------------------------------------------------------------------
# Database — a SEPARATE DATABASE on sparx's existing server, never a schema.
#
# The question this answers is "can jotDOJO share sparx's Postgres, with its own
# schema?" Sharing the SERVER: yes, and it is free — Flexible Server bills per
# server, so a second database on it costs exactly nothing. Sharing the DATABASE
# with a schema: no, and the reasons are not stylistic.
#
#   1. BACKUP AND RESTORE ARE PER-SERVER, BUT PITR IS PER-SERVER TOO. A schema
#      inside `sparx` would make a point-in-time restore of sparx roll jotDOJO
#      back to the same instant. Two products whose recovery stories are welded
#      together is a real operational hazard the moment either has users. A
#      separate database does not fix PITR granularity — that is still
#      server-wide — but it does mean a logical `pg_dump`/restore of one is
#      possible without touching the other.
#   2. ROLES AND RLS. Both products enforce tenancy with row-level security and
#      a restricted application role. sparx's is `sparx_app` against
#      `current_tenant_id()`; jotDOJO's is `jotdojo_app` against
#      `app.actor_id`. Two RLS regimes sharing a database means one `GRANT` typo
#      is a cross-PRODUCT data leak rather than a bug in one of them.
#   3. EXTENSIONS ARE PER-DATABASE OBJECTS. `CREATE EXTENSION vector` installs
#      into a specific database. jotDOJO needs vector/pg_trgm/citext; sparx
#      needs neither, and there is no reason for sparx's schema to carry them.
#      (The server-level ALLOW-LIST is shared and unavoidable — see main.tf.)
#   4. MIGRATIONS. Two independent migration runners against one database will
#      eventually both take a lock, and neither knows the other exists.
#
# THE REAL CONSTRAINT IS CONNECTIONS, NOT STORAGE OR CPU. B1ms is capped at 50
# max_connections — a hard, tier-specific ceiling, not a tunable — and sparx
# already draws on it. jotDOJO's `packages/db/src/client.ts` opens
# `postgres(url, { max: 10 })`, so four services at their default is FORTY
# connections and does not fit. That is a change in the jotDOJO repo (make the
# pool size read an env var and set it low), not something this file can fix.
# Raising the tier is the alternative and it is not cheap: B1ms is $0.01921/hr
# (~$14/mo) and the next step B2s is $0.07684/hr (~$56/mo) — FOUR times, not
# double, because Azure prices the burstable series per vCore-hour and B2s is
# also a bigger core. Do not scale it reflexively; cap the pools first.
# ---------------------------------------------------------------------------
resource "azurerm_postgresql_flexible_server_database" "jotdojo" {
  count     = local.jotdojo_count
  name      = "jotdojo"
  server_id = azurerm_postgresql_flexible_server.main.id
  collation = "en_US.utf8"
  charset   = "utf8"

  lifecycle {
    # Same posture as the `sparx` database beside it. Losing this is losing
    # another product's data, and a database is a one-line resource — exactly the
    # kind of thing a careless refactor drops.
    prevent_destroy = true
  }
}

# ---------------------------------------------------------------------------
# Key Vault — jotDOJO's own, for the same reasons sparx has one.
#
# COST is a rounding error, identical to sparx's vault: Standard tier has no base
# fee, secret storage is free, and operations are $0.03 per 10,000. A pipeline
# reading a dozen secrets per run costs thousandths of a cent. Standard, never
# Premium — Premium buys HSM-backed cryptographic KEYS, which neither product
# uses.
#
# WHAT GOES IN IT (jotDOJO's .env.example is the authority, not this list):
#   DATABASE_URL              the RESTRICTED jotdojo_app role. Never the owner —
#                             PostgreSQL exempts superusers and BYPASSRLS roles
#                             from every policy, so an admin connection string
#                             turns the tenancy boundary off while every policy
#                             still reads as though it were enforced. jotDOJO's
#                             infra/README.md calls this out as the one thing not
#                             to get wrong, and `pnpm db:smoke` proves it holds.
#   DATABASE_ADMIN_URL        owner connection. MIGRATIONS ONLY, never the app.
#   AUTH_SECRET               NextAuth session signing key.
#   AUTH_GOOGLE_ID / _SECRET  Google OAuth client.
#   AZURE_STORAGE_*           the account below, for ink/audio/image blobs.
#   OPENAI_API_KEY or the AZURE_OPENAI_* trio, if embeddings are switched on.
#   ANTHROPIC_API_KEY         if handwriting recognition is switched on.
# ---------------------------------------------------------------------------
resource "azurerm_key_vault" "jotdojo" {
  count               = local.jotdojo_count
  name                = var.jotdojo_key_vault_name
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = "standard"
  tags                = local.tags

  # RBAC, not the legacy access-policy model — same choice as sparx's vault.
  # Access policies are per-vault ACLs that Terraform and the portal fight over.
  rbac_authorization_enabled = true

  soft_delete_retention_days = 7

  # Deliberately FALSE, and this is the one place jotDOJO's vault differs from
  # sparx's on purpose. Purge protection is ONE-WAY — once true it can never be
  # set false, and a destroyed vault keeps its NAME reserved for the whole
  # retention window, so rebuilding means picking a new name. sparx's vault holds
  # the credentials of a live platform and is worth that price. jotDOJO has not
  # launched; locking its vault name before the first deploy would mean a single
  # early teardown costs the name `kv-jotdojo-prod-cus` for a week.
  #
  # FLIP THIS TO TRUE AT LAUNCH. It is the same one-line change either way, and
  # after there are real users the argument reverses completely.
  purge_protection_enabled = false
}

# ---------------------------------------------------------------------------
# Blob storage — ink strokes, audio, images, and rendered ink previews.
#
# jotDOJO's architecture doc puts these behind SAS URLs and explicitly never
# proxies them through the API. That is a different posture from sparx's media
# account, whose `media-public` container is private precisely BECAUSE api-rest
# serves variants itself — so the two accounts are not interchangeable and
# jotDOJO gets its own rather than a container in sparx's.
#
# LRS, not GRS: geo-redundancy roughly doubles the price, and the recovery story
# it buys is not one a pre-launch product needs. Hot tier — a note's ink preview
# is read every time the note is opened.
#
# `allow_nested_items_to_be_public = false` is the important line. Ink and audio
# are the most private thing in the product; the SAS-URL design means nothing
# ever needs anonymous access, so the account refuses to grant it at all rather
# than relying on every future container getting its access level right.
# ---------------------------------------------------------------------------
resource "azurerm_storage_account" "jotdojo" {
  count = local.jotdojo_count

  # Storage account names are globally unique, 3-24 chars, lowercase alphanumeric
  # ONLY — no hyphens, which is why this does not read like the other names here.
  name                     = "stjotdojoprodcus"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  account_kind             = "StorageV2"
  access_tier              = "Hot"
  tags                     = local.tags

  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false
  shared_access_key_enabled       = true
}

# ONE container, because that is what the code actually addresses.
#
# This began as three — `ink`, `media`, `renders` — on the reasoning that
# splitting them would let a lifecycle rule expire derived renders while keeping
# strokes and audio forever. That reasoning is fine and the shape was still
# wrong: `packages/storage/src/resolve.ts` takes a SINGLE
# `AZURE_STORAGE_CONTAINER`, and every SAS URL it mints is
# `<origin>/<container>/<key>`. Two of the three would have been created,
# monitored, and never written to — infrastructure that reads as though it is
# holding something.
#
# Separation is by KEY PREFIX instead (`mediaKey(spaceId, assetId, ext)` in
# packages/domain/src/media.ts), which a blob lifecycle rule can match on just as
# well. If the split ever needs to be physical, it is a container per store
# instance and a config change in that package — not something to pre-build here.
resource "azurerm_storage_container" "jotdojo" {
  count = local.jotdojo_count

  # Must equal AZURE_STORAGE_CONTAINER in the deployment's config.
  name               = "media"
  storage_account_id = azurerm_storage_account.jotdojo[0].id

  # Private. Reads happen through short-lived SAS URLs the domain layer mints;
  # there is no anonymous path and there should never be one.
  container_access_type = "private"
}

# ---------------------------------------------------------------------------
# CI identity — the jotDOJO repository's own federated credential.
#
# A SECOND identity rather than reusing this repo's. The subject of a federated
# credential names the repository, so sparx's identity cannot be assumed from
# jotDOJO's workflows even if someone wanted it to be — and the separation is
# worth keeping regardless: jotDOJO's pipeline should never hold a token that can
# read sparx's Key Vault or roll sparx's Deployments.
#
# NO SUBSCRIPTION CONTRIBUTOR. sparx's Actions identity holds it because sparx's
# pipeline RUNS TERRAFORM and creates infrastructure. jotDOJO's pipeline does
# not: this file owns its infrastructure, so its identity needs only enough to
# read its secrets, push to its namespace, and write its blobs. Every role below
# is scoped to a single resource.
# ---------------------------------------------------------------------------
resource "azuread_application" "jotdojo_gha" {
  count        = local.jotdojo_count
  display_name = "gha-jotdojo-prod"
  owners       = [data.azurerm_client_config.current.object_id]
}

resource "azuread_service_principal" "jotdojo_gha" {
  count     = local.jotdojo_count
  client_id = azuread_application.jotdojo_gha[0].client_id
  owners    = [data.azurerm_client_config.current.object_id]
}

# One credential per trusted context, exactly as bootstrap-azure does it.
# `subject` is matched EXACTLY by Entra — there are no wildcards, not even for a
# branch — so each context a workflow can run in needs its own entry or it cannot
# authenticate.
#
# Keyed by branch rather than a single `main` resource. See
# var.jotdojo_github_branches: the local checkout is on `master` and GitHub
# defaults new repositories to `main`, so which one this repo ends up publishing
# from is not yet knowable. Both are covered; the unused one is inert.
resource "azuread_application_federated_identity_credential" "jotdojo_branch" {
  for_each = var.jotdojo_enabled ? var.jotdojo_github_branches : toset([])

  application_id = azuread_application.jotdojo_gha[0].id
  display_name   = "github-${each.value}"
  description    = "Pushes to ${each.value} in ${local.jotdojo_repo}."
  audiences      = ["api://AzureADTokenExchange"]
  issuer         = "https://token.actions.githubusercontent.com"
  subject        = "repo:${local.jotdojo_repo}:ref:refs/heads/${each.value}"
}

resource "azuread_application_federated_identity_credential" "jotdojo_environment" {
  count          = local.jotdojo_count
  application_id = azuread_application.jotdojo_gha[0].id
  display_name   = "github-environment-prod"
  description    = "Jobs bound to the `prod` GitHub Environment in ${local.jotdojo_repo}."
  audiences      = ["api://AzureADTokenExchange"]
  issuer         = "https://token.actions.githubusercontent.com"
  subject        = "repo:${local.jotdojo_repo}:environment:prod"
}

# Read its OWN vault. Get + list, never write: a compromised workflow must not be
# able to rewrite a credential the product then deploys.
resource "azurerm_role_assignment" "jotdojo_gha_kv" {
  count                = local.jotdojo_count
  scope                = azurerm_key_vault.jotdojo[0].id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azuread_service_principal.jotdojo_gha[0].object_id
}

# Write its OWN blobs. Scoped to the storage account, so it cannot touch sparx's
# media account sitting in the same resource group.
resource "azurerm_role_assignment" "jotdojo_gha_blob" {
  count                = local.jotdojo_count
  scope                = azurerm_storage_account.jotdojo[0].id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azuread_service_principal.jotdojo_gha[0].object_id
}

# `Azure Kubernetes Service Cluster User` — enough to FETCH a kubeconfig, and
# nothing more. Authorization inside the cluster is Kubernetes' own; this role
# does not grant it. Deliberately NOT `Cluster Admin`, which sparx's identity
# holds because its release applies namespaces and CRD-adjacent infra.
#
# NOTE — this is the one grant that is not self-evidently safe, because AKS here
# keeps LOCAL ACCOUNTS enabled (providers.tf depends on `kube_config`), and with
# local accounts on, `Cluster User` returns admin-equivalent credentials. Closing
# that properly means disabling local accounts and switching the cluster to Entra
# RBAC with a namespace-scoped role binding — a change to the cluster that would
# also force providers.tf onto exec-based auth. Recorded here rather than left
# implicit; it is the follow-up that makes this grant mean what it reads like.
resource "azurerm_role_assignment" "jotdojo_gha_aks" {
  count                = local.jotdojo_count
  scope                = azurerm_kubernetes_cluster.main.id
  role_definition_name = "Azure Kubernetes Service Cluster User Role"
  principal_id         = azuread_service_principal.jotdojo_gha[0].object_id
}

# The HUMAN loading secrets needs WRITE, and being subscription Owner does NOT
# grant it — Key Vault's data plane is its own RBAC surface. Without this,
# `az keyvault secret set` fails with a 403 that says nothing about a missing
# role. Same trap as sparx's vault, same fix.
resource "azurerm_role_assignment" "jotdojo_operator_kv" {
  count                = local.jotdojo_count
  scope                = azurerm_key_vault.jotdojo[0].id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = data.azurerm_client_config.current.object_id
}

# ---------------------------------------------------------------------------
# Outputs — the values the jotDOJO repo needs to configure its own pipeline.
# `terraform output jotdojo_github_setup` prints the gh commands verbatim.
# ---------------------------------------------------------------------------
output "jotdojo_key_vault_name" {
  description = "Key Vault holding jotDOJO's secrets."
  value       = var.jotdojo_enabled ? azurerm_key_vault.jotdojo[0].name : null
}

output "jotdojo_storage_account" {
  description = "Blob account for jotDOJO ink, audio and rendered previews."
  value       = var.jotdojo_enabled ? azurerm_storage_account.jotdojo[0].name : null
}

output "jotdojo_github_setup" {
  description = "Repository variables to set on the jotDOJO repo so its pipeline can authenticate."
  value = var.jotdojo_enabled ? [
    "gh variable set AZURE_CLIENT_ID       -R ${local.jotdojo_repo} -b '${azuread_application.jotdojo_gha[0].client_id}'",
    "gh variable set AZURE_TENANT_ID       -R ${local.jotdojo_repo} -b '${data.azurerm_client_config.current.tenant_id}'",
    "gh variable set AZURE_SUBSCRIPTION_ID -R ${local.jotdojo_repo} -b '${data.azurerm_client_config.current.subscription_id}'",
    "gh variable set AZURE_KEY_VAULT_NAME  -R ${local.jotdojo_repo} -b '${azurerm_key_vault.jotdojo[0].name}'",
  ] : []
}
