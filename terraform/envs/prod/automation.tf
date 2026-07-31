# automation-worker — the Automation engine runtime (docs/81, docs/84 Slice D).
#
# Unlike the Pub/Sub-push workers in serverless.tf, this service is driven by a
# Cloud Scheduler tick (the schedule + run advance ticks). The event-fan-in push
# subscription on `automation.trigger` is DEFERRED to Slice E — that topic does
# not exist yet. The push handler is already wired in the worker, so when Slice E
# provisions the topic + subscription, no code change is needed here beyond the
# subscription block (marked below).
#
# Connection: sparx_app via the `database-url-cloudrun` secret (the Cloud-Run
# variant of `database-url` — same creds, PgBouncer internal-LB host instead of
# the kube-DNS name Cloud Run can't resolve; see main.tf). The engine's
# cross-tenant discovery runs through SECURITY DEFINER helpers (migration
# 20260731000000), so NO owner/BYPASSRLS connection is required (docs/16 §4: no
# ambient RLS bypass).
#
# Auth model:
#   - Cloud Scheduler authenticates to Cloud Run with an OIDC token minted as the
#     dedicated `automation-scheduler` SA, which holds roles/run.invoker on the
#     service. The worker additionally verifies the OIDC `email` claim matches
#     (TICK_INVOKER_SA) — no shared secret lands in the scheduler-job config.
#
# Cloud Scheduler API enablement lives in terraform/bootstrap (cloudscheduler.googleapis.com).

# ─── Runtime service account ──────────────────────────────────────────────
resource "google_service_account" "automation_worker" {
  account_id   = "sparx-automation-worker"
  display_name = "Sparx automation-worker (Cloud Run)"
  description  = "Runtime SA for the automation-worker. Reads the DB URL from Secret Manager (sparx_app), drives the engine ticks, and publishes cascade events (an action that emits an event) to Pub/Sub."
}

resource "google_project_iam_member" "automation_worker_roles" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/secretmanager.secretAccessor",
    # The engine publisher emits events an action cascades (loop-guarded). Same
    # grant the markup-recompute worker has for the same reason.
    "roles/pubsub.publisher",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.automation_worker.email}"
}

# ─── Cloud Scheduler tick-invoker SA ──────────────────────────────────────
resource "google_service_account" "automation_scheduler" {
  account_id   = "sparx-automation-scheduler"
  display_name = "Sparx automation-worker tick scheduler"
  description  = "Identity Cloud Scheduler impersonates to invoke the automation-worker tick. Holds only roles/run.invoker on the automation-worker Cloud Run service."
}

# Cloud Scheduler's service agent is NOT auto-created when the API is enabled —
# it is provisioned lazily the first time a job mints an OIDC token, which is too
# late for the IAM binding below (it 400s with "service account ... does not
# exist"). Force its creation synchronously so the binding has a real principal
# to grant. Unlike the gcp-sa-pubsub agent (reliably present once topics exist),
# this one needs the explicit nudge.
resource "google_project_service_identity" "cloudscheduler" {
  provider = google-beta
  project  = var.project_id
  service  = "cloudscheduler.googleapis.com"
}

# generateServiceIdentity returns before the new agent has propagated into the
# IAM database, so a binding created in the same apply still 400s with "does not
# exist". Let it settle before granting the role (GCP service-agent propagation
# is typically seconds; 60s is comfortable headroom on first project bring-up).
resource "time_sleep" "cloudscheduler_identity_propagation" {
  depends_on      = [google_project_service_identity.cloudscheduler]
  create_duration = "60s"
}

# Cloud Scheduler's project service agent mints the OIDC token as the SA above.
resource "google_service_account_iam_member" "automation_scheduler_token_creator" {
  service_account_id = google_service_account.automation_scheduler.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_project_service_identity.cloudscheduler.email}"

  depends_on = [time_sleep.cloudscheduler_identity_propagation]
}

# ─── Cloud Run service ────────────────────────────────────────────────────
resource "google_cloud_run_v2_service" "automation_worker" {
  name     = "automation-worker"
  location = var.region
  project  = var.project_id

  deletion_protection = false

  template {
    service_account = google_service_account.automation_worker.email
    timeout         = "300s"
    # A tick worker, not a throughput service. The engine's `withAdvisoryTickLock`
    # pattern parks one DB connection on the lock while the tick's work runs on
    # SEPARATE pool connections, so each in-flight request can hold two connections.
    # The pool floor is set to 2 * this value in the worker's boot-db-pool.ts
    # (connection_limit = 5 covers concurrency = 2 with headroom). Cloud Run scales
    # OUT past this ceiling (up to max_instance_count) rather than piling more
    # requests onto one instance's pool, so the invariant holds at any load. If you
    # raise this, raise the connection_limit floor in boot-db-pool.ts to match.
    max_instance_request_concurrency = 2

    scaling {
      # Scale-to-zero: the scheduler wakes it each minute; pushes (Slice E) wake
      # it on demand. The tick's advisory lock makes overlapping invocations safe.
      min_instance_count = 0
      max_instance_count = 4
    }

    vpc_access {
      connector = google_vpc_access_connector.workers.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/sparx/automation-worker:latest"

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "SERVICE_NAME"
        value = "automation-worker"
      }
      env {
        name  = "LOG_LEVEL"
        value = "info"
      }
      # Real per-topic Pub/Sub for cascade events the engine emits.
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      # OIDC caller the tick endpoint trusts (the scheduler SA).
      env {
        name  = "TICK_INVOKER_SA"
        value = google_service_account.automation_scheduler.email
      }
      # Slice E: the Pub/Sub push invoker for POST / (automation.trigger). Set now
      # so the push path is locked down the moment the subscription is added.
      env {
        name  = "PUBSUB_INVOKER_SA"
        value = google_service_account.pubsub_invoker.email
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            # Cloud-Run-reachable DB URL (PgBouncer internal-LB IP, not the
            # in-cluster kube-DNS name Cloud Run can't resolve). See the
            # `database-url-cloudrun` note in main.tf.
            secret  = "database-url-cloudrun"
            version = "latest"
          }
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      # CI bumps the image tag on every deploy; TF owns only the initial pin.
      template[0].containers[0].image,
      client,
      client_version,
      # SERVICE-level scaling — NOT the `scaling` block above, which is inside
      # `template`, is per-revision, and is ours. The API populates this one with
      # zeroes on every Cloud Run service; the config never declares it, so
      # Terraform proposed removing it forever (applying succeeds, the API
      # repopulates, the next plan proposes it again). Same suppression as
      # modules/cloud-run-worker — see the longer note there.
      scaling,
    ]
  }

  depends_on = [
    google_project_iam_member.automation_worker_roles,
  ]
}

