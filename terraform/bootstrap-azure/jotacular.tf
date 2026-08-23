# ---------------------------------------------------------------------------
# jotDOJO's CI identity — the privileged half of that product's onboarding.
#
# jotDOJO (jotacular.com) is a third product on this subscription, in its own
# repository, deploying into its own namespace on the shared cluster. Its
# DATABASE, KEY VAULT and BLOB ACCOUNT are in terraform/envs/azure/jotacular.tf.
# What is here is everything that environment is not permitted to create.
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
# exactly those two, which is why this file exists and why the rule is now
# written down in both places instead of being inferred from the fact that every
# other app registration in the repo happens to be in this directory.
#
# This file is applied BY A HUMAN with Owner and directory rights, like the rest
# of the bootstrap. It is not part of any pipeline.
# ---------------------------------------------------------------------------

variable "jotacular_enabled" {
  description = <<-EOT
    Master switch. Off leaves jotDOJO's repository with no Azure identity, which
    is the correct state until that repository is actually ready to deploy — an
    app registration nothing uses is a credential surface with no owner.

    Independent of the switch of the same name in terraform/envs/azure: these are
    separate Terraform states applied by different principals at different times,
    so neither can read the other's variables. Turn this one on when the identity
    is needed; that one governs the database, vault and storage.
  EOT
  type        = bool
  default     = true
}

variable "jotacular_github_repository" {
  description = <<-EOT
    `owner/repo` whose Actions runs may assume jotDOJO's Azure identity.

    VERIFIED against the repository's own remote on 2026-08-21: `git remote -v`
    in the checkout reports https://github.com/brandonkorous/jotacular.git.

    CASE MATTERS. GitHub's OIDC `sub` claim carries the repository's canonical
    casing, so the repo is `jotacular` here even though the local DIRECTORY is
    `jotDOJO` and the product is styled jotDOJO everywhere a human reads it.
    GitHub routes a browser to either spelling, which is exactly why the wrong
    one survives review: it works everywhere except the token exchange, where it
    produces "no matching federated identity credential" with nothing in the
    message pointing at the letter that is wrong.
  EOT
  type        = string
  default     = "brandonkorous/jotacular"

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.jotacular_github_repository))
    error_message = "jotacular_github_repository must be in `owner/repo` form."
  }
}

variable "jotacular_github_branches" {
  description = <<-EOT
    Branches whose pushes may assume the identity. One federated credential per
    entry; Entra matches a subject EXACTLY, with no wildcard for a branch.

    `main` only. The checkout was created by a `git init` old enough to default
    to `master`, and that rename has to actually happen before the first deploy
    or the workflow runs on a ref no credential here matches.
  EOT
  type        = set(string)
  default     = ["main"]
}

variable "jotacular_github_subject_prefix" {
  description = <<-EOT
    The literal prefix of the OIDC `sub` claim GitHub mints for this repository.
    Everything after it (`:ref:refs/heads/main`, `:environment:prod`) is appended
    by the credentials below.

    THIS IS NOT `repo:<owner>/<repo>`, AND THAT IS NOT A MISTAKE TO CORRECT.
    GitHub has begun qualifying the subject with the numeric OWNER and REPOSITORY
    ids, and it does so per repository. The two repos in this account disagree
    RIGHT NOW, both reporting `use_default: true`:

      sparx    (id 1251494871)   repo:brandonkorous/sparx
      jotacular  (id 1341839746)   repo:brandonkorous@13042540/jotacular@1341839746

    jotacular is the newer repository and gets the newer format. Nothing here
    chooses it and no setting on the repo turns it off, so the credential has to
    match what GitHub actually sends.

    This cost a red release. Entra matches the subject byte for byte and, on a
    mismatch, says only "No matching federated identity record found for
    presented assertion subject '<subject>'" — which names the value it received
    and never the value it expected, so the diff has to be done by eye against
    whatever is configured here.

    READ IT BACK FROM GITHUB rather than assembling it by hand:

        gh api repos/<owner>/<repo>/actions/oidc/customization/sub \
          --jq .sub_claim_prefix

    If jotDOJO ever stops authenticating with AADSTS700213, re-run that command
    first: GitHub changing the prefix under a working credential looks exactly
    like this failure.
  EOT
  type        = string
  default     = "repo:brandonkorous@13042540/jotacular@1341839746"

  validation {
    condition     = startswith(var.jotacular_github_subject_prefix, "repo:")
    error_message = "jotacular_github_subject_prefix must start with `repo:` — paste sub_claim_prefix verbatim, without a trailing colon."
  }

  validation {
    condition     = !endswith(var.jotacular_github_subject_prefix, ":")
    error_message = "jotacular_github_subject_prefix must NOT end with a colon — the credentials append `:ref:...` and `:environment:...` themselves."
  }
}

