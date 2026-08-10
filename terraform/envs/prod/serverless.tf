# Serverless infrastructure — VPC Access Connector + per-worker runtime
# SAs + the shared Pub/Sub push invoker SA + Cloud Run worker services.
#
# Sized for Phase 1 traffic. The VPC connector is the only piece that
# carries an hourly cost regardless of traffic (~$10-15/mo at min throughput
# = 200Mbps); everything else is request-driven. See PR description for the
# cost-delta math.
#
# VPC layout (existing carve-up in modules/vpc):
#   10.0.0.0/20    nodes
#   10.0.16.0/20   services
#   10.0.32.0/20   PSA / Cloud SQL
#   10.0.128.0/17  pods
#
# Free range: 10.0.48.0/20 onwards. We carve a /28 for the serverless
# connector, leaving 10.0.48.16+ free for future serverless infrastructure
# (e.g. additional connectors per workload tier).

# ─── VPC Access Connector ─────────────────────────────────────────────────

resource "google_compute_subnetwork" "serverless_connector" {
  name          = "${local.name_prefix}-serverless-connector"
  ip_cidr_range = "10.0.48.0/28"
  region        = var.region
  network       = module.vpc.network_id

  # Connector throughput is bound by subnet size — /28 supports the default
  # 200Mbps-1000Mbps min/max range comfortably.
}

resource "google_vpc_access_connector" "workers" {
  name   = "${local.name_prefix}-workers"
  region = var.region

  subnet {
    name = google_compute_subnetwork.serverless_connector.name
  }

  # Throughput floor/ceiling. Default min is 200, max 1000. We can shrink
  # max later once traffic patterns are known — connector cost scales with
  # min_throughput.
  min_throughput = 200
  max_throughput = 300
}

# ─── Per-worker runtime service accounts ──────────────────────────────────
#
# Per-worker SAs (rather than reusing sparx-app) keep blast radius tight:
# email-worker can't read media buckets; media-worker can't read Postal
# credentials. The trade-off is more IAM resources to maintain — accept it
# for the worker tier, the in-cluster app tier still uses one shared SA.

resource "google_service_account" "email_worker" {
  account_id   = "sparx-email-worker"
  display_name = "Sparx email-worker (Cloud Run)"
  description  = "Runtime SA for the email-worker Cloud Run service. Reads Mailgun API key + DB URL from Secret Manager."
}

resource "google_project_iam_member" "email_worker_roles" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/secretmanager.secretAccessor",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.email_worker.email}"
}

resource "google_service_account" "push_worker" {
  account_id   = "sparx-push-worker"
  display_name = "Sparx push-worker (Cloud Run)"
  description  = "Runtime SA for the push-worker Cloud Run service. Reads the VAPID private key + DB URL from Secret Manager."
}

resource "google_project_iam_member" "push_worker_roles" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/secretmanager.secretAccessor",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.push_worker.email}"
}

resource "google_service_account" "markup_recompute_worker" {
  account_id   = "sparx-markup-recompute"
  display_name = "Sparx markup-recompute-worker (Cloud Run)"
  description  = "Runtime SA for the markup-recompute-worker Cloud Run service. Reads the DB URL from Secret Manager, re-derives catalog prices on a cost change, and publishes price.recomputed / product.updated."
}

# pubsub.publisher (unlike the other CR workers) because this worker PUBLISHES —
# price.recomputed / price.recompute.staged + product.updated to reindex.
resource "google_project_iam_member" "markup_recompute_worker_roles" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/secretmanager.secretAccessor",
    "roles/pubsub.publisher",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.markup_recompute_worker.email}"
}

resource "google_service_account" "commerce_indexer" {
  account_id   = "sparx-commerce-indexer"
  display_name = "Sparx commerce-indexer (Cloud Run)"
  description  = "Runtime SA for the commerce-indexer Cloud Run service. Reads DB URL + Typesense API key from Secret Manager; reprojects product rows into Typesense."
}

resource "google_project_iam_member" "commerce_indexer_roles" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/secretmanager.secretAccessor",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.commerce_indexer.email}"
}

resource "google_service_account" "channel_sync_worker" {
  account_id   = "sparx-channel-sync-worker"
  display_name = "Sparx channel-sync-worker (Cloud Run)"
  description  = "Runtime SA for the channel-sync-worker Cloud Run service. Reads the DB URL + the channel token-encryption key from Secret Manager; pushes catalog/inventory out to connected sales channels (docs/106)."
}

resource "google_project_iam_member" "channel_sync_worker_roles" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/secretmanager.secretAccessor",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.channel_sync_worker.email}"
}

resource "google_service_account" "legal_seed_worker" {
  account_id   = "sparx-legal-seed-worker"
  display_name = "Sparx legal-seed-worker (Cloud Run)"
  description  = "Runtime SA for the legal-seed-worker Cloud Run service. Reads the DB URL from Secret Manager and seeds a new tenant's starter legal pages + footer placements on tenant.created."
}

resource "google_project_iam_member" "legal_seed_worker_roles" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/secretmanager.secretAccessor",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.legal_seed_worker.email}"
}

resource "google_service_account" "platform_crm_worker" {
  account_id   = "sparx-platform-crm-worker"
  display_name = "Sparx platform-crm-worker (Cloud Run)"
  description  = "Runtime SA for the platform-crm-worker Cloud Run service. Reads the DB URL from Secret Manager and mirrors tenant lifecycle (signup, rename, module toggles, subscription changes) into the PLATFORM tenant's own CRM."
}

resource "google_project_iam_member" "platform_crm_worker_roles" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/secretmanager.secretAccessor",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.platform_crm_worker.email}"
}

resource "google_service_account" "media_worker" {
  account_id   = "sparx-media-worker"
  display_name = "Sparx media-worker (Cloud Run)"
  description  = "Runtime SA for the media-worker Cloud Run service. Reads originals from the private media bucket and writes variants to the public one."
}

resource "google_project_iam_member" "media_worker_roles" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/secretmanager.secretAccessor",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.media_worker.email}"
}

# Bucket-scoped storage perms — narrower than project-wide objectAdmin so
# the worker SA cannot reach Terraform state buckets or media buckets that
# belong to other tenants in the future.
resource "google_storage_bucket_iam_member" "media_worker_buckets" {
  for_each = toset([
    module.storage.media_bucket_name,
    module.storage.media_public_bucket_name,
  ])
  bucket = each.key
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.media_worker.email}"
}

# ─── Shared Pub/Sub push invoker SA ───────────────────────────────────────
#
# Pub/Sub mints OIDC tokens as this SA when pushing to Cloud Run. Cloud Run
# checks roles/run.invoker on the destination service against this SA's
# email — those bindings live in the cloud-run-worker module. The Pub/Sub
# managed service agent needs serviceAccountTokenCreator on this SA so it
# can actually mint the tokens.

resource "google_service_account" "pubsub_invoker" {
  account_id   = "sparx-pubsub-invoker"
  display_name = "Sparx Pub/Sub → Cloud Run invoker"
  description  = "Identity Pub/Sub assumes when delivering push messages to Cloud Run workers. Has no project-level roles; only roles/run.invoker on individual Cloud Run services via the cloud-run-worker module."
}

# Pub/Sub's project-level service agent: `service-<project-number>@gcp-sa-pubsub.iam.gserviceaccount.com`.
# Granting it tokenCreator on the invoker SA lets it impersonate the SA
# when generating OIDC tokens for push delivery.
data "google_project" "this" {
  project_id = var.project_id
}

