locals {
  name_prefix = "sparx-prod"
  env         = "prod"
}

module "vpc" {
  source = "../../modules/vpc"

  name_prefix = local.name_prefix
  region      = var.region

  # 10.0.0.0/16 carved up:
  #   10.0.0.0/20    — nodes (4096)
  #   10.0.16.0/20   — services (4096)
  #   10.0.32.0/20   — PSA / Cloud SQL (4096)
  #   10.0.128.0/17  — pods (32768) — Autopilot uses a lot
  subnet_cidr       = "10.0.0.0/20"
  services_cidr     = "10.0.16.0/20"
  psa_address       = "10.0.32.0"
  psa_prefix_length = 20
  pods_cidr         = "10.0.128.0/17"
}

module "gke" {
  source = "../../modules/gke"

  name_prefix         = local.name_prefix
  region              = var.region
  network_id          = module.vpc.network_id
  subnet_id           = module.vpc.subnet_id
  pods_range_name     = module.vpc.pods_range_name
  services_range_name = module.vpc.services_range_name
  master_cidr         = "172.16.0.0/28"
  deletion_protection = true
}

module "cloud_sql" {
  source = "../../modules/cloud-sql"

  name_prefix         = local.name_prefix
  region              = var.region
  network_id          = module.vpc.network_self_link
  tier                = "db-g1-small"
  availability_type   = "ZONAL"
  disk_size_gb        = 10
  deletion_protection = true

  # PSA peering must be live before Cloud SQL can allocate a private IP.
  depends_on = [module.vpc]
}

module "artifact_registry" {
  source = "../../modules/artifact-registry"
  region = var.region
}

module "pubsub" {
  source = "../../modules/pubsub"

