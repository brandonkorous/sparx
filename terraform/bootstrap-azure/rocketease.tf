# ---------------------------------------------------------------------------
# RocketEase's CI identity.
#
# Separate from terraform/envs/azure/rocketease.tf because of WHO APPLIES IT, not
# because of what it contains. This state creates directory objects — an app
# registration is tenant-wide — and that needs Microsoft Graph rights the release
# identity does not have. The environment state is applied by the release; this
# one is applied by a human. Putting an `azuread` resource in the other file
# fails with `Authorization_RequestDenied` no matter how the provider is
# configured, which is how jotDOJO's identity ended up here.
#
# ORDER MATTERS: terraform/envs/azure must be applied FIRST, because the vault
# below is a data source rather than a resource. Wrong order gives a plan-time
# "Key Vault not found", which is a clean failure rather than a mystery.
# ---------------------------------------------------------------------------

variable "rocketease_enabled" {
  description = <<-EOT
    Master switch. Off leaves the RocketEase repository with no Azure identity,
    which is correct until that repository is ready to deploy — an app
    registration nothing uses is a credential surface with no owner.

    Independent of the switch of the same name in terraform/envs/azure: separate
    states, applied by different principals at different times, so neither can
    read the other's variables.
  EOT
  type        = bool
  default     = true
}

variable "rocketease_github_repository" {
  description = <<-EOT
    `owner/repo` whose Actions runs may assume RocketEase's Azure identity.

    Entra matches a federated subject EXACTLY, so a fork, a rename, or a
    different repo under the same owner produces a different subject and simply
    cannot authenticate.

    NOTE THE CAPITALISATION: the repository is `RocketEase`, not `rocketease`.
    GitHub is case-insensitive when resolving it but the OIDC subject carries the
    canonical case, and Entra compares byte for byte.

    Verified 2026-08-29 against the GitHub API rather than transcribed from a
    directory name: `gh api repos/brandonkorous/RocketEase` resolves and its
    default branch is `main`.
  EOT
  type        = string
  default     = "brandonkorous/RocketEase"

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.rocketease_github_repository))
    error_message = "rocketease_github_repository must be in `owner/repo` form."
  }
}

variable "rocketease_github_branches" {
  description = <<-EOT
    Branches whose pushes may assume the identity. One federated credential per
    entry; Entra has no wildcard for a branch.

    `main` only, confirmed to be the repository's actual default branch.

    Adding one later is free: credentials cost nothing, an app supports 20, and a
    credential for a ref that never receives a push is inert.
  EOT
  type        = set(string)
  default     = ["main"]
}

variable "rocketease_github_subject_prefix" {
  description = <<-EOT
    The literal prefix of the OIDC `sub` claim GitHub mints for this repository.
    Everything after it (`:ref:refs/heads/main`, `:environment:prod`) is appended
    by the credentials below.

    THIS IS THE NUMERICALLY-QUALIFIED FORM, AND THAT IS NOT A TYPO TO "FIX" BY
    COPYING kanninja's. GitHub began qualifying the subject with numeric owner
    and repository ids, and it does so PER REPOSITORY, by age. Read back on
    2026-08-29:

        kanninja    repo:brandonkorous/kanninja
        jotacular   repo:brandonkorous@13042540/jotacular@1341839746
        RocketEase  repo:brandonkorous@13042540/RocketEase@1350407459   <- this

    RocketEase is the NEWEST repository of the three and gets the new format.
    Nothing here chooses it and no repository setting turns it on or off — the
    credential has to match what GitHub actually sends.

    This distinction cost jotDOJO a red release in one direction and kanNINJA one
    in the other. Entra matches byte for byte and, on a mismatch, reports only
    "No matching federated identity record found for presented assertion subject
    '<subject>'" — naming the value it RECEIVED and never the value it expected.

    READ IT BACK rather than assembling it by hand:
        gh api repos/<owner>/<repo>/actions/oidc/customization/sub \
          --jq .sub_claim_prefix

    If RocketEase ever starts failing with AADSTS700213, re-run that first:
    GitHub changing the prefix under a working credential looks exactly like this
    failure.
  EOT
  type        = string
  default     = "repo:brandonkorous@13042540/RocketEase@1350407459"

  validation {
    condition     = startswith(var.rocketease_github_subject_prefix, "repo:")
    error_message = "rocketease_github_subject_prefix must start with `repo:` — paste sub_claim_prefix verbatim, without a trailing colon."
  }

  validation {
    condition     = !endswith(var.rocketease_github_subject_prefix, ":")
    error_message = "rocketease_github_subject_prefix must NOT end with a colon — the credentials append `:ref:...` and `:environment:...` themselves."
  }
}

variable "rocketease_key_vault_name" {
  description = <<-EOT
    The vault terraform/envs/azure/rocketease.tf creates. NAMED here rather than
    referenced, because the two live in different Terraform states and this
    bootstrap must not take a dependency on that environment's outputs.

    Keep in step with the variable of the same name over there.
  EOT
  type        = string
  default     = "kv-rocketease-prod-cus"
}

locals {
  rocketease_count = var.rocketease_enabled ? 1 : 0
  rocketease_repo  = var.rocketease_github_repository
}

# The vault lives in the WORKLOAD resource group (rg-sparx-prod-cus), not the
# tfstate group this file otherwise deals in.
data "azurerm_key_vault" "rocketease" {
  count               = local.rocketease_count
  name                = var.rocketease_key_vault_name
  resource_group_name = "rg-${var.workload}-${var.environment}-${local.loc}"
}