resource "google_service_account_iam_member" "pubsub_invoker_token_creator" {
  service_account_id = google_service_account.pubsub_invoker.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:service-${data.google_project.this.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

# ─── Cloud Run workers ────────────────────────────────────────────────────
#
# Side-by-side cutover: each push subscription is named '<topic>.<worker>-cloudrun'
# so the existing pull subscription ('<topic>.<worker>') keeps running in
# the cluster during the transition. Once Cloud Run is verified for a
# stable week, a follow-up PR removes the pull sub from modules/pubsub
# and deletes the k8s/workers manifests.

module "email_worker_cloudrun" {
  source = "../../modules/cloud-run-worker"

  name       = "email-worker"
  project_id = var.project_id
  region     = var.region
  # Initial pin — CI updates the tag on every deploy. lifecycle.ignore_changes
  # in the module keeps TF plans clean afterwards.
  image                 = "${var.region}-docker.pkg.dev/${var.project_id}/sparx/email-worker:latest"
  service_account_email = google_service_account.email_worker.email
  vpc_connector_id      = google_vpc_access_connector.workers.id

  min_instance_count    = 0
  max_instance_count    = 10
  container_concurrency = 8
  cpu                   = "1"
  memory                = "512Mi"
  timeout_seconds       = 300

  env_vars = {
    NODE_ENV             = "production"
    SERVICE_NAME         = "email-worker"
    LOG_LEVEL            = "info"
    PUBSUB_INVOKER_SA    = google_service_account.pubsub_invoker.email
    SPARX_EMAIL_PROVIDER = "mailgun"
    SPARX_MAILGUN_DOMAIN = "sparx.email"
    SPARX_MAILGUN_REGION = "us"
    SPARX_EMAIL_FROM     = "Sparx <noreply@sparx.email>"
    # PUBLIC origin of api-rest for media URLs rendered into broadcast emails (the
    # worker renders per-recipient `defer` sends). The internal cluster address is
    # unreachable from a mail client, so brand-service needs the public one.
    # REST-specific — GraphQL (graphql.sparx.works) doesn't serve media bytes.
    SPARX_PUBLIC_API_REST_URL = "https://api.sparx.works"
  }

  secrets = [
    {
      name = "DATABASE_URL"
      # Cloud-Run-reachable DB URL (PgBouncer internal-LB IP, not the kube-DNS
      # name). See the `database-url-cloudrun` note in main.tf.
      secret_id = "database-url-cloudrun"
    },
    {
      name      = "SPARX_MAILGUN_API_KEY"
      secret_id = "mailgun-api-key"
    },
  ]

  pubsub_topic                 = "email.send"
  pubsub_subscription_name     = "email.send.email-worker-cloudrun"
  pubsub_invoker_sa_email      = google_service_account.pubsub_invoker.email
  pubsub_dead_letter_topic_id  = module.pubsub.dead_letter_topic == null ? null : "projects/${var.project_id}/topics/${module.pubsub.dead_letter_topic}"
  pubsub_max_delivery_attempts = 5

  depends_on = [
    module.pubsub,
    google_project_iam_member.email_worker_roles,
    google_service_account_iam_member.pubsub_invoker_token_creator,
  ]
}

# push-worker — Web Push fan-out for staff (docs/69 A-6). Lower concurrency than
# email-worker (the Web Push API is slower per send) and a shorter timeout (the
# work is I/O-light). VAPID public key is a plain env; the private key is a
# Secret Manager binding. No-ops until both VAPID values are populated.
module "push_worker_cloudrun" {
  source = "../../modules/cloud-run-worker"

  name                  = "push-worker"
  project_id            = var.project_id
  region                = var.region
  image                 = "${var.region}-docker.pkg.dev/${var.project_id}/sparx/push-worker:latest"
  service_account_email = google_service_account.push_worker.email
  vpc_connector_id      = google_vpc_access_connector.workers.id

  min_instance_count    = 0
  max_instance_count    = 10
  container_concurrency = 4
  cpu                   = "1"
  memory                = "512Mi"
  timeout_seconds       = 60

  env_vars = {
    NODE_ENV          = "production"
    SERVICE_NAME      = "push-worker"
    LOG_LEVEL         = "info"
    PUBSUB_INVOKER_SA = google_service_account.pubsub_invoker.email
    VAPID_PUBLIC_KEY  = var.vapid_public_key
    VAPID_SUBJECT     = "mailto:support@sparx.works"
  }

  secrets = [
    {
      name = "DATABASE_URL"
      # Cloud-Run-reachable DB URL (PgBouncer internal-LB IP, not the kube-DNS
      # name). See the `database-url-cloudrun` note in main.tf.
      secret_id = "database-url-cloudrun"
    },
    {
      name      = "VAPID_PRIVATE_KEY"
      secret_id = "vapid-private-key"
    },
  ]

  pubsub_topic                 = "push.send"
  pubsub_subscription_name     = "push.send.push-worker-cloudrun"
  pubsub_invoker_sa_email      = google_service_account.pubsub_invoker.email
  pubsub_dead_letter_topic_id  = module.pubsub.dead_letter_topic == null ? null : "projects/${var.project_id}/topics/${module.pubsub.dead_letter_topic}"
  pubsub_max_delivery_attempts = 5

  depends_on = [
    module.pubsub,
    google_project_iam_member.push_worker_roles,
    google_service_account_iam_member.pubsub_invoker_token_creator,
  ]
}

# markup-recompute-worker — cost-driven price recompute (docs/48 Phase 4).
# Consumes variant.cost.updated; re-derives the list price for variants bound to
# a markup rule and either auto-applies it (within the rule's tolerance) or stages
# it for review. Low concurrency — each message is a small per-variant transaction.
module "markup_recompute_worker_cloudrun" {
  source = "../../modules/cloud-run-worker"

  name                  = "markup-recompute-worker"
  project_id            = var.project_id
  region                = var.region
  image                 = "${var.region}-docker.pkg.dev/${var.project_id}/sparx/markup-recompute-worker:latest"
  service_account_email = google_service_account.markup_recompute_worker.email
  vpc_connector_id      = google_vpc_access_connector.workers.id

  min_instance_count    = 0
  max_instance_count    = 10
  container_concurrency = 8
  cpu                   = "1"
  memory                = "512Mi"
  timeout_seconds       = 120

  env_vars = {
    NODE_ENV          = "production"
    SERVICE_NAME      = "markup-recompute-worker"
    LOG_LEVEL         = "info"
    PUBSUB_INVOKER_SA = google_service_account.pubsub_invoker.email
    # Set so downstream events (price.recomputed, product.updated) publish to Pub/Sub.
    GCP_PROJECT_ID = var.project_id
  }

  secrets = [
    {
      name = "DATABASE_URL"
      # Cloud-Run-reachable DB URL (PgBouncer internal-LB IP, not the kube-DNS
      # name). See the `database-url-cloudrun` note in main.tf.
      secret_id = "database-url-cloudrun"
    },
  ]

  pubsub_topic                 = "variant.cost.updated"
  pubsub_subscription_name     = "variant.cost.updated.markup-recompute-worker-cloudrun"
  pubsub_invoker_sa_email      = google_service_account.pubsub_invoker.email
  pubsub_dead_letter_topic_id  = module.pubsub.dead_letter_topic == null ? null : "projects/${var.project_id}/topics/${module.pubsub.dead_letter_topic}"
  pubsub_max_delivery_attempts = 5

  depends_on = [
    module.pubsub,
    google_project_iam_member.markup_recompute_worker_roles,
    google_service_account_iam_member.pubsub_invoker_token_creator,
  ]
}

module "media_worker_cloudrun" {
  source = "../../modules/cloud-run-worker"

  name                  = "media-worker"
  project_id            = var.project_id
  region                = var.region
  image                 = "${var.region}-docker.pkg.dev/${var.project_id}/sparx/media-worker:latest"
  service_account_email = google_service_account.media_worker.email
  vpc_connector_id      = google_vpc_access_connector.workers.id

  # sharp/libvips AVIF encodes are CPU-heavy — keep per-instance
  # concurrency at 2 (matches the old MAX_CONCURRENT) and let Cloud Run
  # scale horizontally.
  min_instance_count    = 0
  max_instance_count    = 10
  container_concurrency = 2
  cpu                   = "2"
  memory                = "1Gi"
  # ack_deadline is 120 to cover ~60s encodes + push round-trip; request
  # timeout has to be >= ack_deadline so Cloud Run doesn't kill the work
  # before Pub/Sub gives up on it.
  timeout_seconds = 540

  env_vars = {
    NODE_ENV                = "production"
    SERVICE_NAME            = "media-worker"
    LOG_LEVEL               = "info"
    PUBSUB_INVOKER_SA       = google_service_account.pubsub_invoker.email
    GCS_MEDIA_BUCKET        = module.storage.media_bucket_name
    GCS_MEDIA_PUBLIC_BUCKET = module.storage.media_public_bucket_name
  }

  secrets = [
    {
      name = "DATABASE_URL"
      # Cloud-Run-reachable DB URL (PgBouncer internal-LB IP, not the kube-DNS
      # name). See the `database-url-cloudrun` note in main.tf.
      secret_id = "database-url-cloudrun"
    },
  ]

  pubsub_topic                 = "media.uploaded"
  pubsub_subscription_name     = "media.uploaded.media-worker-cloudrun"
  pubsub_ack_deadline_seconds  = 120
  pubsub_invoker_sa_email      = google_service_account.pubsub_invoker.email
  pubsub_dead_letter_topic_id  = module.pubsub.dead_letter_topic == null ? null : "projects/${var.project_id}/topics/${module.pubsub.dead_letter_topic}"
  pubsub_max_delivery_attempts = 5

  depends_on = [
    module.pubsub,
    google_project_iam_member.media_worker_roles,
    google_storage_bucket_iam_member.media_worker_buckets,
    google_service_account_iam_member.pubsub_invoker_token_creator,
  ]
}

# ─── commerce-indexer ─────────────────────────────────────────────────────
#
# Single Cloud Run service that fans in from product.*/variant.*/inventory.*
# topics. The primary subscription is product.created (chosen as the
# "canonical" one because every product first appears via it); the rest
# attach via additional_subscriptions on the same service. The router in
# services/commerce-indexer/src/handler.ts disambiguates by event.type.

module "commerce_indexer_cloudrun" {
  source = "../../modules/cloud-run-worker"

  name                  = "commerce-indexer"
  project_id            = var.project_id
  region                = var.region
  image                 = "${var.region}-docker.pkg.dev/${var.project_id}/sparx/commerce-indexer:latest"
  service_account_email = google_service_account.commerce_indexer.email
  vpc_connector_id      = google_vpc_access_connector.workers.id

  # Projection is light: one Prisma read + one HTTP upsert per event.
  # Container concurrency of 8 matches email-worker; bump if Typesense
  # round-trip becomes the floor.
  min_instance_count    = 0
  max_instance_count    = 10
  container_concurrency = 8
  cpu                   = "1"
  memory                = "512Mi"
  # A full-tenant reindex (search.reindex.requested) pages every product /
  # customer / order through the projection in one request — give it room.
  # Must be >= the reindex subscription's ack deadline (300s) below.
  timeout_seconds = 600

  env_vars = {
    NODE_ENV                = "production"
    SERVICE_NAME            = "commerce-indexer"
    LOG_LEVEL               = "info"
    PUBSUB_INVOKER_SA       = google_service_account.pubsub_invoker.email
    GCS_MEDIA_PUBLIC_BUCKET = module.storage.media_public_bucket_name
    # Typesense lives in-cluster. Cloud Run can't reach its ClusterIP or
    # kube-DNS name over the VPC connector, so we target the internal
    # LoadBalancer's reserved private IP (k8s/typesense/service-internal.yaml
    # pins this same address via loadBalancerIP).
    TYPESENSE_HOST     = google_compute_address.typesense_internal.address
    TYPESENSE_PORT     = "8108"
    TYPESENSE_PROTOCOL = "http"
    # Create products/customers/orders collections on cold start if missing
    # (idempotent — ensureSchemas retrieves first, creates only on 404). The
    # Phase-1 typesense-api-key is the admin key, so it has create rights.
    ENSURE_SCHEMAS_ON_BOOT = "true"
  }

  secrets = [
    {
      name = "DATABASE_URL"
      # Cloud-Run-reachable DB URL (PgBouncer internal-LB IP, not the kube-DNS
      # name). See the `database-url-cloudrun` note in main.tf.
      secret_id = "database-url-cloudrun"
    },
    {
      name      = "TYPESENSE_API_KEY"
      secret_id = "typesense-api-key"
    },
  ]

  # Primary subscription = product.created. Inventory + variant + the rest
  # of the product lifecycle attach as additional subscriptions below.
  pubsub_topic                 = "product.created"
  pubsub_subscription_name     = "product.created.commerce-indexer-cloudrun"
  pubsub_invoker_sa_email      = google_service_account.pubsub_invoker.email
  pubsub_dead_letter_topic_id  = module.pubsub.dead_letter_topic == null ? null : "projects/${var.project_id}/topics/${module.pubsub.dead_letter_topic}"
  pubsub_max_delivery_attempts = 5

  additional_subscriptions = [
    { topic = "product.updated", subscription_name = "product.updated.commerce-indexer-cloudrun" },
    { topic = "product.deleted", subscription_name = "product.deleted.commerce-indexer-cloudrun" },
    { topic = "variant.created", subscription_name = "variant.created.commerce-indexer-cloudrun" },
    { topic = "variant.updated", subscription_name = "variant.updated.commerce-indexer-cloudrun" },
    { topic = "variant.deleted", subscription_name = "variant.deleted.commerce-indexer-cloudrun" },
    { topic = "inventory.adjusted", subscription_name = "inventory.adjusted.commerce-indexer-cloudrun" },
    # CRM customers — live index updates (crm.customer.* bridged to Pub/Sub).
    { topic = "crm.customer.created", subscription_name = "crm.customer.created.commerce-indexer-cloudrun" },
    { topic = "crm.customer.updated", subscription_name = "crm.customer.updated.commerce-indexer-cloudrun" },
    { topic = "crm.customer.deleted", subscription_name = "crm.customer.deleted.commerce-indexer-cloudrun" },
    { topic = "crm.customer.merged", subscription_name = "crm.customer.merged.commerce-indexer-cloudrun" },
    # Orders — live index updates (order.* teed from the platform bus).
    { topic = "order.created", subscription_name = "order.created.commerce-indexer-cloudrun" },
    { topic = "order.cancelled", subscription_name = "order.cancelled.commerce-indexer-cloudrun" },
    { topic = "order.payment.recorded", subscription_name = "order.payment.recorded.commerce-indexer-cloudrun" },
    { topic = "order.fulfilled", subscription_name = "order.fulfilled.commerce-indexer-cloudrun" },
    { topic = "order.delivered", subscription_name = "order.delivered.commerce-indexer-cloudrun" },
    { topic = "order.refunded", subscription_name = "order.refunded.commerce-indexer-cloudrun" },
    # Admin-triggered full reindex. Longer ack deadline since a single
    # message rebuilds an entire tenant's collections from Postgres.
    {
      topic                = "search.reindex.requested"
      subscription_name    = "search.reindex.requested.commerce-indexer-cloudrun"
      ack_deadline_seconds = 300
    },
    # Universal-index signal (docs/39) — any module's `search.entity.changed`
    # re-projects one entity into the `entities` collection.
    { topic = "search.entity.changed", subscription_name = "search.entity.changed.commerce-indexer-cloudrun" },
  ]

  depends_on = [
    module.pubsub,
    google_project_iam_member.commerce_indexer_roles,
    google_service_account_iam_member.pubsub_invoker_token_creator,
  ]
}

# ─── channel-sync-worker ──────────────────────────────────────────────────
#
# Pushes catalog/inventory/fulfillment out to connected sales channels
# (Google Shopping, Meta, Pinterest, … — docs/106 §4.2). Subscribes to the SAME
# product/inventory/order lifecycle topics as commerce-indexer (distinct
# subscription names), resolves which connected channels care, and dispatches to
# the registered adapter. A pure no-op until a tenant connects a channel — so it
# costs nothing (scale-to-zero) until channels go live.
#
# SECRET SEQUENCING: the per-channel platform OAuth client secrets
# (google-oauth-client-secret, meta-app-secret, pinterest-app-secret,
# tiktok-app-key, tiktok-app-secret) + the storefront base (SPARX_SITE_BASE) are
# added to `secrets`/`env_vars` when each partner app is APPROVED — the same gate
# that flips the channel `available`. You cannot bind a secret value that does not
# exist yet, and no channel can be connected (hence nothing to push) before then.
# `channels-token-key` is bound now: it is a generated 32-byte key (not gated on any
# partner), provisioned via `gcloud secrets versions add channels-token-key`.
#
# TikTok Shop (order channel) signs every outbound catalog/inventory/fulfillment
# call with tiktok-app-key/tiktok-app-secret, so BOTH are bound here at go-live (the
# inbound order webhook + ingest run in api-rest, which carries the same creds).
module "channel_sync_worker_cloudrun" {
  source = "../../modules/cloud-run-worker"

  name                  = "channel-sync-worker"
  project_id            = var.project_id
  region                = var.region
  image                 = "${var.region}-docker.pkg.dev/${var.project_id}/sparx/channel-sync-worker:latest"
  service_account_email = google_service_account.channel_sync_worker.email
  vpc_connector_id      = google_vpc_access_connector.workers.id

  # Light: one Prisma read + one channel API call per event, per connected channel.
  min_instance_count    = 0
  max_instance_count    = 10
  container_concurrency = 8
  cpu                   = "1"
  memory                = "512Mi"
  timeout_seconds       = 120

  env_vars = {
    NODE_ENV                = "production"
    SERVICE_NAME            = "channel-sync-worker"
    LOG_LEVEL               = "info"
    PUBSUB_INVOKER_SA       = google_service_account.pubsub_invoker.email
    GCP_PROJECT_ID          = var.project_id
    GCS_MEDIA_PUBLIC_BUCKET = module.storage.media_public_bucket_name
    # SPARX_SITE_BASE (storefront base for the absolute product URL feeds require,
    # {slug} template — mirrors the email path) + the non-secret per-channel OAuth
    # client IDs (GOOGLE_OAUTH_CLIENT_ID / META_APP_ID / PINTEREST_APP_ID) are added
    # here when channels go live; TIKTOK_APP_KEY / TIKTOK_APP_SECRET ride `secrets`
    # below. Until SPARX_SITE_BASE is set the worker skips catalog pushes (no
    # absolute URL) rather than feed a broken link — a safe default.
    #
    # P3 order channels (Etsy / Walmart / eBay / Faire) add their app credentials
    # the same way at go-live, each partner-approval-gated — ETSY_API_KEY/_SECRET,
    # WALMART_CLIENT_ID/_SECRET, EBAY_CLIENT_ID/_SECRET (+ EBAY_RU_NAME),
    # FAIRE_CLIENT_ID/_SECRET. The worker signs OUTBOUND push with them; inbound
    # order ingest runs in api-rest (Faire webhook + the channel-order-poll CronJob
    # for Etsy/Walmart/eBay). Not bound now — can't bind a secret value that doesn't
    # exist yet; each channel stays coming_soon until its creds land, no code change.
    #
    # P4 Amazon (SP-API) — AMAZON_LWA_CLIENT_ID/_SECRET (Login-with-Amazon token),
    # AMAZON_MARKETPLACE_ID + AMAZON_REGION (host defaults). Outbound push uses the
    # Feeds API (token-scoped, no seller-id); inbound is the channel-order-poll CronJob
    # (Orders API + a Restricted Data Token for buyer PII). Additionally gated on
    # Amazon's restricted-PII security audit, not just app approval. AMAZON_SP_APP_ID
    # (the consent-URL app id) is api-rest-only. Same coming_soon-until-creds default.
    #
    # P5 sparx.market (docs/106 §4.7) — the FIRST-PARTY channel adds NO new Cloud Run
    # worker + NO new secret: the apps/market storefront is a GKE Deployment
    # (k8s/apps/market.yaml), the weekly payout runs on a GKE CronJob
    # (k8s/cronjobs/market-settlement.yaml → POST /internal/market/settle), and the
    # MoR checkout reuses the platform STRIPE_SECRET_KEY (charge) + CHANNELS_TOKEN_KEY
    # (payout-account encryption) above. Its toggles are plain GKE-configmap env on
    # api-rest + the market app (NOT Cloud Run, so they aren't set here): MARKET_ENABLED
    # ('true' flips the channel available at go-live), MARKET_COMMISSION_BPS (flat
    # platform rate, default 200=2%), MARKET_PAYOUTS_PROVIDER (ACH rail; defaults to
    # manual/out-of-band), SPARX_DASHBOARD_URL (settlement-email links). Stays
    # coming_soon until MARKET_ENABLED is set — no code change.
  }

  secrets = [
    {
      name = "DATABASE_URL"
      # Cloud-Run-reachable DB URL (PgBouncer internal-LB IP, not the kube-DNS
      # name). See the `database-url-cloudrun` note in main.tf.
      secret_id = "database-url-cloudrun"
    },
    {
      name      = "CHANNELS_TOKEN_KEY"
      secret_id = "channels-token-key"
    },
  ]

  # Primary subscription = product.created; the rest of the catalog/inventory/order
  # lifecycle attaches as additional subscriptions (distinct names from
  # commerce-indexer's, so both consume the same topics independently).
  pubsub_topic                 = "product.created"
  pubsub_subscription_name     = "product.created.channel-sync-worker-cloudrun"
  pubsub_invoker_sa_email      = google_service_account.pubsub_invoker.email
  pubsub_dead_letter_topic_id  = module.pubsub.dead_letter_topic == null ? null : "projects/${var.project_id}/topics/${module.pubsub.dead_letter_topic}"
  pubsub_max_delivery_attempts = 5

  additional_subscriptions = [
    { topic = "product.updated", subscription_name = "product.updated.channel-sync-worker-cloudrun" },
    { topic = "product.deleted", subscription_name = "product.deleted.channel-sync-worker-cloudrun" },
    { topic = "inventory.adjusted", subscription_name = "inventory.adjusted.channel-sync-worker-cloudrun" },
    { topic = "order.fulfilled", subscription_name = "order.fulfilled.channel-sync-worker-cloudrun" },
  ]

  depends_on = [
    module.pubsub,
    google_project_iam_member.channel_sync_worker_roles,
    google_service_account_iam_member.pubsub_invoker_token_creator,
  ]
}

# ─── social-worker ─────────────────────────────────────────────────────────
#
# Publishes each due social post's targets to their platforms (docs/133). Consumes
# social.post.due (emitted by the api-rest publish-now path + the Slice 5 scheduled
# drain), resolves + refreshes the per-tenant OAuth grant, renders per platform, and
# records each per-target result — then publishes social.post.published / .failed.
#
# SECRET SEQUENCING (mirrors channel-sync-worker): social-token-key is a generated
# 32-byte key, bound now (not gated on any partner). The platform OAuth client SECRETS
# used for token REFRESH bind at go-live, per platform, the SAME approval gate that
# flips that platform connectable — a Cloud Run env-from-secret binding requires the
# secret VERSION to already exist, so we cannot bind them empty (it breaks the deploy).
# Each secret CONTAINER is declared now in module.secrets (main.tf), so go-live is just
# `gcloud secrets versions add <name>` + uncommenting its binding below:
#   google-oauth-client-secret  → GOOGLE_OAUTH_CLIENT_SECRET  (Google Business + YouTube)
#   linkedin-client-secret      → LINKEDIN_CLIENT_SECRET
#   meta-app-secret             → META_APP_SECRET             (Facebook Pages + Instagram)
#   threads-app-secret          → THREADS_APP_SECRET
#   pinterest-app-secret        → PINTEREST_APP_SECRET
#   tiktok-client-secret        → TIKTOK_CLIENT_SECRET
# Refresh also needs the matching non-secret client IDs (GOOGLE_OAUTH_CLIENT_ID /
# LINKEDIN_CLIENT_ID / META_APP_ID / THREADS_APP_ID / PINTEREST_APP_ID / TIKTOK_CLIENT_KEY)
# + MEDIA_PUBLIC_BASE_URL (the public origin a platform fetches post media from) — add
# them to env_vars at go-live. A pure no-op (scale-to-zero) until a tenant publishes.

resource "google_service_account" "social_worker" {
  account_id   = "sparx-social-worker"
  display_name = "Sparx social-worker (Cloud Run)"
  description  = "Runtime SA for the social-worker Cloud Run service. Reads the DB URL + social token key from Secret Manager, publishes posts to social platforms, and publishes social.post.published/failed."
}

# pubsub.publisher because this worker PUBLISHES the result events
# (social.post.published / social.post.failed).
resource "google_project_iam_member" "social_worker_roles" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/secretmanager.secretAccessor",
    "roles/pubsub.publisher",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.social_worker.email}"
}