  # Topic -> subscribers. One google_pubsub_topic per key; each subscriber
  # in the list gets a subscription named "<topic>.<subscriber>".
  #
  # Topic name == EventType in services/api-rest/src/lib/pubsub.ts. To add
  # a new event type:
  #   1. Add the literal to the EventType union in pubsub.ts
  #   2. Add the same string here with [] (no consumers yet) or a list
  #   3. New consumer worker? Add its name to the list and ship the worker
  #
  # Empty list = topic exists (publishable) but no subscriber yet — Phase 1
  # cost optimisation, since idle subscriptions still cost retention.
  topics = {
    # Platform / tenant lifecycle — signUpMerchant publishes tenant.created;
    # the legal-seed-worker consumes it via its Cloud Run PUSH subscription in
    # serverless.tf (tenant.created.legal-seed-worker-cloudrun). Topic-only
    # here (empty list = no idle pull subscription).
    "tenant.created" = []

    # Commerce — catalog + inventory fan-in to commerce-indexer
    "product.created"    = ["commerce-indexer"]
    "product.updated"    = ["commerce-indexer"]
    "product.deleted"    = ["commerce-indexer"]
    "variant.created"    = ["commerce-indexer"]
    "variant.updated"    = ["commerce-indexer"]
    "variant.deleted"    = ["commerce-indexer"]
    "inventory.adjusted" = ["commerce-indexer"]
    "inventory.low"      = []
    "inventory.depleted" = []

    # Markup recompute (docs/48 §8) — a variant cost move (direct edit or dropship
    # sync) triggers a price recompute. markup-recompute-worker consumes
    # variant.cost.updated via its Cloud Run PUSH subscription in serverless.tf;
    # price.recomputed / price.recompute.staged are topic-only fan-out signals
    # (no idle pull subscription) for future notification + analytics consumers.
    "variant.cost.updated"   = []
    "price.recomputed"       = []
    "price.recompute.staged" = []

    # Search — admin-triggered full reindex. api-rest publishes; the
    # commerce-indexer consumes via its Cloud Run PUSH subscription declared
    # in serverless.tf (search.reindex.requested.commerce-indexer-cloudrun).
    # Empty list = topic only, no idle pull subscription.
    "search.reindex.requested" = []

    # Search — generic universal-index signal (docs/39). Any module publishes
    # `search.entity.changed` post-commit; the commerce-indexer re-projects the
    # one entity into the universal `entities` collection. One topic for every
    # entity type; consumed via the push subscription in serverless.tf.
    "search.entity.changed" = []

    # Commerce / orders — lifecycle events teed from the CRM platform bus to
    # Pub/Sub (packages/crm/src/pubsub-bridge.ts). commerce-indexer consumes
    # them via its Cloud Run PUSH subscriptions in serverless.tf; topic-only
    # here (empty list = no idle pull subscription).
    "order.created"          = []
    "order.paid"             = []
    "order.cancelled"        = []
    "order.payment.recorded" = []
    "order.fulfilled"        = []
    "order.delivered"        = []
    "order.refunded"         = []

    # CRM customers — the CRM bus (crm.customer.*) bridged to Pub/Sub.
    # commerce-indexer consumes via push subscriptions in serverless.tf.
    "crm.customer.created" = []
    "crm.customer.updated" = []
    "crm.customer.deleted" = []
    "crm.customer.merged"  = []

    # Invoicing — authored billing documents (docs/87 §13). Published on the CRM
    # bus and teed to the automation fan-in + webhook fan-out via the standard
    # bridge. Topic-only (empty list = no idle pull subscription); a stage
    # transition is a prime automation trigger ("Repair Order reaches Approved").
    "crm.billing_document.created"       = []
    "crm.billing_document.stage_changed" = []
    "crm.billing_document.finalized"     = []
    "crm.billing_document.paid"          = []
    "crm.billing_document.voided"        = []

    # Cart
    "cart.abandoned" = []

    # Domains
    "domain.verified"  = ["worker-domain"]
    "domain.purchased" = ["worker-domain"]

    # Email
    "email.send"            = ["email-worker"]
    "email.domain.verified" = []

    # In-product feedback (docs/112). api-rest publishes feedback.submitted when a
    # dashboard user files feedback; the admin app publishes feedback.responded
    # when staff reply. Topic-only (empty list = no idle pull subscription) —
    # the staff notification + analytics consumers ride the automation fan-in /
    # future admin worker, and the response EMAIL goes via the email.send topic
    # above (the admin publisher composes the email.send payload directly).
    "feedback.submitted" = []
    "feedback.responded" = []

    # Web push (docs/69 A-6) — chat escalation fans out push.send per recipient;
    # push-worker (Cloud Run) delivers to staff browser subscriptions via VAPID.
    "push.send" = ["push-worker"]

    # Module lifecycle
    "module.activated"   = []
    "module.deactivated" = []

    # Automation fan-in (docs/82 §3.3). EVERY publish path tees a copy of each
    # event here after its per-type publish; the automation-worker is the sole
    # subscriber (a Cloud Run PUSH subscription in automation.tf, NOT a pull
    # subscriber listed here). One firehose topic + one subscription is cheaper
    # than N per-type subscriptions and additive — per-type topics stay for
    # targeted consumers. Topic-only here.
    "automation.trigger" = []

    # Stripe webhooks
    "stripe.webhook" = ["worker-billing"]

    # CMS content lifecycle (published by api-rest content routes)
    "content.entry.created"     = []
    "content.entry.updated"     = []
    "content.entry.published"   = []
    "content.entry.scheduled"   = []
    "content.entry.unpublished" = []
    "content.entry.deleted"     = []
    "content.revision.created"  = []
    "content_type.upserted"     = []

    # Media pipeline (api-rest publishes; media-worker consumes)
    "media.uploaded"  = ["media-worker"]
    "media.processed" = []
    "media.deleted"   = []

    # Redirects (Phase 4 — edge cache invalidation workers)
    "redirect.added"   = []
    "redirect.removed" = []
  }

  # Per-subscription tuning. Anything not listed here uses the module
  # defaults (60s ack, 7d retention, DLQ after 5 attempts).
  subscription_overrides = {
    # Stripe webhooks can fan out to slow downstream calls.
    "stripe.webhook.worker-billing" = {
      ack_deadline_seconds  = 120
      max_delivery_attempts = 10
    }
    # sharp/libvips AVIF encodes on large originals can run ~60s.
    "media.uploaded.media-worker" = {
      ack_deadline_seconds = 120
    }
  }
}

module "secrets" {
  source = "../../modules/secrets"