# ---------------------------------------------------------------------------
# The identity itself
# ---------------------------------------------------------------------------
resource "azuread_application" "rocketease_gha" {
  count        = local.rocketease_count
  display_name = "gha-rocketease-prod"
  owners       = [data.azurerm_client_config.current.object_id]
}

resource "azuread_service_principal" "rocketease_gha" {
  count     = local.rocketease_count
  client_id = azuread_application.rocketease_gha[0].client_id
  owners    = [data.azurerm_client_config.current.object_id]
}

resource "azuread_application_federated_identity_credential" "rocketease_branch" {
  for_each = var.rocketease_enabled ? var.rocketease_github_branches : toset([])

  application_id = azuread_application.rocketease_gha[0].id
  display_name   = "github-${each.value}"
  description    = "Pushes to ${each.value} in ${local.rocketease_repo}."
  audiences      = ["api://AzureADTokenExchange"]
  issuer         = "https://token.actions.githubusercontent.com"
  subject        = "${var.rocketease_github_subject_prefix}:ref:refs/heads/${each.value}"
}

# A second credential for jobs bound to a `prod` GitHub Environment. GitHub mints
# an ENVIRONMENT subject for those rather than a ref subject, so a workflow that
# gains an `environment: prod` line stops matching the branch credential above
# and starts matching this one. Having both means adding a manual approval gate
# later is a workflow change and not an Azure change.
resource "azuread_application_federated_identity_credential" "rocketease_environment" {
  count          = local.rocketease_count
  application_id = azuread_application.rocketease_gha[0].id
  display_name   = "github-environment-prod"
  description    = "Jobs bound to the `prod` GitHub Environment in ${local.rocketease_repo}."
  audiences      = ["api://AzureADTokenExchange"]
  issuer         = "https://token.actions.githubusercontent.com"
  subject        = "${var.rocketease_github_subject_prefix}:environment:prod"
}

# ---------------------------------------------------------------------------
# What that identity may do
#
# Deliberately NOT subscription Contributor. RocketEase's pipeline deploys
# workloads; it does not manage infrastructure. Terraform for its database, vault
# and storage is applied from terraform/envs/azure by the sparx release, so the
# pipeline needs exactly two capabilities: read its own secrets, and get a
# kubeconfig.
# ---------------------------------------------------------------------------

# Scoped to ROCKETEASE'S VAULT, which is the entire reason it has one. The same
# role on a shared vault would grant read access to every other product's
# credentials in it.
resource "azurerm_role_assignment" "rocketease_gha_kv" {
  count                = local.rocketease_count
  scope                = data.azurerm_key_vault.rocketease[0].id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azuread_service_principal.rocketease_gha[0].object_id
}

# `Cluster User` grants a kubeconfig, NOT authority inside the cluster — with AKS
# local accounts enabled, the returned admin-less credential is what `kubectl`
# then presents. It is subscription-scoped because the role has to be resolvable
# before the cluster is looked up by name.
#
# NOTE for the day Entra integration is switched on: this role stops being
# sufficient and in-cluster RBAC becomes the thing to grant. Until then the
# namespace boundary is a convention the pipeline honours, not one the cluster
# enforces.
resource "azurerm_role_assignment" "rocketease_gha_aks" {
  count                = local.rocketease_count
  scope                = "/subscriptions/${var.subscription_id}"
  role_definition_name = "Azure Kubernetes Service Cluster User Role"
  principal_id         = azuread_service_principal.rocketease_gha[0].object_id
}

# The human operator: WRITE access, so the secrets Terraform does not own (SMTP,
# Stripe, Anthropic, OpenAI, the provider OAuth pairs, and above all
# TOKEN-MASTER-KEY) can be loaded with `az keyvault secret set`. Secrets User
# above is read-only and cannot do it.
resource "azurerm_role_assignment" "rocketease_operator_kv" {
  count                = local.rocketease_count
  scope                = data.azurerm_key_vault.rocketease[0].id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = data.azurerm_client_config.current.object_id
}

# The SPARX release identity, which applies terraform/envs/azure and therefore
# has to be able to WRITE the six secrets that file generates. Without this the
# apply creates the vault and then 403s on its own secrets.
resource "azurerm_role_assignment" "rocketease_sparx_release_kv" {
  count                = local.rocketease_count
  scope                = data.azurerm_key_vault.rocketease[0].id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = azuread_service_principal.gha.object_id
}

# ---------------------------------------------------------------------------
output "rocketease_github_setup" {
  description = "Repository VARIABLES (not secrets — these are public identifiers) to set on the RocketEase repo so its pipeline can authenticate."
  value = var.rocketease_enabled ? [
    "gh variable set AZURE_CLIENT_ID       -R ${local.rocketease_repo} -b '${azuread_application.rocketease_gha[0].client_id}'",
    "gh variable set AZURE_TENANT_ID       -R ${local.rocketease_repo} -b '${data.azurerm_client_config.current.tenant_id}'",
    "gh variable set AZURE_SUBSCRIPTION_ID -R ${local.rocketease_repo} -b '${var.subscription_id}'",
    "gh variable set AZURE_KEY_VAULT_NAME  -R ${local.rocketease_repo} -b '${var.rocketease_key_vault_name}'",
  ] : []
}
