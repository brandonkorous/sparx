variable "region" {
  type = string
}

variable "repository_id" {
  type    = string
  default = "sparx"
}

variable "keep_versions" {
  type        = number
  default     = 3
  description = <<-EOT
    Versions retained per package, regardless of age. Three is the deliberate
    target: what is deployed, what you would roll back to, and one spare.

    This is a KEEP rule, so it only carves an exception out of the DELETE rules —
    raising it does not delete anything, and it alone will not bound storage. The
    thing that actually prunes is `delete-superseded` in main.tf.
  EOT
}

variable "pinned_tag_prefixes" {
  type        = list(string)
  default     = ["v1.188"]
  description = <<-EOT
    Tag prefixes kept forever, on top of `keep_versions`.

    Holds the release the GKE fallback is running. That release is far older than
    the three most recent versions, so without this the delete rule would remove
    the images out from under a cluster being kept ALIVE as a fallback — pods
    keep serving from layers already on the node, but any reschedule turns into
    ImagePullBackOff.

    Roll this forward when the fallback is redeployed; empty it when GKE is
    retired.
  EOT
}