variable "jotacular_key_vault_name" {
  description = <<-EOT
    The vault terraform/envs/azure/jotacular.tf creates. Named here rather than
    referenced, because the two live in different Terraform states and this
    bootstrap must not take a dependency on that environment's outputs.

    Looked up below as a data source, which means THAT ENVIRONMENT MUST BE
    APPLIED FIRST. On a from-scratch rebuild the order is bootstrap (for state
    and the release identity) -> envs/azure -> this file. The failure if the
    order is wrong is a clean plan-time "Key Vault not found", not a mystery.
  EOT
  type        = string
  # THE VAULT IS STILL CALLED jotdojo. This is a LOOKUP of a vault that already
  # exists, not a declaration of one — and the physical name did not move with
  # the rename, because renaming a Key Vault destroys it and reserves the old
  # name for the retention window. See the note at the head of
  # terraform/envs/azure/jotacular.tf. A miss here is not a diff, it is a hard
  # plan error: "no Key Vault found".
  default = "kv-jotdojo-prod-cus"
}

locals {
  jotacular_count = var.jotacular_enabled ? 1 : 0
  jotacular_repo  = var.jotacular_github_repository
}

# The vault whose secrets this identity may read. A LOOKUP, not a resource — it
# belongs to envs/azure and is created there.
data "azurerm_key_vault" "jotacular" {
  count               = local.jotacular_count
  name                = var.jotacular_key_vault_name
  resource_group_name = "rg-${var.workload}-${var.environment}-${local.jotacular_loc}"
}

locals {
  # The same short-region map envs/azure uses to build resource names. Duplicated
  # rather than shared because these are separate root modules with no common
  # module between them; keep the two in step if a region is ever added.
  jotacular_location_short = {
    eastus         = "eus"
    eastus2        = "eus2"
    centralus      = "cus"
    southcentralus = "scus"
    northcentralus = "ncus"
    westus         = "wus"
    westus2        = "wus2"
    westus3        = "wus3"
    canadacentral  = "cac"
    northeurope    = "neu"
    westeurope     = "weu"
    uksouth        = "uks"
  }
  jotacular_loc = local.jotacular_location_short[var.location]
}

# ---------------------------------------------------------------------------
# The identity itself.
#
# A SECOND app registration rather than reusing this repo's. A federated
# credential's subject names the repository, so sparx's identity cannot be
# assumed from jotDOJO's workflows even deliberately — and the separation is
# worth keeping regardless: jotDOJO's pipeline should never hold a token that can
# read sparx's Key Vault or roll sparx's Deployments.
# ---------------------------------------------------------------------------
resource "azuread_application" "jotacular_gha" {
  count        = local.jotacular_count
  display_name = "gha-jotacular-prod"
  owners       = [data.azurerm_client_config.current.object_id]
}

resource "azuread_service_principal" "jotacular_gha" {
  count     = local.jotacular_count
  client_id = azuread_application.jotacular_gha[0].client_id
  owners    = [data.azurerm_client_config.current.object_id]
}

resource "azuread_application_federated_identity_credential" "jotacular_branch" {
  for_each = var.jotacular_enabled ? var.jotacular_github_branches : toset([])

  application_id = azuread_application.jotacular_gha[0].id
  display_name   = "github-${each.value}"
  description    = "Pushes to ${each.value} in ${local.jotacular_repo}."
  audiences      = ["api://AzureADTokenExchange"]
  issuer         = "https://token.actions.githubusercontent.com"
  subject        = "${var.jotacular_github_subject_prefix}:ref:refs/heads/${each.value}"
}

resource "azuread_application_federated_identity_credential" "jotacular_environment" {
  count          = local.jotacular_count
  application_id = azuread_application.jotacular_gha[0].id
  display_name   = "github-environment-prod"
  description    = "Jobs bound to the `prod` GitHub Environment in ${local.jotacular_repo}."
  audiences      = ["api://AzureADTokenExchange"]
  issuer         = "https://token.actions.githubusercontent.com"
  subject        = "${var.jotacular_github_subject_prefix}:environment:prod"
}

# ---------------------------------------------------------------------------
# Permissions — three, and deliberately not four.
#
# NO SUBSCRIPTION CONTRIBUTOR. sparx's Actions identity holds it because sparx's
# pipeline runs Terraform and creates infrastructure. jotDOJO's does not: its
# infrastructure is created here and in envs/azure, so its identity needs only
# enough to read its secrets and roll its own Deployments.
#
# NO `Storage Blob Data Contributor` EITHER, which the first draft of this had.
# It would have been cargo — jotDOJO's app authenticates to Blob with an ACCOUNT
# KEY read from Key Vault (packages/storage/src/resolve.ts takes
# AZURE_STORAGE_ACCOUNT + AZURE_STORAGE_KEY, not a managed identity), and the
# release workflow never touches a blob. A data-plane role for a principal that
# never exercises the data plane is a standing grant with no purpose.
# ---------------------------------------------------------------------------

