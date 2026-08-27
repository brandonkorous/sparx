# ---------------------------------------------------------------------------
# AGCONN's CI identity — the privileged half of that product's onboarding.
#
# AGCONN (agconn.com) is a fourth product on this subscription, in its own
# repository, deploying into its own namespace on the shared cluster. Its KEY
# VAULT is in terraform/envs/azure/agconn.tf, along with the Postgres server and
# blob account that file holds DISABLED — AGCONN's data stays on Supabase for
# now, so this identity's job is narrower than jotacular's or kanNINJA's: read a
# vault, roll some Deployments.
#
# WHY THE SPLIT IS NOT ARBITRARY. envs/azure is applied by the RELEASE, using an
# identity that holds subscription Contributor and nothing more. That is
# deliberate: Contributor cannot grant roles, which is what stops the pipeline
# escalating its own privileges. So two things are impossible there —
#
#   * `Microsoft.Authorization/roleAssignments/write` — granting any role
#   * `azuread_application` — a directory object is TENANT-wide, not
#     subscription-scoped, and needs Microsoft Graph rights the pipeline has
#     never held
#
# — and both fail with a 403 at APPLY time, after a green plan and a green
# validate. jotDOJO's identity was written into envs/azure first and failed on
# exactly those two.
#
# This file is applied BY A HUMAN with Owner and directory rights, like the rest
# of the bootstrap. It is not part of any pipeline.
#
# ORDER MATTERS ON A REBUILD: bootstrap (state + release identity) -> envs/azure
# (creates kv-agconn-prod-cus) -> this file, which looks that vault up as a data
# source. Wrong order gives a clean plan-time "Key Vault not found", not a
# mystery.
# ---------------------------------------------------------------------------

variable "agconn_enabled" {
  description = <<-EOT
    Master switch. Off leaves the AgConnect repository with no Azure identity,
    which is correct until that repository is ready to deploy — an app
    registration nothing uses is a credential surface with no owner.

    Independent of the switches in terraform/envs/azure: separate states, applied
    by different principals at different times, so neither can read the other's
    variables.
  EOT
  type        = bool
  default     = true
}

variable "agconn_github_repository" {
  description = <<-EOT
    `owner/repo` whose Actions runs may assume AGCONN's Azure identity.

    Entra matches a federated subject EXACTLY, so a fork, a rename, or a
    different repo under the same owner produces a different subject and simply
    cannot authenticate.

    VERIFIED against the GitHub API on 2026-08-26 rather than transcribed from a
    directory name: `gh api repos/brandonkorous/AgConnect` returns full_name
    `brandonkorous/AgConnect`, id 1226714101, default branch `main`.

    CASE MATTERS, AND THIS ONE IS MIXED-CASE. GitHub's OIDC `sub` claim carries
    the repository's canonical casing, so it is `AgConnect` — capital A, capital
    C — not `agconnect`. GitHub routes a browser to either spelling, which is
    exactly why the wrong one survives review: it works in every place except the
    token exchange, where it produces "no matching federated identity credential"
    with nothing in the message pointing at the letter that is wrong.

    Note that the PRODUCT is styled AGCONN and the domain is agconn.com. Neither
    is this value. Only what GitHub serves reaches the token.
  EOT
  type        = string
  default     = "brandonkorous/AgConnect"

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.agconn_github_repository))
    error_message = "agconn_github_repository must be in `owner/repo` form."
  }
}

variable "agconn_github_branches" {
  description = <<-EOT
    Branches whose pushes may assume the identity. One federated credential per
    entry; Entra has no wildcard for a branch.

    `main` only, and confirmed to be the repository's actual default branch —
    unlike jotDOJO, whose checkout was still on `master` when its credential was
    written and would have failed the exchange on first push.

    Adding one later is free: credentials cost nothing, an app supports 20, and a
    credential for a ref that never receives a push is inert.
  EOT
  type        = set(string)
  default     = ["main"]
}