module "social_worker_cloudrun" {
  source = "../../modules/cloud-run-worker"

  name                  = "social-worker"
  project_id            = var.project_id
  region                = var.region
  image                 = "${var.region}-docker.pkg.dev/${var.project_id}/sparx/social-worker:latest"
  service_account_email = google_service_account.social_worker.email
  vpc_connector_id      = google_vpc_access_connector.workers.id

  # Light: a Prisma read + one platform API call per target per event. Scale-to-zero
  # until a tenant publishes.
  min_instance_count    = 0
  max_instance_count    = 10
  container_concurrency = 8
  cpu                   = "1"
  memory                = "512Mi"
  timeout_seconds       = 120

  env_vars = {
    NODE_ENV          = "production"
    SERVICE_NAME      = "social-worker"
    LOG_LEVEL         = "info"
    PUBSUB_INVOKER_SA = google_service_account.pubsub_invoker.email
    GCP_PROJECT_ID    = var.project_id
    # The public origin a platform fetches a post's image from — the SAME host api-rest
    # mints variant URLs on (k8s app-env `MEDIA_PUBLIC_URL = https://media.sparx.works`).
    # WITHOUT this, resolvePostAssets returns nothing and every post publishes text-only
    # (the image is silently skipped) — the cause of "Facebook didn't post the image".
    MEDIA_PUBLIC_BASE_URL = "https://media.sparx.works"
    # DNS-only origin host (bypasses Cloudflare) that Instagram/Threads/Pinterest fetch a
    # post's image_url from. Cloudflare answers a `Range` request with a 206 those
    # platforms reject; this host serves the origin's clean 200. Facebook/LinkedIn
    # byte-upload and keep MEDIA_PUBLIC_BASE_URL. See cloudflare.tf
    # `sparx_works_media_direct` + the Caddy `media-direct.sparx.works` vhost.
    MEDIA_DIRECT_BASE_URL = "https://media-direct.sparx.works"
    # Where the two social notification emails ("your post didn't go out", "reconnect
    # this account") point. Without a deep link back to the thing that needs fixing, a
    # notice is just an alarm with no off switch.
    WORKBENCH_BASE_URL = "https://app.sparx.works"
    # Meta review-gated features. These MUST mirror the k8s `sparx-app-env`
    # ConfigMap: api-rest (on GKE) decides which scopes the OAuth grant asks for,
    # but the drains that actually CALL Meta run here, on Cloud Run. Set in one
    # plane only and the two disagree silently.
    #
    # META_INBOX_ENABLED is load-bearing. `syncInbox` checks
    # `adapter.supportsInbox()`, which for Facebook/Instagram is exactly this
    # flag; with it unset the sweep marks every destination `unsupported`,
    # stamps the cursor so it is not retried, and returns — no API call, no
    # error, nothing in the logs to chase. That is what kept
    # pages_read_user_content / pages_manage_engagement /
    # instagram_manage_comments at "0 of 1 API calls" in App Review.
    #
    # META_INSIGHTS_ENABLED is parity, not function: `getMetrics` already
    # try/catches the insights read, so today this changes nothing here. It is
    # set so the two planes cannot drift — the day that read is gated to skip a
    # pointless 403 per sweep, an unset flag here would silently stop collecting
    # reach + impressions.
    META_INBOX_ENABLED    = "true"
    META_INSIGHTS_ENABLED = "true"
    # Pinterest Trial-access apps CANNOT create Pins in production (`api.pinterest.com`
    # returns 403 "use API Sandbox instead"). PINTEREST_SANDBOX routes token exchange +
    # all Pinterest API calls to api-sandbox.pinterest.com so a Trial app can create
    # (sandbox) Pins — needed to record the demo video the Standard-access upgrade
    # requires. MUST mirror the k8s `sparx-app-env` ConfigMap: api-rest (GKE) does the
    # OAuth token exchange, this worker does the publish — set in one plane only and they
    # disagree silently. Flip to "false" once Standard access is granted.
    PINTEREST_SANDBOX = "true"
    # Added at go-live: the non-secret platform OAuth client IDs used for token
    # refresh (GOOGLE_OAUTH_CLIENT_ID; later META_APP_ID / LINKEDIN_CLIENT_ID).
    # NOTE: without META_APP_ID/SECRET here the health sweep cannot re-exchange a
    # Meta token. Not urgent — it only refreshes within REFRESH_AHEAD_MS of
    # expiry and a fresh grant carries ~60 days — but on day ~58 the sweep will
    # flip the connection to `expired` and ask the tenant to reconnect.
  }