# Read its OWN vault. Get and list, never write: a compromised workflow must not
# be able to rewrite a credential the product then deploys.
resource "azurerm_role_assignment" "jotacular_gha_kv" {
  count                = local.jotacular_count
  scope                = data.azurerm_key_vault.jotacular[0].id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azuread_service_principal.jotacular_gha[0].object_id
}

# `Azure Kubernetes Service Cluster User` — enough to FETCH a kubeconfig and
# nothing more. Authorization INSIDE the cluster is Kubernetes' own.
#
# SUBSCRIPTION SCOPE, matching `gha_aks_user` above it, and for the same reason:
# a role assignment is validated against a scope that must already exist, so
# naming the cluster resource would make this file fail on any rebuild where the
# cluster has not been created yet. There is one cluster in this subscription.
#
# The caveat worth stating: AKS here keeps LOCAL ACCOUNTS enabled, and with those
# on, `Cluster User` returns admin-equivalent credentials. Closing that properly
# means disabling local accounts and moving the cluster to Entra RBAC with a
# namespace-scoped binding — a change to the cluster, not to this grant. Recorded
# so the role reads as what it currently is rather than what its name suggests.
resource "azurerm_role_assignment" "jotacular_gha_aks" {
  count                = local.jotacular_count
  scope                = "/subscriptions/${var.subscription_id}"
  role_definition_name = "Azure Kubernetes Service Cluster User Role"
  principal_id         = azuread_service_principal.jotacular_gha[0].object_id
}

# The HUMAN loading jotDOJO's secrets needs WRITE, and being subscription Owner
# does NOT grant it — Key Vault's data plane is its own RBAC surface. Without
# this, `az keyvault secret set` fails with a 403 that says nothing about a
# missing role. Same trap as `operator_kv_secrets` on the sparx vault, same fix.
#
# This lands on whoever APPLIES this file, which is the other half of why it
# belongs in the bootstrap: applied by the release, the grant would have gone to
# the pipeline's service principal rather than to a person.
resource "azurerm_role_assignment" "jotacular_operator_kv" {
  count                = local.jotacular_count
  scope                = data.azurerm_key_vault.jotacular[0].id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = data.azurerm_client_config.current.object_id
}

# SPARX's release identity also needs WRITE on jotDOJO's vault, because six of
# jotDOJO's eight required secrets are now generated by `envs/azure` and written
# straight into the vault rather than transcribed by a person
# (`azurerm_key_vault_secret.jotacular`).
#
# READ THE ASYMMETRY HERE, IT IS THE WHOLE POINT. Two pipelines touch this vault
# and they hold deliberately different rights:
#
#   sparx's release      Secrets OFFICER — it PROVISIONS. It mints the passwords
#                        and owns the resources those passwords open.
#   jotDOJO's release    Secrets USER — it DEPLOYS. It reads the bundle and can
#                        never rewrite a credential it is about to ship.
#
# The rule that matters was never "no automation writes secrets" — that rule only
# ever produced a human transcribing values Terraform was already holding, which
# is where typos come from. The rule that matters is that the thing which DEPLOYS
# cannot rewrite what it deploys, and splitting the two identities is what
# enforces it.
#
# Contributor does NOT imply this. Key Vault's data plane is its own RBAC
# surface, so without this assignment the release fails at
# `azurerm_key_vault_secret` with a 403 that never mentions a missing role.
resource "azurerm_role_assignment" "jotacular_sparx_release_kv" {
  count                = local.jotacular_count
  scope                = data.azurerm_key_vault.jotacular[0].id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = azuread_service_principal.gha.object_id
}

# ---------------------------------------------------------------------------
# Outputs — `terraform output jotacular_github_setup` prints the commands verbatim.
# ---------------------------------------------------------------------------
output "jotacular_github_setup" {
  description = "Repository variables to set on the jotDOJO repo so its pipeline can authenticate."
  value = var.jotacular_enabled ? [
    "gh variable set AZURE_CLIENT_ID       -R ${local.jotacular_repo} -b '${azuread_application.jotacular_gha[0].client_id}'",
    "gh variable set AZURE_TENANT_ID       -R ${local.jotacular_repo} -b '${data.azurerm_client_config.current.tenant_id}'",
    "gh variable set AZURE_SUBSCRIPTION_ID -R ${local.jotacular_repo} -b '${data.azurerm_client_config.current.subscription_id}'",
    "gh variable set AZURE_KEY_VAULT_NAME  -R ${local.jotacular_repo} -b '${var.jotacular_key_vault_name}'",
  ] : []
}
