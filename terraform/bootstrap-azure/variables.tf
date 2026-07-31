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

variable "github_repository" {
  description = <<-EOT
    Repository name. Combined with github_owner into the federated credential
    `subject`, which Entra matches EXACTLY — a typo here does not fail at apply,
    it fails later as an opaque authentication error in Actions.
  EOT
  type        = string
  default     = "sparx"
}
