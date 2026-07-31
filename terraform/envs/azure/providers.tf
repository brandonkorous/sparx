# Azure environment — the cost-constrained deployment that replaces GKE.
#
# Budget context: $1000 of credit, targeted to last ~11 months at ~$90/mo. Every
# sizing decision in this environment is made against that number, and the
# reasoning is recorded next to each resource rather than in a separate doc, so
# nobody has to guess later why something is deliberately small.
#
# State lives in Azure Storage, created by terraform/bootstrap-azure. That
# backend is what allows GitHub Actions to run Terraform at all — a CI runner is
# ephemeral, so local state cannot be shared between runs.
#
# The storage account sits in its own resource group (`-tfstate`), deliberately
# separate from the workload, so a `terraform destroy` here can never take the
# state that describes it. Versioning and 30-day soft delete are on: a corrupted
# apply stays recoverable.
#
# Authentication is the caller's — `az login` locally, OIDC federation in
# Actions. No storage key is stored anywhere; `use_azuread_auth` makes the
# backend use Entra identity rather than a shared account key, which is why the
# bootstrap grants `Storage Blob Data Contributor` separately from Contributor.
terraform {
  required_version = ">= 1.9.0"

  backend "azurerm" {
    resource_group_name  = "rg-sparx-prod-cus-tfstate"
    storage_account_name = "stsparxprodcustfstate"
    container_name       = "tfstate"
    key                  = "envs/azure.tfstate"
    use_azuread_auth     = true
  }

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.14"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "azurerm" {
  features {
    resource_group {
      # Refuse to delete a resource group that still contains resources. The
      # whole platform lives in ONE group here, so a stray `terraform destroy`
      # would take the database with it.
      prevent_deletion_if_contains_resources = true
    }
  }
  subscription_id = var.subscription_id
}