variable "agconn_github_subject_prefix" {
  description = <<-EOT
    The literal prefix of the OIDC `sub` claim GitHub mints for this repository.
    Everything after it (`:ref:refs/heads/main`, `:environment:prod`) is appended
    by the credentials below.

    THIS IS THE PLAIN `repo:<owner>/<repo>` FORM, AND THAT IS NOT AN OVERSIGHT TO
    "FIX" BY COPYING jotacular's. GitHub began qualifying the subject with
    numeric owner and repository ids, and it does so PER REPOSITORY, by age.
    Read back on 2026-08-26:

        AgConnect  (id 1226714101)  repo:brandonkorous/AgConnect          <- this
        kanninja   (id 1251494871)  repo:brandonkorous/kanninja
        jotacular  (id 1341839746)  repo:brandonkorous@13042540/jotacular@1341839746

    AgConnect is the OLDEST of the three and keeps the older format. Nothing here
    chooses it and no repository setting turns it on or off — the credential has
    to match what GitHub actually sends.

    This distinction cost jotDOJO a red release. Entra matches byte for byte and,
    on a mismatch, reports only "No matching federated identity record found for
    presented assertion subject '<subject>'" — naming the value it RECEIVED and
    never the value it expected, so the diff has to be done by eye.

    READ IT BACK rather than assembling it by hand:

        gh api repos/<owner>/<repo>/actions/oidc/customization/sub \
          --jq .sub_claim_prefix

    If AGCONN ever starts failing with AADSTS700213, re-run that first: GitHub
    changing the prefix under a working credential looks exactly like this
    failure.
  EOT
  type        = string
  default     = "repo:brandonkorous/AgConnect"

  validation {
    condition     = startswith(var.agconn_github_subject_prefix, "repo:")
    error_message = "agconn_github_subject_prefix must start with `repo:` — paste sub_claim_prefix verbatim, without a trailing colon."
  }

  validation {
    condition     = !endswith(var.agconn_github_subject_prefix, ":")
    error_message = "agconn_github_subject_prefix must NOT end with a colon — the credentials append `:ref:...` and `:environment:...` themselves."
  }
}

variable "agconn_key_vault_name" {
  description = <<-EOT
    The vault terraform/envs/azure/agconn.tf creates. NAMED here rather than
    referenced, because the two live in different Terraform states and this
    bootstrap must not take a dependency on that environment's outputs.

    Keep in step with the variable of the same name over there.
  EOT
  type        = string
  default     = "kv-agconn-prod-cus"
}

locals {
  agconn_count = var.agconn_enabled ? 1 : 0
  agconn_repo  = var.agconn_github_repository
}

# The vault whose secrets this identity may read. A LOOKUP, not a resource — it
# belongs to envs/azure and is created there.
data "azurerm_key_vault" "agconn" {
  count               = local.agconn_count
  name                = var.agconn_key_vault_name
  resource_group_name = "rg-${var.workload}-${var.environment}-${local.loc}"
}

# ---------------------------------------------------------------------------
# The identity itself.
#
# A FOURTH app registration rather than reusing any existing one. A federated
# credential's subject names the repository, so sparx's identity cannot be
# assumed from AGCONN's workflows even deliberately — and the separation is worth
# keeping regardless: AGCONN's pipeline should never hold a token that can read
# another product's Key Vault or roll another product's Deployments.
# ---------------------------------------------------------------------------
resource "azuread_application" "agconn_gha" {
  count        = local.agconn_count
  display_name = "gha-agconn-prod"
  owners       = [data.azurerm_client_config.current.object_id]
}

resource "azuread_service_principal" "agconn_gha" {
  count     = local.agconn_count
  client_id = azuread_application.agconn_gha[0].client_id
  owners    = [data.azurerm_client_config.current.object_id]
}

resource "azuread_application_federated_identity_credential" "agconn_branch" {
  for_each = var.agconn_enabled ? var.agconn_github_branches : toset([])

  application_id = azuread_application.agconn_gha[0].id
  display_name   = "github-${each.value}"
  description    = "Pushes to ${each.value} in ${local.agconn_repo}."
  audiences      = ["api://AzureADTokenExchange"]
  issuer         = "https://token.actions.githubusercontent.com"
  subject        = "${var.agconn_github_subject_prefix}:ref:refs/heads/${each.value}"
}

resource "azuread_application_federated_identity_credential" "agconn_environment" {
  count          = local.agconn_count
  application_id = azuread_application.agconn_gha[0].id
  display_name   = "github-environment-prod"
  description    = "Jobs bound to the `prod` GitHub Environment in ${local.agconn_repo}."
  audiences      = ["api://AzureADTokenExchange"]
  issuer         = "https://token.actions.githubusercontent.com"
  subject        = "${var.agconn_github_subject_prefix}:environment:prod"
}

# ---------------------------------------------------------------------------
# Permissions — two for the pipeline, two for the humans and systems that load
# the vault. Deliberately not more.
#
# NO SUBSCRIPTION CONTRIBUTOR. sparx's Actions identity holds it because sparx's
# pipeline runs Terraform and creates infrastructure. AGCONN's does not: its
# infrastructure is created here and in envs/azure, so its identity needs only
# enough to read its secrets and roll its own Deployments.
#
# NO `Storage Blob Data Contributor`. AGCONN's objects are on Supabase and its
# pipeline never touches an Azure blob. Even after the data layer moves, the
# application would authenticate to Blob with an ACCOUNT KEY read from Key Vault
# rather than a managed identity — so a data-plane role for a principal that
# never exercises the data plane would be a standing grant with no purpose.
# ---------------------------------------------------------------------------

