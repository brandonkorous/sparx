# ---------------------------------------------------------------------------
# WizeWorks — the CI identity for the PARENT COMPANY's own marketing site.
#
# wize.works is a co-tenant on this cluster like jotacular, kanNINJA and AGCONN:
# its own namespace, its own repository (brandonkorous/wizeworks), its own
# pipeline. It differs from all three in one way that shapes this whole file —
#
#   IT HAS NO SECRETS, SO IT HAS NO KEY VAULT.
#
# The site is a static marketing build. No database, no object storage, no
# analytics provider, no auth. `/api/contact` deliberately returns 503 rather
# than delivering, because choosing a mail provider is a privacy decision that
# has not been made. There is nothing for a vault to hold.
#
# That is a deliberate omission, not an unfinished one. AGCONN's own file makes
# the argument: "an empty vault and an idle server both look configured and are
# not." A vault here would be a name reserved, a resource to reason about, and a
# grant to audit, all protecting nothing.
#
# WHEN THAT CHANGES — the day contact delivery is switched on — it needs
# CONTACT_TO plus one provider credential. Add `kv-wizeworks-prod-cus` in
# terraform/envs/azure/wizeworks.tf and a `Key Vault Secrets User` assignment
# below, both modelled on AGCONN. Two secrets is still a thin case for a vault,
# but it is the right shape once there is anything at all.
#
# WHAT IS NOT HERE: the workloads. Terraform does not manage workloads in this
# environment. The Deployment, Service and namespace are Kustomize YAML in the
# wizeworks repo under `k8s/`. The only cluster-side changes sparx owns are the
# Caddy routing table (k8s/ingress/Caddyfile) and the TLS allow-list in
# wizeworks/services/api-rest/src/routes/internal/domain-check.ts — both already
# carry their wize.works entries.
#
# NOTE ON `data.azurerm_client_config.current`: declared once for this root
# module, in jotacular.tf. Do not re-declare it here.
# ---------------------------------------------------------------------------

variable "wizeworks_enabled" {
  description = <<-EOT
    Master switch for the WizeWorks pipeline identity.

    ON. Unlike the other tenants' switches this gates nothing billable — an app
    registration, a service principal and two federated credentials are free.
    It exists for symmetry and for the removal story: setting it false and
    applying takes the whole product's footprint in this subscription with it.
  EOT
  type        = bool
  default     = true
}

variable "wizeworks_github_branches" {
  description = <<-EOT
    Branches whose workflow runs may assume this identity. One credential is
    minted per branch, because Entra matches the subject exactly.

    Just `main`. The site deploys on push to main and nothing else does.
  EOT
  type        = set(string)
  default     = ["main"]
}

variable "wizeworks_github_subject_prefix" {
  description = <<-EOT
    The literal prefix of the OIDC `sub` claim GitHub mints for this repository.
    Everything after it (`:ref:refs/heads/main`, `:environment:prod`) is appended
    by the credentials below.

    THIS IS THE QUALIFIED FORM, WITH NUMERIC IDS, AND THAT IS NOT A COPY/PASTE
    ERROR FROM jotacular. GitHub qualifies the subject with owner and repository
    ids PER REPOSITORY, by age — older repositories keep the plain form. Read
    back on 2026-08-27:

        AgConnect  (id 1226714101)  repo:brandonkorous/AgConnect
        kanninja   (id 1251494871)  repo:brandonkorous/kanninja
        jotacular  (id 1341839746)  repo:brandonkorous@13042540/jotacular@1341839746
        wizeworks  (id 1349021052)  repo:brandonkorous@13042540/wizeworks@1349021052  <- this

    wizeworks is the NEWEST of the four, so it gets the qualified form. Copying
    AgConnect's plain `repo:owner/name` here would produce a credential that
    never matches, and Entra reports only

        "No matching federated identity record found for presented assertion
         subject '<subject>'"

    naming the value it RECEIVED and never the one it expected — so the diff has
    to be done by eye. jotDOJO lost a release to exactly this.

    This default was READ BACK rather than assembled:

        gh api repos/brandonkorous/wizeworks/actions/oidc/customization/sub \
          --jq .sub_claim_prefix

    Re-run that first if deploys start failing with AADSTS700213.
  EOT
  type        = string
  default     = "repo:brandonkorous@13042540/wizeworks@1349021052"

  validation {
    condition     = startswith(var.wizeworks_github_subject_prefix, "repo:")
    error_message = "wizeworks_github_subject_prefix must start with `repo:` — paste sub_claim_prefix verbatim, without a trailing colon."
  }

  validation {
    condition     = !endswith(var.wizeworks_github_subject_prefix, ":")
    error_message = "wizeworks_github_subject_prefix must NOT end with a colon — the credentials append `:ref:...` and `:environment:...` themselves."
  }
}