# ─── Cloud Scheduler tick ─────────────────────────────────────────────────
resource "google_cloud_run_v2_service_iam_member" "automation_scheduler_invoker" {
  project  = google_cloud_run_v2_service.automation_worker.project
  location = google_cloud_run_v2_service.automation_worker.location
  name     = google_cloud_run_v2_service.automation_worker.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.automation_scheduler.email}"
}

resource "google_cloud_scheduler_job" "automation_tick" {
  name             = "${local.name_prefix}-automation-tick"
  project          = var.project_id
  region           = var.region
  description      = "Drives the automation engine: one schedule tick + one run-advance tick per minute (docs/84 Slice D)."
  schedule         = "* * * * *"
  time_zone        = "Etc/UTC"
  attempt_deadline = "320s"

  retry_config {
    retry_count = 1
  }

  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_v2_service.automation_worker.uri}/internal/cron/tick"

    oidc_token {
      service_account_email = google_service_account.automation_scheduler.email
      audience              = google_cloud_run_v2_service.automation_worker.uri
    }
  }

  depends_on = [
    google_cloud_run_v2_service_iam_member.automation_scheduler_invoker,
    google_service_account_iam_member.automation_scheduler_token_creator,
  ]
}

# ─── Cloud Scheduler reconcile-seeds (daily backfill) ─────────────────────
# Slice E seeds a module's system automations only on `module.activated` (forward
# only). This daily pass back-fills tenants whose module was already active before
# the engine shipped — and self-heals any dropped activation event — by re-running
# the idempotent seed for every module-active tenant (docs/84 Slice F2 backfill).
# Same tick-invoker SA + run.invoker grant as the per-minute tick.
resource "google_cloud_scheduler_job" "automation_reconcile_seeds" {
  name             = "${local.name_prefix}-automation-reconcile-seeds"
  project          = var.project_id
  region           = var.region
  description      = "Daily backfill: seed system automations for every tenant whose owning module is already active (docs/84 Slice F2 backfill)."
  schedule         = "7 2 * * *" # 02:07 UTC daily — offset from the 00:00 dunning window so same-day activations settle first.
  time_zone        = "Etc/UTC"
  attempt_deadline = "320s"

  retry_config {
    retry_count = 1
  }

  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_v2_service.automation_worker.uri}/internal/cron/reconcile-seeds"

    oidc_token {
      service_account_email = google_service_account.automation_scheduler.email
      audience              = google_cloud_run_v2_service.automation_worker.uri
    }
  }

  depends_on = [
    google_cloud_run_v2_service_iam_member.automation_scheduler_invoker,
    google_service_account_iam_member.automation_scheduler_token_creator,
  ]
}

# ─── Slice E (event fan-in) ────────────────────────────────────────────────
#
# The automation-worker is the SOLE subscriber on the `automation.trigger` fan-in
# topic (provisioned in main.tf): every publish path tees a copy of each event
# there (docs/82 §3.3), and this push subscription delivers the firehose to the
# worker's POST / handler. The worker filters — it ignores events no active
# automation matches, and dispatches `module.activated` to the system-automation
# seed path (docs/84 Slice E4). The OIDC token authenticates as pubsub_invoker,
# whose run.invoker grant is below; the worker re-checks the `email` claim against
# PUBSUB_INVOKER_SA.
resource "google_cloud_run_v2_service_iam_member" "automation_pubsub_invoker" {
  project  = google_cloud_run_v2_service.automation_worker.project
  location = google_cloud_run_v2_service.automation_worker.location
  name     = google_cloud_run_v2_service.automation_worker.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.pubsub_invoker.email}"
}

resource "google_pubsub_subscription" "automation_trigger" {
  name    = "automation.trigger.automation-worker"
  project = var.project_id
  topic   = module.pubsub.topic_ids["automation.trigger"]

  ack_deadline_seconds       = 60
  message_retention_duration = "604800s" # 7 days

  push_config {
    push_endpoint = "${google_cloud_run_v2_service.automation_worker.uri}/"
    oidc_token {
      service_account_email = google_service_account.pubsub_invoker.email
      audience              = google_cloud_run_v2_service.automation_worker.uri
    }
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  # Failed deliveries (worker 5xx) land in the shared DLQ after 5 attempts.
  dynamic "dead_letter_policy" {
    for_each = module.pubsub.dead_letter_topic == null ? [] : [1]
    content {
      dead_letter_topic     = "projects/${var.project_id}/topics/${module.pubsub.dead_letter_topic}"
      max_delivery_attempts = 5
    }
  }

  expiration_policy {
    ttl = "" # never expire
  }

  depends_on = [google_cloud_run_v2_service_iam_member.automation_pubsub_invoker]
}
