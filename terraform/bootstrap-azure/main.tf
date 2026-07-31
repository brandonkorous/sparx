# Azure bootstrap — the ONE thing applied from a laptop, ever.
#
# It exists to break a chicken-and-egg: GitHub Actions cannot run Terraform
# against Azure until something has already created
#   (a) a remote state backend — a CI runner is ephemeral, so local state cannot
#       be shared between runs, and
#   (b) an identity for Actions to authenticate as.
# Neither can be created by the pipeline that depends on them.
#
# Everything else — terraform/envs/azure, image builds, cluster deploys, database
# migrations — runs in Actions. If you find yourself running `az` or `kubectl`
# against this platform by hand for anything other than READING state, that is a
# gap in the automation, not a workflow.
#
# Authentication is OIDC (workload identity federation), NOT a client secret.
# GitHub mints a short-lived token per run and Entra trusts it for a specific
# repo + ref. There is no credential to store in GitHub, rotate, or leak — the
# only things in repo secrets are ids, which are not sensitive.
#
#   cd terraform/bootstrap-azure
#   terraform init
#   terraform apply -var="subscription_id=$(az account show --query id -o tsv)"
#
# Requires permission to create an App Registration in Entra ID — a TENANT-level
# permission, separate from subscription RBAC. If apply fails with an
# authorization error on azuread_application, that is what is missing.

terraform {
  required_version = ">= 1.9.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.14"
    }
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 3.0"
    }
  }

  # Deliberately LOCAL state. This describes only the bootstrap itself; putting
  # it in the storage account it creates would be its own chicken-and-egg. It is
  # also near-static — applied once, rarely touched.
  #
  # It contains no secrets: OIDC means there is no client secret to leak. Losing
  # this file costs a `terraform import`, not an outage.
}

provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
}

provider "azuread" {}

data "azurerm_client_config" "current" {}

locals {
  location_short = {
    eastus    = "eus"
    eastus2   = "eus2"
    centralus = "cus"
    westus    = "wus"
    westus2   = "wus2"
    westus3   = "wus3"
  }
  loc = local.location_short[var.location]

  # Matches terraform/envs/azure so the two read as one system.
  suffix = "${var.workload}-${var.environment}-${local.loc}"

  repo = "${var.github_owner}/${var.github_repository}"

  tags = {
    platform    = "sparx"
    workload    = var.workload
    environment = var.environment
    purpose     = "bootstrap"
    managed     = "terraform"
  }
}

# ---------------------------------------------------------------------------
# Terraform state backend
#
# A SEPARATE resource group from the workload, on purpose: a `terraform destroy`
# of terraform/envs/azure must never be able to take the state that describes it.
# ---------------------------------------------------------------------------
resource "azurerm_resource_group" "tfstate" {
  name     = "rg-${local.suffix}-tfstate"
  location = var.location
  tags     = local.tags
}

# Storage account names are GLOBALLY unique, 3-24 chars, lowercase alphanumeric
# ONLY — no hyphens. That is the tightest naming constraint in Azure and the
# reason the workload prefix is kept short. Here: "stsparxprodcustfstate" = 21.
resource "azurerm_storage_account" "tfstate" {
  name                = "st${replace(local.suffix, "-", "")}tfstate"
  resource_group_name = azurerm_resource_group.tfstate.name
  location            = azurerm_resource_group.tfstate.location

  account_tier             = "Standard"
  account_replication_type = "LRS" # cheapest; state is recreatable, not precious
  min_tls_version          = "TLS1_2"

  # State holds the Postgres admin password in plaintext. Nothing about it may
  # ever be reachable anonymously.
  allow_nested_items_to_be_public = false

  blob_properties {
    versioning_enabled = true # a corrupted apply stays recoverable
    delete_retention_policy {
      days = 30
    }
  }

  tags = local.tags

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_storage_container" "tfstate" {
  name                  = "tfstate"
  storage_account_id    = azurerm_storage_account.tfstate.id
  container_access_type = "private"
}

# ---------------------------------------------------------------------------
# GitHub Actions identity
# ---------------------------------------------------------------------------
resource "azuread_application" "gha" {
  display_name = "gha-${local.suffix}"
  owners       = [data.azurerm_client_config.current.object_id]
}

