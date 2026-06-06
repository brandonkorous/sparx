variable "project_id" {
  type        = string
  description = "GCP project ID for Sparx."
}

variable "region" {
  type        = string
  default     = "us-central1"
  description = "Default GCP region."
}

variable "github_repos" {
  type        = set(string)
  default     = ["brandonkorous/sparx"]
  description = "GitHub repos (owner/name) allowed to impersonate the deployer SA via OIDC. A set so additional paths can be accepted transiently during an org/owner transfer."
}