  secrets = [
    {
      name = "DATABASE_URL"
      # Cloud-Run-reachable DB URL (PgBouncer internal-LB IP, not the kube-DNS
      # name). See the `database-url-cloudrun` note in main.tf.
      secret_id = "database-url-cloudrun"
    },
    {
      name      = "SOCIAL_TOKEN_KEY"
      secret_id = "social-token-key"
    },
    # Pinterest went live 2026-07-25. The adapter's token REFRESH (refresh()) auths the
    # app with HTTP Basic (client id + secret), so the worker binds BOTH halves — the id
    # is bound from Secret Manager (not a plain env_var) to match how it was provisioned.
    # Publish itself uses the per-tenant Bearer token, not these.
    {
      name      = "PINTEREST_APP_ID"
      secret_id = "pinterest-app-id"
    },
    {
      name      = "PINTEREST_APP_SECRET"
      secret_id = "pinterest-app-secret"
    },
    # TikTok, Meta and Threads bound 2026-07-28 after an active retry storm proved the
    # worker needs them at RUNTIME, not just at connect time.
    #
    # The gap was invisible until the RLS scan fix (migration 20270126000000) switched the
    # background sweeps on: with them dead, nothing here ever called a platform outside a
    # publish. The moment health/metrics/inbox started dispatching, every TikTok-touching
    # event threw "TikTok platform OAuth credentials are not configured" — ~81 distinct
    # messages an hour, each redelivered 5× to the DLQ, and each re-dispatched forever by
    # the sweep that raised it, because a failed check never stamps its cursor.
    #
    # Publish itself uses the per-tenant Bearer token; these are the APP half, needed by
    # every adapter's refresh() (TikTok's access token lives ~24h, so its refresh is
    # routine, not an edge case) and by the health sweep's re-exchange. Bound from Secret
    # Manager rather than env_vars because the id and the secret are provisioned together.
    {
      name      = "TIKTOK_CLIENT_KEY"
      secret_id = "tiktok-client-key"
    },
    {
      name      = "TIKTOK_CLIENT_SECRET"
      secret_id = "tiktok-client-secret"
    },
    # Without these the health sweep cannot re-exchange a Meta token, so a grant that is
    # fine today flips to `expired` around day 58 and asks the tenant to reconnect for no
    # reason. META_INBOX_ENABLED above is useless without them.
    {
      name      = "META_APP_ID"
      secret_id = "meta-app-id"
    },
    {
      name      = "META_APP_SECRET"
      secret_id = "meta-app-secret"
    },
    # Threads uses its OWN app id + secret from the "Access the Threads API" use case —
    # graph.threads.net rejects the Meta pair. Same distinction as k8s/scripts/sync-secrets.ps1.
    {
      name      = "THREADS_APP_ID"
      secret_id = "threads-app-id"
    },
    {
      name      = "THREADS_APP_SECRET"
      secret_id = "threads-app-secret"
    },
    # LinkedIn + Google (GBP/YouTube) stay unbound: `linkedin-client-id/secret` and
    # `google-oauth-client-id/secret` exist in Secret Manager but have NO enabled version,
    # and a Cloud Run env-from-secret binding requires one — adding these blocks before
    # `gcloud secrets versions add` lands would fail the apply. Bind each pair as its
    # version arrives; see the SECRET SEQUENCING checklist in this service's header.
  ]