  # Source of truth for app/platform secret CONTAINERS. Values are added
  # out-of-band (`gcloud secrets versions add`); the bootstrap workflow's KEYS
  # list syncs the k8s-app subset into the sparx-app-secrets Secret. Keep the two
  # in lockstep — a secret the app references but that's absent here (or from
  # KEYS) fails silently at runtime (the 2026-06-10 cron-token incident).
  # Still provisioned out-of-band, NOT yet reconciled here: sparx-db-app-password,
  # sparx-db-owner-password (DB setup), postal-* (decommissioned), mailgun SMTP creds.
  secret_ids = [
    "database-url",
    # Cloud-Run-only DATABASE_URL. Identical to `database-url` EXCEPT the host:
    # `database-url` points at the in-cluster PgBouncer kube-DNS name
    # (pgbouncer.sparx-prod.svc.cluster.local), which Cloud Run cannot resolve
    # over the VPC connector. This one points at the PgBouncer internal-LB IP
    # (google_compute_address.pgbouncer_internal = 10.0.0.55). The Cloud Run
    # worker fleet (serverless.tf + automation.tf) binds THIS secret; in-cluster
    # pods keep `database-url`. NOT synced into k8s sparx-app-secrets — it is
    # bound directly via Secret Manager → Cloud Run env, so it stays OUT of the
    # bootstrap KEYS list. Add the value out-of-band, host-swapped from the
    # existing secret so the password is never printed:
    #   gcloud secrets versions access latest --secret=database-url \
    #     | sed 's#@pgbouncer.sparx-prod.svc.cluster.local:5432#@10.0.0.55:5432#' \
    #     | gcloud secrets versions add database-url-cloudrun --data-file=-
    "database-url-cloudrun",
    "redis-url",
    "better-auth-secret",
    # Better Auth (Layer 2 shopper) — the customer instance runs inside api-rest
    # (docs/27 v2), isolated from the staff secret. Distinct value; add out-of-band
    # via `gcloud secrets versions add customer-auth-secret --data-file=-`.
    "customer-auth-secret",
    "stripe-secret-key",
    "stripe-webhook-secret",
    "godaddy-api-key-ote",
    "godaddy-api-secret-ote",
    "godaddy-api-key-prod",
    "godaddy-api-secret-prod",
    "postal-api-key",
    "cloudflare-api-token",
    # Better Auth (Layer 1 staff) — its own Postgres URL alongside the app DB.
    "auth-database-url",
    # Google OAuth (Better Auth social provider) — clientId/secret backing the
    # "Continue with Google" button. @sparx/auth (server.ts) registers the
    # provider only when BOTH are present, so the button stays inert until these
    # land. Redirect URI: ${BETTER_AUTH_URL}/api/auth/callback/google.
    "google-client-id",
    "google-client-secret",
    # Mailgun HTTP API key — the email-worker Cloud Run service binds it
    # (serverless.tf). Declared here so the TF that references it also owns it.
    "mailgun-api-key",
    # Internal service-to-service shared secrets (docs/16 §2.5). api-rest and the
    # CronJob pods read these from sparx-app-secrets; values are machine-to-machine,
    # added out-of-band via `gcloud secrets versions add`.
    #   jwt         — signs dashboard→api-rest internal-trust JWTs
    #   acquisition — gates the cross-tenant acquisition report (docs/80 §10)
    #   cron        — auth for the /internal/crm/* + /internal/commerce/* CronJobs
    "sparx-internal-jwt-secret",
    "sparx-internal-acquisition-token",
    "sparx-internal-cron-token",
    # Typesense admin/search API key. commerce-indexer reads it via Secret
    # Manager → Cloud Run env binding. Rotated by the operator manually
    # (Typesense doesn't have rotation hooks).
    "typesense-api-key",
    # Typesense SEARCH-ONLY parent key. api-rest derives short-lived
    # tenant-scoped search keys from it (GET /v1/search/key) so the browser
    # can query Typesense directly without ever holding the admin key.
    # Provisioned out-of-band via the Typesense keys API; create with only
    # documents:search on products/customers/orders. Optional — the key
    # endpoint returns 501 until this is populated.
    "typesense-search-key",
    # VAPID private key — push-worker (serverless.tf) binds it to sign Web Push
    # requests. Generate the pair once (`npx web-push generate-vapid-keys`) and
    # add the private half out-of-band:
    #   gcloud secrets versions add vapid-private-key --data-file=- <<< "<priv>"
    # The PUBLIC half is non-secret: set it as var.vapid_public_key (worker env)
    # and VAPID_PUBLIC_KEY in k8s/sparx-prod/app-env-configmap.yaml (dashboard).
    "vapid-private-key",
    # Channel token-encryption key (docs/106 §4.6) — AES-256-GCM key encrypting the
    # per-tenant channel OAuth grants stored on channel_connections. Bound by the
    # channel-sync-worker (serverless.tf) AND api-rest (k8s). NOT gated on any
    # partner approval — generate + add a version now:
    #   gcloud secrets versions add channels-token-key --data-file=- \
    #     <<< "$(openssl rand -base64 32)"
    # The per-channel platform OAuth client SECRETS (google-oauth-client-secret,
    # meta-app-secret, pinterest-app-secret) land here when each partner app is
    # approved — they don't exist until then.
    "channels-token-key",
  ]
}