# Read its OWN vault. Get and list, never write: a compromised workflow must not
# be able to rewrite a credential the product then deploys.
resource "azurerm_role_assignment" "agconn_gha_kv" {
  count                = local.agconn_count
  scope                = data.azurerm_key_vault.agconn[0].id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azuread_service_principal.agconn_gha[0].object_id
}

# `Azure Kubernetes Service Cluster User` — enough to FETCH a kubeconfig and
# nothing more. Authorization INSIDE the cluster is Kubernetes' own.
#
# SUBSCRIPTION SCOPE, matching `gha_aks_user` and the other tenants', for the
# same reason: a role assignment is validated against a scope that must already
# exist, so naming the cluster resource would make this file fail on any rebuild
# where the cluster has not been created yet. There is one cluster here.
#
# The caveat worth restating: AKS keeps LOCAL ACCOUNTS enabled, and with those
# on, `Cluster User` returns admin-equivalent credentials. Closing that properly
# means disabling local accounts and moving to Entra RBAC with a namespace-scoped
# binding — a change to the cluster, not to this grant.
resource "azurerm_role_assignment" "agconn_gha_aks" {
  count                = local.agconn_count
  scope                = "/subscriptions/${var.subscription_id}"
  role_definition_name = "Azure Kubernetes Service Cluster User Role"
  principal_id         = azuread_service_principal.agconn_gha[0].object_id
}

# The HUMAN loading AGCONN's secrets needs WRITE, and being subscription Owner
# does NOT grant it — Key Vault's data plane is its own RBAC surface. Without
# this, `az keyvault secret set` fails with a 403 that says nothing about a
# missing role.
#
# This matters more for AGCONN than for the other tenants: with the data layer on
# Supabase, TERRAFORM GENERATES NOTHING FOR THIS VAULT. All ~45 values are loaded
# by hand, so this is the grant that makes the vault usable at all.
#
# It lands on whoever APPLIES this file, which is the other half of why it belongs
# in the bootstrap: applied by the release, the grant would have gone to the
# pipeline's service principal rather than to a person.
resource "azurerm_role_assignment" "agconn_operator_kv" {
  count                = local.agconn_count
  scope                = data.azurerm_key_vault.agconn[0].id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = data.azurerm_client_config.current.object_id
}

# SPARX's release identity needs WRITE on AGCONN's vault for the day
# `agconn_data_enabled` flips to true — at that point envs/azure generates six
# secrets (the two connection strings, the app password, and the storage pair)
# and writes them straight in rather than having a person transcribe values
# Terraform is already holding.
#
# Granted NOW rather than then, because it costs nothing and the alternative is
# discovering it as a 403 in the middle of the migration that flips the flag.
#
# READ THE ASYMMETRY, IT IS THE POINT:
#
#   sparx's release     Secrets OFFICER — it PROVISIONS. It mints the passwords
#                       and owns the resources those passwords open.
#   AGCONN's release    Secrets USER — it DEPLOYS. It reads the bundle and can
#                       never rewrite a credential it is about to ship.
#
# The rule that matters was never "no automation writes secrets" — that rule only
# ever produced a human transcribing values Terraform was already holding, which
# is where typos come from. The rule that matters is that the thing which DEPLOYS
# cannot rewrite what it deploys.
resource "azurerm_role_assignment" "agconn_sparx_release_kv" {
  count                = local.agconn_count
  scope                = data.azurerm_key_vault.agconn[0].id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = azuread_service_principal.gha.object_id
}

# ---------------------------------------------------------------------------
# Outputs — `terraform output agconn_github_setup` prints the commands verbatim.
# ---------------------------------------------------------------------------
output "agconn_github_setup" {
  description = "Repository VARIABLES (not secrets — these are public identifiers) to set on the AgConnect repo so its pipeline can authenticate."
  value = var.agconn_enabled ? [
    "gh variable set AZURE_CLIENT_ID       -R ${local.agconn_repo} -b '${azuread_application.agconn_gha[0].client_id}'",
    "gh variable set AZURE_TENANT_ID       -R ${local.agconn_repo} -b '${data.azurerm_client_config.current.tenant_id}'",
    "gh variable set AZURE_SUBSCRIPTION_ID -R ${local.agconn_repo} -b '${var.subscription_id}'",
    "gh variable set AZURE_KEY_VAULT_NAME  -R ${local.agconn_repo} -b '${var.agconn_key_vault_name}'",
  ] : []
}