  pubsub_topic                 = "social.post.due"
  pubsub_subscription_name     = "social.post.due.social-worker-cloudrun"
  pubsub_invoker_sa_email      = google_service_account.pubsub_invoker.email
  pubsub_dead_letter_topic_id  = module.pubsub.dead_letter_topic == null ? null : "projects/${var.project_id}/topics/${module.pubsub.dead_letter_topic}"
  pubsub_max_delivery_attempts = 5

  # Further subscriptions to the SAME service — the handler fans in on the event type.
  # All share the invoker SA + DLQ + retry policy.
  #   · metrics.collect    — snapshot each published target's numbers ("Measure")
  #   · connection.check   — refresh a grant ahead of expiry, or flip it to `expired`
  #                          so the tenant sees "reconnect needed" before a post is lost
  #   · inbox.sync / reply — the engagement inbox's pull + push ("Engage")
  # Every one of these is network I/O against a platform API, which is exactly why it
  # rides the worker rather than the api-rest tick that finds the due work.
  additional_subscriptions = [
    {
      topic             = "social.metrics.collect"
      subscription_name = "social.metrics.collect.social-worker-cloudrun"
    },
    {
      topic             = "social.connection.check"
      subscription_name = "social.connection.check.social-worker-cloudrun"
    },
    {
      topic             = "social.inbox.sync"
      subscription_name = "social.inbox.sync.social-worker-cloudrun"
    },
    {
      topic             = "social.inbox.reply"
      subscription_name = "social.inbox.reply.social-worker-cloudrun"
    },
  ]