resource "azuread_service_principal" "gha" {
  client_id = azuread_application.gha.client_id
  owners    = [data.azurerm_client_config.current.object_id]
}

# One federated credential per trusted GitHub context. `subject` is matched
# EXACTLY by Entra — there are no wildcards — so each context a workflow may run
# in needs its own entry.
#
# That strictness is the security property: a fork's pull_request run executes
# under a different subject and simply cannot assume this identity.

# Pushes to the default branch. The only context allowed to APPLY.
resource "azuread_application_federated_identity_credential" "main_branch" {
  application_id = azuread_application.gha.id
  display_name   = "gh-main"
  description    = "Pushes to main on ${local.repo} — the apply path."
  audiences      = ["api://AzureADTokenExchange"]
  issuer         = "https://token.actions.githubusercontent.com"
  subject        = "repo:${local.repo}:ref:refs/heads/main"
}

# Pull requests. PLAN ONLY — the workflow must never call apply in this context.
# Enforced in the workflow, not here; Entra cannot distinguish a plan from an
# apply, it only proves who is calling.
resource "azuread_application_federated_identity_credential" "pull_request" {
  application_id = azuread_application.gha.id
  display_name   = "gh-pull-request"
  description    = "Pull requests on ${local.repo} — plan only."
  audiences      = ["api://AzureADTokenExchange"]
  issuer         = "https://token.actions.githubusercontent.com"
  subject        = "repo:${local.repo}:pull_request"
}

# A named GitHub Environment. Kept separate from the branch credential so the
# apply path can later require a human reviewer without also gating plans.
resource "azuread_application_federated_identity_credential" "environment" {
  application_id = azuread_application.gha.id
  display_name   = "gh-env-${var.environment}"
  description    = "Runs targeting the '${var.environment}' GitHub Environment."
  audiences      = ["api://AzureADTokenExchange"]
  issuer         = "https://token.actions.githubusercontent.com"
  subject        = "repo:${local.repo}:environment:${var.environment}"
}

# ---------------------------------------------------------------------------
# Permissions
#
# Contributor at SUBSCRIPTION scope, because terraform/envs/azure creates its own
# resource group and AKS creates a second one for the nodes — a group-scoped
# assignment could do neither. Contributor cannot grant roles, so this identity
# cannot escalate its own privileges.
# ---------------------------------------------------------------------------
resource "azurerm_role_assignment" "gha_contributor" {
  scope                = "/subscriptions/${var.subscription_id}"
  role_definition_name = "Contributor"
  principal_id         = azuread_service_principal.gha.object_id
}

# Contributor grants control-plane rights over the storage ACCOUNT but not access
# to the DATA inside it. Reading and writing state blobs needs this separately —
# a genuinely easy one to miss, and it fails at `terraform init`, not at plan.
resource "azurerm_role_assignment" "gha_blob" {
  scope                = azurerm_storage_account.tfstate.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azuread_service_principal.gha.object_id
}

# Lets the deploy workflow run `az aks get-credentials`. "Cluster User" only
# fetches the kubeconfig; authority INSIDE the cluster comes from the next one.
resource "azurerm_role_assignment" "gha_aks_user" {
  scope                = "/subscriptions/${var.subscription_id}"
  role_definition_name = "Azure Kubernetes Service Cluster User Role"
  principal_id         = azuread_service_principal.gha.object_id
}

resource "azurerm_role_assignment" "gha_aks_admin" {
  scope                = "/subscriptions/${var.subscription_id}"
  role_definition_name = "Azure Kubernetes Service RBAC Cluster Admin"
  principal_id         = azuread_service_principal.gha.object_id
}

# The HUMAN running Terraform needs blob data access too, and this is the single
# easiest thing to miss: being subscription Owner or Contributor does NOT grant
# it. The data plane is a separate RBAC surface.
#
# Without this, `terraform init -migrate-state` against the azurerm backend fails
# with a bare `403 AuthorizationPermissionMismatch` — before plan, with nothing
# in the message pointing at the missing role. (Observed 2026-07-31, immediately
# after writing the README paragraph warning about exactly this.)
#
# Scoped to the storage account, not the subscription: this grants read/write of
# Terraform state, nothing else.
resource "azurerm_role_assignment" "operator_blob" {
  scope                = azurerm_storage_account.tfstate.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = data.azurerm_client_config.current.object_id
}