locals {
  wizeworks_count = var.wizeworks_enabled ? 1 : 0
  wizeworks_repo  = "brandonkorous/wizeworks"
}

# ---------------------------------------------------------------------------
# Identity — its own app registration, for the same reason each tenant has one:
# a federated credential's subject names the repository, so this identity can
# only ever be assumed by this repo's workflows, and this repo's workflows can
# never roll another product's Deployments.
# ---------------------------------------------------------------------------
resource "azuread_application" "wizeworks_gha" {
  count        = local.wizeworks_count
  display_name = "gha-wizeworks-prod"
  owners       = [data.azurerm_client_config.current.object_id]
}

resource "azuread_service_principal" "wizeworks_gha" {
  count     = local.wizeworks_count
  client_id = azuread_application.wizeworks_gha[0].client_id
  owners    = [data.azurerm_client_config.current.object_id]
}

resource "azuread_application_federated_identity_credential" "wizeworks_branch" {
  for_each = var.wizeworks_enabled ? var.wizeworks_github_branches : toset([])

  application_id = azuread_application.wizeworks_gha[0].id
  display_name   = "github-${each.value}"
  description    = "Pushes to ${each.value} in ${local.wizeworks_repo}."
  audiences      = ["api://AzureADTokenExchange"]
  issuer         = "https://token.actions.githubusercontent.com"
  subject        = "${var.wizeworks_github_subject_prefix}:ref:refs/heads/${each.value}"
}

# The environment-bound credential, minted even though the workflow does not
# currently declare `environment: prod`. It costs nothing and it is the one that
# is needed the moment someone adds a deployment gate — at which point the
# subject changes from `:ref:...` to `:environment:prod` and, without this, the
# deploy fails with the same unhelpful AADSTS700213 as a wrong prefix.
resource "azuread_application_federated_identity_credential" "wizeworks_environment" {
  count          = local.wizeworks_count
  application_id = azuread_application.wizeworks_gha[0].id
  display_name   = "github-environment-prod"
  description    = "Jobs bound to the `prod` GitHub Environment in ${local.wizeworks_repo}."
  audiences      = ["api://AzureADTokenExchange"]
  issuer         = "https://token.actions.githubusercontent.com"
  subject        = "${var.wizeworks_github_subject_prefix}:environment:prod"
}

# ---------------------------------------------------------------------------
# Permissions — exactly ONE, which is the whole point of a site with no secrets.
#
# SUBSCRIPTION SCOPE, matching every other tenant's, for the same reason: a role
# assignment is validated against a scope that must already exist, so naming the
# cluster resource would break any rebuild where the cluster has not been created
# yet. There is one cluster here.
#
# The caveat the other files restate and this one inherits: AKS keeps LOCAL
# ACCOUNTS enabled, and with those on, `Cluster User` returns admin-equivalent
# credentials. So this grant is broader in practice than it reads — this pipeline
# could roll another namespace's Deployments if it were told to. Closing that
# means disabling local accounts and moving to Entra RBAC with a
# namespace-scoped binding, which is a change to the CLUSTER and would fix it for
# all five tenants at once, not something to special-case here.
# ---------------------------------------------------------------------------
resource "azurerm_role_assignment" "wizeworks_gha_aks" {
  count                = local.wizeworks_count
  scope                = "/subscriptions/${var.subscription_id}"
  role_definition_name = "Azure Kubernetes Service Cluster User Role"
  principal_id         = azuread_service_principal.wizeworks_gha[0].object_id
}

# NO Key Vault role assignment, because there is no vault. See the header.
# NO `Key Vault Secrets Officer` for a human, for the same reason.
# NO AcrPull: images come from GHCR, pulled anonymously from a public package.

# ---------------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------------

# A client id identifies an application; it authenticates nothing on its own —
# possession of it grants no access without a federated subject match. That is
# why it becomes a repository VARIABLE rather than a secret, and why hiding it
# would only make a failed run harder to read.
output "wizeworks_client_id" {
  description = "Application (client) ID of gha-wizeworks-prod. Set as AZURE_CLIENT_ID on the wizeworks repo."
  value       = var.wizeworks_enabled ? azuread_application.wizeworks_gha[0].client_id : null
}

output "wizeworks_github_setup" {
  description = "Repository VARIABLES (not secrets — these are public identifiers) to set on the wizeworks repo so its pipeline can authenticate. No AZURE_KEY_VAULT_NAME: the site holds no secrets."
  value = var.wizeworks_enabled ? [
    "gh variable set AZURE_CLIENT_ID       -R ${local.wizeworks_repo} -b '${azuread_application.wizeworks_gha[0].client_id}'",
    "gh variable set AZURE_TENANT_ID       -R ${local.wizeworks_repo} -b '${data.azurerm_client_config.current.tenant_id}'",
    "gh variable set AZURE_SUBSCRIPTION_ID -R ${local.wizeworks_repo} -b '${var.subscription_id}'",
  ] : []
}