  depends_on = [
    module.pubsub,
    google_project_iam_member.social_worker_roles,
    google_service_account_iam_member.pubsub_invoker_token_creator,
  ]
}

# ─── legal-seed-worker ────────────────────────────────────────────────────
#
# Seeds a new tenant's starter legal pages (privacy/terms/cookie-policy/
# returns/shipping/refund) as editable CMS drafts + footer placements on
# tenant.created (docs/42 §3). Light DB-only work; idempotent on redelivery.

module "legal_seed_worker_cloudrun" {
  source = "../../modules/cloud-run-worker"

  name                  = "legal-seed-worker"
  project_id            = var.project_id
  region                = var.region
  image                 = "${var.region}-docker.pkg.dev/${var.project_id}/sparx/legal-seed-worker:latest"
  service_account_email = google_service_account.legal_seed_worker.email
  vpc_connector_id      = google_vpc_access_connector.workers.id

  # A few Prisma writes per tenant — light. Scale-to-zero; tenant creation is
  # infrequent so cold starts are acceptable.
  min_instance_count    = 0
  max_instance_count    = 4
  container_concurrency = 8
  cpu                   = "1"
  memory                = "512Mi"
  timeout_seconds       = 120

  env_vars = {
    NODE_ENV          = "production"
    SERVICE_NAME      = "legal-seed-worker"
    LOG_LEVEL         = "info"
    PUBSUB_INVOKER_SA = google_service_account.pubsub_invoker.email
  }

  secrets = [
    {
      name = "DATABASE_URL"
      # Cloud-Run-reachable DB URL (PgBouncer internal-LB IP, not the kube-DNS
      # name). See the `database-url-cloudrun` note in main.tf.
      secret_id = "database-url-cloudrun"
    },
  ]

  pubsub_topic                 = "tenant.created"
  pubsub_subscription_name     = "tenant.created.legal-seed-worker-cloudrun"
  pubsub_invoker_sa_email      = google_service_account.pubsub_invoker.email
  pubsub_dead_letter_topic_id  = module.pubsub.dead_letter_topic == null ? null : "projects/${var.project_id}/topics/${module.pubsub.dead_letter_topic}"
  pubsub_max_delivery_attempts = 5