module "storage" {
  source            = "../../modules/storage"
  media_bucket_name = "${var.project_id}-${local.name_prefix}-media"
  location          = "US"
}

# Static IP for the ingress L4 LB. Created here so Cloudflare DNS can reference
# it before the k8s Service is applied. The Service annotates
# `loadBalancerIP: <this address>` to bind to it.
resource "google_compute_address" "ingress" {
  name         = "${local.name_prefix}-ingress"
  region       = var.region
  address_type = "EXTERNAL"
}

# Stable internal IP for the Typesense internal-LB Service. Typesense runs
# in-cluster as a ClusterIP (k8s/typesense/service.yaml) which in-cluster
# consumers use, but Cloud Run workers (commerce-indexer) reach the cluster
# only over the VPC connector — where kube-DNS names and ClusterIPs aren't
# routable. The internal LoadBalancer (k8s/typesense/service-internal.yaml)
# pins this address via `loadBalancerIP`, and the indexer's TYPESENSE_HOST
# (serverless.tf) points at it. Pulled from the node subnet's primary range.
resource "google_compute_address" "typesense_internal" {
  name         = "${local.name_prefix}-typesense-internal"
  region       = var.region
  address_type = "INTERNAL"
  subnetwork   = module.vpc.subnet_self_link
}

# Stable internal IP for the PgBouncer internal-LB Service. Same rationale as
# typesense_internal: in-cluster app pods reach the pooler over its ClusterIP /
# kube-DNS name, but the Cloud Run worker fleet reaches the cluster only over
# the VPC connector — where kube-DNS names and ClusterIPs aren't routable. The
# internal LoadBalancer (k8s/pgbouncer/service-internal.yaml) pins this address
# via `loadBalancerIP`, and the workers' DATABASE_URL (the `database-url-cloudrun`
# secret) points at it.
#
# Unlike typesense_internal, `address` is PINNED so the Terraform reservation and
# the k8s Service's loadBalancerIP are guaranteed to match (no manual reconcile).
# Pulled from the node subnet's primary range, one above the Typesense LB (.54).
resource "google_compute_address" "pgbouncer_internal" {
  name         = "${local.name_prefix}-pgbouncer-internal"
  region       = var.region
  address_type = "INTERNAL"
  subnetwork   = module.vpc.subnet_self_link
  address      = "10.0.0.55"
}

# Workload Identity GSA for application pods (apps + workers).
# Bound to the `sparx-app` KSA in the `sparx-prod` namespace.
resource "google_service_account" "app" {
  account_id   = "sparx-app"
  display_name = "Sparx application workloads"
  description  = "Used by api-rest, api-graphql, api-mcp, dashboard, storefront, and worker pods via Workload Identity."
}

resource "google_project_iam_member" "app_roles" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/secretmanager.secretAccessor",
    "roles/pubsub.publisher",
    "roles/pubsub.subscriber",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.app.email}"
}

# Storage access scoped to the media buckets only — NOT project-wide.
# (Project-wide objectAdmin would let the app SA write to the Terraform state bucket.)
# Both buckets get objectAdmin: api-rest writes originals to the private one,
# media-worker writes variants to the public one, and either may need to
# delete-and-replace on either bucket during reprocessing.
resource "google_storage_bucket_iam_member" "app_media" {
  for_each = toset([
    module.storage.media_bucket_name,
    module.storage.media_public_bucket_name,
  ])
  bucket = each.key
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.app.email}"
}

resource "google_service_account_iam_binding" "app_workload_identity" {
  service_account_id = google_service_account.app.name
  role               = "roles/iam.workloadIdentityUser"
  members = [
    "serviceAccount:${var.project_id}.svc.id.goog[sparx-prod/sparx-app]",
    # db-migrate Job (k8s/sparx-prod/db-migrate-job.yaml) needs the same
    # Secret Manager + Cloud SQL access surface as app pods to bootstrap a
    # release. Reusing the app GSA keeps the IAM footprint flat — the
    # migrator only runs read-only against Secret Manager and connects to
    # Cloud SQL via the Auth Proxy sidecar.
    "serviceAccount:${var.project_id}.svc.id.goog[sparx-prod/sparx-db-migrator]",
  ]
}

module "monitoring" {
  source = "../../modules/monitoring"

  project_id               = var.project_id
  ops_email                = var.ops_email
  public_domains_active    = var.cloudflare_enabled
  uptime_check_hosts       = ["api.sparx.works", "app.sparx.works", "mcp.sparx.works", "mcp.sparx.zone"]
  dead_letter_subscription = "dead-letter-inspect"
}
