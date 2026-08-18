# Declarative imports (Terraform 1.5+ `import` blocks) for pre-existing resources
# that were created out-of-band and now need to be adopted into state — so the
# next `terraform apply` does NOT fail with "Error 409: ... already exists".
#
# These run automatically during plan/apply (no manual `terraform import` against
# the GCS backend). Once an apply has succeeded and the resources are in state,
# the blocks become no-ops and can be deleted in a follow-up commit.
#
# ── google-client-id / google-client-secret ──────────────────────────────────
# The Google OAuth client credentials backing @wizeworks/auth's "Continue with
# Google" provider. The secret CONTAINERS were created manually in Secret Manager
# (values added out-of-band per module "secrets"); these blocks adopt the empty
# containers so module.secrets can manage them going forward. Import id uses the
# fully-qualified form: projects/{project}/secrets/{secret_id}.

import {
  to = module.secrets.google_secret_manager_secret.secrets["google-client-id"]
  id = "projects/${var.project_id}/secrets/google-client-id"
}

import {
  to = module.secrets.google_secret_manager_secret.secrets["google-client-secret"]
  id = "projects/${var.project_id}/secrets/google-client-secret"
}