  depends_on = [
    module.pubsub,
    google_project_iam_member.legal_seed_worker_roles,
    google_service_account_iam_member.pubsub_invoker_token_creator,
  ]
}

# ─── platform-crm-worker ──────────────────────────────────────────────────
#
# sparx's own customer base, kept in sparx (docs/140). Mirrors tenant lifecycle
# into the PLATFORM tenant's CRM: tenant.created puts a contact + a deal on the
# "Tenant Signups" pipeline; tenant.updated keeps the name honest; module.* and
# tenant.subscription.changed move that deal through trial → activated → paying
# / churned.
#
# Its OWN subscription on tenant.created, separate from the legal-seed-worker's:
# a CRM failure must not re-run legal seeding (and vice versa), and each keeps
# its own retry + DLQ. Light DB-only work; scale-to-zero.

module "platform_crm_worker_cloudrun" {
  source = "../../modules/cloud-run-worker"

  name                  = "platform-crm-worker"
  project_id            = var.project_id
  region                = var.region
  image                 = "${var.region}-docker.pkg.dev/${var.project_id}/sparx/platform-crm-worker:latest"
  service_account_email = google_service_account.platform_crm_worker.email
  vpc_connector_id      = google_vpc_access_connector.workers.id

  # A handful of Prisma reads + writes per message. Signups and module toggles
  # are infrequent, so cold starts are acceptable.
  min_instance_count    = 0
  max_instance_count    = 4
  container_concurrency = 8
  cpu                   = "1"
  memory                = "512Mi"
  timeout_seconds       = 120

  env_vars = {
    NODE_ENV                 = "production"
    SERVICE_NAME             = "platform-crm-worker"
    LOG_LEVEL                = "info"
    PUBSUB_INVOKER_SA        = google_service_account.pubsub_invoker.email
    SPARX_PLATFORM_TENANT_ID = var.platform_tenant_id
  }

  secrets = [
    {
      name = "DATABASE_URL"
      # Cloud-Run-reachable DB URL (PgBouncer internal-LB IP, not the kube-DNS
      # name). See the `database-url-cloudrun` note in main.tf.
      secret_id = "database-url-cloudrun"
    },
  ]

  pubsub_topic                 = "tenant.created"
  pubsub_subscription_name     = "tenant.created.platform-crm-worker-cloudrun"
  pubsub_invoker_sa_email      = google_service_account.pubsub_invoker.email
  pubsub_dead_letter_topic_id  = module.pubsub.dead_letter_topic == null ? null : "projects/${var.project_id}/topics/${module.pubsub.dead_letter_topic}"
  pubsub_max_delivery_attempts = 5

  # The lifecycle after signup. Same service because it is the same board — the
  # router in src/handler.ts fans these in.
  additional_subscriptions = [
    {
      topic             = "tenant.updated"
      subscription_name = "tenant.updated.platform-crm-worker-cloudrun"
    },
    {
      topic             = "tenant.subscription.changed"
      subscription_name = "tenant.subscription.changed.platform-crm-worker-cloudrun"
    },
    {
      topic             = "module.activated"
      subscription_name = "module.activated.platform-crm-worker-cloudrun"
    },
    {
      topic             = "module.deactivated"
      subscription_name = "module.deactivated.platform-crm-worker-cloudrun"
    },
  ]

  depends_on = [
    module.pubsub,
    google_project_iam_member.platform_crm_worker_roles,
    google_service_account_iam_member.pubsub_invoker_token_creator,
  ]
}

# platform-crm-backfill — the one-off that puts tenants who signed up BEFORE the
# worker existed onto the signup board (docs/140 §7).
#
# A Cloud Run JOB on the worker's OWN image rather than a packages/db backfill:
# the mirror writes through the CRM service layer under RLS, so it has to run as
# the same identity and in the same runtime the worker uses in production. The
# db-migrate path runs as the migration owner doing raw data rewrites — a
# different privilege context than this code is built for, and it would drag the
# whole CRM service layer into the migration image.
#
# DRY-RUN BY DEFAULT. The declared args omit `--apply`, so a bare
# `gcloud run jobs execute` only reports. To actually write:
#   gcloud run jobs execute platform-crm-backfill --region us-central1 --wait \
#     --args=--import,tsx,scripts/backfill-tenants.ts,--apply
# (an execution-time override — the safe default stays in state, no drift).
#
# Costs nothing at rest: a Job bills only while an execution runs.

resource "google_cloud_run_v2_job" "platform_crm_backfill" {
  name     = "platform-crm-backfill"
  project  = var.project_id
  location = var.region

  template {
    template {
      service_account = google_service_account.platform_crm_worker.email
      timeout         = "1800s"
      max_retries     = 1

      vpc_access {
        connector = google_vpc_access_connector.workers.id
        egress    = "PRIVATE_RANGES_ONLY"
      }

      containers {
        image   = "${var.region}-docker.pkg.dev/${var.project_id}/sparx/platform-crm-worker:latest"
        command = ["node"]
        args    = ["--import", "tsx", "scripts/backfill-tenants.ts"]

        env {
          name  = "NODE_ENV"
          value = "production"
        }
        env {
          name  = "LOG_LEVEL"
          value = "info"
        }
        env {
          name  = "SPARX_PLATFORM_TENANT_ID"
          value = var.platform_tenant_id
        }
        env {
          name = "DATABASE_URL"
          value_source {
            secret_key_ref {
              secret  = "database-url-cloudrun"
              version = "latest"
            }
          }
        }

        resources {
          limits = {
            cpu    = "1"
            memory = "512Mi"
          }
        }
      }
    }
  }

  lifecycle {
    # CI bumps the image tag on the worker; the job follows `:latest` and should
    # not fight a pinned value in state.
    ignore_changes = [template[0].template[0].containers[0].image]
  }

  depends_on = [google_project_iam_member.platform_crm_worker_roles]
}

# domain-worker — finalizes PURCHASED domains (docs/24 §4-5). Consumes
# domain.purchased: retries the GoDaddy DNS config if the synchronous call at
# purchase failed, polls CNAME propagation, then flips the domain pending_ssl →
# active. Without this subscriber, a purchase writes GoDaddy DNS but the row
# never advances. (Go-live no longer DEPENDS on this — a purchased domain is
# trusted/routable immediately in resolveSiteByHost — but the worker keeps status
# accurate and retries a failed DNS write.)
#
# The image is already built + pushed by build-images-gcp.yml; this is the missing
# Cloud Run + subscription wiring (the `domain.purchased = ["worker-domain"]` map
# entry in main.tf only created an idle pull sub — nothing consumed the event).
#
# The nightly renewal-reminder cron (POST /internal/cron/renewal-check) is NOT
# wired in THIS env and will not be. It was deferred here because Cloud
# Scheduler could not carry the x-sparx-internal-cron-token header without
# putting the secret in the job config, which wanted an OIDC email-claim check
# like the automation-worker tick. That follow-up was never done, so the sweep
# never ran anywhere — a purchased domain reached its expiry with the platform
# silent. It is now scheduled in the live deployment by an in-cluster CronJob
# (k8s/cronjobs/domain-renewal-check.yaml), which mounts the token from
# sparx-app-secrets and needs no OIDC at all. This file stays validate-clean as
# history; do not add the Scheduler job here.
resource "google_service_account" "domain_worker" {
  account_id   = "sparx-domain-worker"
  display_name = "Sparx domain-worker (Cloud Run)"
  description  = "Runtime SA for the domain-worker. Reads the DB URL + GoDaddy API creds from Secret Manager, configures purchased-domain DNS, and publishes renewal-reminder email.send events."
}

