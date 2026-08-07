variable "subscription_id" {
  description = "Azure subscription id. From `az account show --query id -o tsv`."
  type        = string
}

variable "location" {
  description = <<-EOT
    Must match terraform/envs/azure so state lives beside what it describes.

    centralus is the current value there — the only region checked that satisfies
    BOTH constraints this subscription imposes: Postgres `OfferRestricted` is
    Disabled, and Standard_D2ads_v7 is offered at the lowest observed price. See
    that environment's variables.tf for the full method.
  EOT
  type        = string
  default     = "centralus"
}

variable "workload" {
  description = "Workload segment of resource names. Kept short — the storage account name caps at 24 lowercase alphanumeric characters."
  type        = string
  default     = "sparx"
}

variable "environment" {
  description = "Environment segment of resource names, and the GitHub Environment trusted by the federated credential."
  type        = string
  default     = "prod"
}

variable "github_owner" {
  description = "GitHub user or org that owns the repository."
  type        = string
  default     = "brandonkorous"
}

variable "key_vault_name" {
  description = <<-EOT
    Key Vault name. GLOBALLY unique across all of Azure (it is a DNS label),
    3-24 characters, alphanumerics and hyphens only, must start with a letter.

    The default matches the naming everything else here uses. If apply fails
    with a name-already-exists error, someone else in Azure holds it — or you
    previously destroyed a vault of this name with purge protection on and the
    name is reserved until its retention window expires. Pick another.
  EOT
  type        = string
  default     = "kv-sparx-prod-cus"

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9-]{1,22}[a-zA-Z0-9]$", var.key_vault_name))
    error_message = "3-24 chars, alphanumerics and hyphens, must start with a letter and not end with a hyphen."
  }
}

variable "key_vault_purge_protection" {
  description = <<-EOT
    Block permanent deletion of the vault and its secrets inside the soft-delete
    window — including by the Actions identity, which holds subscription
    Contributor.

    ON by default because the failure it prevents is unrecoverable: every
    platform credential gone, with no copy anywhere (that is the whole point of
    moving off the write-only repo secret).

    IRREVERSIBLE. Terraform cannot set this back to false once applied, and a
    destroyed vault reserves its NAME for the retention window, so a rebuild
    needs a new one. Set false only for a throwaway environment you expect to
    tear down.
  EOT
  type        = bool
  default     = true
}

variable "key_vault_soft_delete_retention_days" {
  description = <<-EOT
    How long a deleted secret stays recoverable. Soft delete cannot be disabled,
    so this only chooses the window. Azure allows 7-90.

    90 for production: the whole reason a secret store beats a repo secret is
    that a mistake is recoverable, and a short window quietly gives that back.
  EOT
  type        = number
  default     = 90

  validation {
    condition     = var.key_vault_soft_delete_retention_days >= 7 && var.key_vault_soft_delete_retention_days <= 90
    error_message = "Azure allows 7 to 90 days."
  }
}

variable "github_repository" {
  description = <<-EOT
    Repository name. Combined with github_owner into the federated credential
    `subject`, which Entra matches EXACTLY — a typo here does not fail at apply,
    it fails later as an opaque authentication error in Actions.
  EOT
  type        = string
  default     = "sparx"
}
