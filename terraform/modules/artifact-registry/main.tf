# Artifact Registry, with retention that ACTUALLY DELETES.
#
# THE BUG THIS FIXES, because it cost real money: the previous policy set was
#
#     KEEP   most_recent_versions = 10
#     DELETE tag_state = UNTAGGED, older_than = 7d
#
# and it never removed a single image. A KEEP policy does not delete anything —
# it only carves exceptions out of a DELETE policy. The one DELETE rule matched
# UNTAGGED versions, and build-images-gcp.yml pushes THREE tags on every image
# (`:$SHA`, `:$VERSION`, `:latest`), so essentially nothing was ever untagged.
# Every commit's images lived forever.
#
# The repository reached **2.95 TB** — roughly $295/month at Artifact Registry's
# ~$0.10/GB, on a project whose whole budget was meant to be small. Nothing
# alerted, because the workflow that was supposed to prune (cleanup-images-gcp)
# was manual AND defaulted to dry_run=true, so the rare manual run deleted
# nothing either.
#
# Retention is expressed SERVER-SIDE here rather than in a scheduled workflow on
# purpose: a policy cannot silently stop running, needs no runner, no auth, and
# no schedule to drift. GHCR has no equivalent, which is why the Azure side does
# need a cron (.github/workflows/cleanup-images-ghcr.yml).
#
# PRECEDENCE: KEEP always beats DELETE. So the two KEEP rules below are the
# carve-outs, and the DELETE rules apply to everything else.
resource "google_artifact_registry_repository" "sparx" {
  location      = var.region
  repository_id = var.repository_id
  format        = "DOCKER"
  description   = "Sparx container images"

  # Never prune below three per package: the deployed one, the one you would
  # roll back to, and one more. This is the retention target.
  cleanup_policies {
    id     = "keep-recent-3"
    action = "KEEP"
    most_recent_versions {
      keep_count = var.keep_versions
    }
  }

  # Pin whatever the GKE fallback is actually running.
  #
  # `keep-recent-3` protects the three NEWEST versions, and the fallback's
  # release is far older than that — every build since has pushed past it. Left
  # unprotected, the delete rule below would remove the images of a cluster
  # deliberately kept alive as a fallback. Running pods survive (the layers are
  # already on the node), but any reschedule becomes ImagePullBackOff and the
  # fallback dies quietly, at exactly the moment you reach for it.
  #
  # Update this prefix when the fallback is rolled forward, and delete the whole
  # rule when GKE is retired.
  cleanup_policies {
    id     = "keep-gke-fallback-release"
    action = "KEEP"
    condition {
      tag_state    = "TAGGED"
      tag_prefixes = var.pinned_tag_prefixes
    }
  }

  # The rule that was missing. Everything not covered by a KEEP above and older
  # than a day goes — tagged or not.
  #
  # A day rather than zero so an in-flight build, or a tag pushed minutes ago,
  # is never racing the policy. In steady state the effect is the retention
  # target: three versions per package.
  cleanup_policies {
    id     = "delete-superseded"
    action = "DELETE"
    condition {
      older_than = "86400s"
    }
  }

  # Untagged layers are pure waste — a failed or superseded push with no
  # reference. Shorter fuse than the rule above; nothing rolls back to these.
  cleanup_policies {
    id     = "delete-untagged-1d"
    action = "DELETE"
    condition {
      tag_state  = "UNTAGGED"
      older_than = "86400s"
    }
  }
}