resource "google_project_iam_member" "domain_worker_roles" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/secretmanager.secretAccessor",
    # The renewal-reminder cron publishes email.send to Pub/Sub.
    "roles/pubsub.publisher",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.domain_worker.email}"
}

module "domain_worker_cloudrun" {
  source = "../../modules/cloud-run-worker"

  name                  = "domain-worker"
  project_id            = var.project_id
  region                = var.region
  image                 = "${var.region}-docker.pkg.dev/${var.project_id}/sparx/domain-worker:latest"
  service_account_email = google_service_account.domain_worker.email
  vpc_connector_id      = google_vpc_access_connector.workers.id

  min_instance_count    = 0
  max_instance_count    = 5
  container_concurrency = 4
  cpu                   = "1"
  memory                = "512Mi"
  # A CNAME poll that hasn't propagated throws → 500 → Pub/Sub redelivers with
  # backoff, so the handler stays fast; the retry policy does the waiting.
  timeout_seconds = 120

  env_vars = {
    NODE_ENV          = "production"
    SERVICE_NAME      = "domain-worker"
    LOG_LEVEL         = "info"
    PUBSUB_INVOKER_SA = google_service_account.pubsub_invoker.email
    # Real per-topic Pub/Sub for the renewal-reminder email.send events.
    GCP_PROJECT_ID = var.project_id
    # CNAME target purchased domains point at — matches buildSparxDnsRecords().
    SPARX_CNAME_TARGET  = "customers.sparx.zone"
    SPARX_DASHBOARD_URL = "https://app.sparx.works"
  }

  secrets = [
    {
      name = "DATABASE_URL"
      # Cloud-Run-reachable DB URL (PgBouncer internal-LB IP, not the kube-DNS
      # name). See the `database-url-cloudrun` note in main.tf.
      secret_id = "database-url-cloudrun"
    },
    # NODE_ENV=production selects the *_PROD GoDaddy pair for the DNS-config retry.
    {
      name      = "GODADDY_API_KEY_PROD"
      secret_id = "godaddy-api-key-prod"
    },
    {
      name      = "GODADDY_API_SECRET_PROD"
      secret_id = "godaddy-api-secret-prod"
    },
    # Guards POST /internal/cron/renewal-check (used once the cron is scheduled).
    {
      name      = "SPARX_INTERNAL_CRON_TOKEN"
      secret_id = "sparx-internal-cron-token"
    },
  ]

  pubsub_topic                 = "domain.purchased"
  pubsub_subscription_name     = "domain.purchased.domain-worker-cloudrun"
  pubsub_invoker_sa_email      = google_service_account.pubsub_invoker.email
  pubsub_dead_letter_topic_id  = module.pubsub.dead_letter_topic == null ? null : "projects/${var.project_id}/topics/${module.pubsub.dead_letter_topic}"
  pubsub_max_delivery_attempts = 5

  depends_on = [
    module.pubsub,
    google_project_iam_member.domain_worker_roles,
    google_service_account_iam_member.pubsub_invoker_token_creator,
  ]
}

# ─── dropship-worker ───────────────────────────────────────────────────────
#
# Catalog sync + order routing for connected dropship suppliers (docs/14).
# Fans in three topics: dropship.supplier.sync_started (pull a supplier's
# catalog), dropship.order.route (submit an order's dropship line items to
# their suppliers), and order.placed (the automatic trigger for the latter —
# see the order.placed comment in main.tf). Publishes sync/order outcomes
# (dropship.supplier.sync_completed/error, dropship.order.submitted/failed,
# variant.cost.updated) back to Pub/Sub.
#
# Found completely undeployed 2026-07-12 during the pre-launch e2e sweep: the
# service, its topics, and this module block never existed — the dropship
# code was fully built but had zero production footprint.

resource "google_service_account" "dropship_worker" {
  account_id   = "sparx-dropship-worker"
  display_name = "Sparx dropship-worker (Cloud Run)"
  description  = "Runtime SA for the dropship-worker Cloud Run service. Reads the DB URL from Secret Manager, syncs supplier catalogs, routes orders to suppliers, and publishes sync/order outcome events."
}

# pubsub.publisher because this worker PUBLISHES — dropship.supplier.sync_completed
# / dropship.supplier.error / dropship.order.submitted / dropship.order.failed /
# variant.cost.updated (markup recompute fan-out on a supplier cost move).
resource "google_project_iam_member" "dropship_worker_roles" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/secretmanager.secretAccessor",
    "roles/pubsub.publisher",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.dropship_worker.email}"
}

module "dropship_worker_cloudrun" {
  source = "../../modules/cloud-run-worker"

  name                  = "dropship-worker"
  project_id            = var.project_id
  region                = var.region
  image                 = "${var.region}-docker.pkg.dev/${var.project_id}/sparx/dropship-worker:latest"
  service_account_email = google_service_account.dropship_worker.email
  vpc_connector_id      = google_vpc_access_connector.workers.id

  min_instance_count    = 0
  max_instance_count    = 10
  container_concurrency = 4
  cpu                   = "1"
  memory                = "512Mi"
  # A full supplier catalog sync pages through every product with a DB
  # upsert each — give it real room. Must be >= pubsub_ack_deadline_seconds.
  timeout_seconds = 300

  env_vars = {
    NODE_ENV          = "production"
    SERVICE_NAME      = "dropship-worker"
    LOG_LEVEL         = "info"
    PUBSUB_INVOKER_SA = google_service_account.pubsub_invoker.email
    # Set so downstream events (sync/order outcomes, variant.cost.updated) publish.
    GCP_PROJECT_ID = var.project_id
  }

  secrets = [
    {
      name = "DATABASE_URL"
      # Cloud-Run-reachable DB URL (PgBouncer internal-LB IP, not the kube-DNS
      # name). See the `database-url-cloudrun` note in main.tf.
      secret_id = "database-url-cloudrun"
    },
  ]

  # Primary subscription = dropship.supplier.sync_started. order.placed +
  # dropship.order.route (both route to the same handler — see
  # services/dropship-worker/src/handler.ts) attach as additional subscriptions.
  pubsub_topic                 = "dropship.supplier.sync_started"
  pubsub_subscription_name     = "dropship.supplier.sync_started.dropship-worker-cloudrun"
  pubsub_ack_deadline_seconds  = 300
  pubsub_invoker_sa_email      = google_service_account.pubsub_invoker.email
  pubsub_dead_letter_topic_id  = module.pubsub.dead_letter_topic == null ? null : "projects/${var.project_id}/topics/${module.pubsub.dead_letter_topic}"
  pubsub_max_delivery_attempts = 5

  additional_subscriptions = [
    { topic = "dropship.order.route", subscription_name = "dropship.order.route.dropship-worker-cloudrun" },
    { topic = "order.placed", subscription_name = "order.placed.dropship-worker-cloudrun" },
  ]

  depends_on = [
    module.pubsub,
    google_project_iam_member.dropship_worker_roles,
    google_service_account_iam_member.pubsub_invoker_token_creator,
  ]
}
