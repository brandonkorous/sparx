# ---------------------------------------------------------------------------
# jotDOJO — everything a SECOND product needs from sparx's Azure footprint.
#
# jotDOJO (jotdojo.com) lives in its own repository (jotDOJO) and deploys from
# its own pipeline. It is NOT part of sparx and not part of piggles: piggles
# ships inside this repo and therefore shares this repo's Key Vault, its
# `sparx-app-secrets`, and its release. jotDOJO shares none of those — only the
# CLUSTER and the DATABASE SERVER, both of which are defined here, which is the
# entire reason this file exists.
#
# ONE FILE, deliberately, and it is the removal story. Everything jotDOJO owns
# in this subscription is in this file; deleting it and running `terraform apply`
# takes the whole product's infrastructure with it and touches nothing of
# sparx's. That property is worth more than filing each resource next to its
# same-typed neighbours, and it is why the variables are co-located here too
# rather than in variables.tf.
#
# WHAT IS NOT HERE: the workloads. Terraform does not manage workloads in this
# environment (see providers.tf) and must not start to. jotDOJO's Deployments,
# Services and namespace are plain YAML in the jotDOJO repo under `infra/k8s/`
# — its ADR-026 rules out Helm and Kustomize, and nothing here overrides that.
# The only cluster-side change sparx owns is the Caddy routing table
# (k8s/ingress/Caddyfile) plus the TLS allow-list entries in
# wizeworks/services/api-rest/src/routes/internal/domain-check.ts.
# ---------------------------------------------------------------------------

variable "jotdojo_enabled" {
  description = <<-EOT
    Master switch for the whole file. Off leaves jotDOJO with no database, no
    vault, no storage and no CI identity — which is the correct state until the
    jotDOJO repo is actually ready to deploy, because an empty Key Vault and an
    unused app registration are both things that look configured and are not.

    Turning it on is additive and cheap: see the cost note on each resource. The
    only line item that is not effectively free is storage, and that bills by
    consumption from zero.
  EOT
  type        = bool
  default     = true
}

variable "jotdojo_github_repository" {
  description = <<-EOT
    `owner/repo` of the repository whose Actions runs may assume jotDOJO's Azure
    identity. The FEDERATED SUBJECT is built from this string, and Entra matches a
    subject EXACTLY — a fork, a rename, or a different repo under the same owner
    produces a different subject and simply cannot authenticate.

    VERIFIED against the repository's own remote on 2026-08-21:
    `git remote -v` in the checkout reports
    https://github.com/brandonkorous/jotdojo.git. Read from git rather than
    transcribed from a message, deliberately — see the casing note.

    CASE MATTERS, AND THIS IS THE CASE THAT BITES. GitHub's OIDC `sub` claim
    carries the repository's canonical casing, so the repo is `jotdojo` in this
    string even though the local DIRECTORY is `jotDOJO` and the product is
    styled jotDOJO everywhere a human reads it. GitHub routes a browser to
    either spelling, which is exactly why the wrong one survives review: it
    works in every place except the token exchange, where it produces
    "no matching federated identity credential" with nothing in the message
    pointing at the letter that is wrong.

    The DIRECTORY name is not this value and never was. Only what GitHub serves
    reaches the token.
  EOT
  type        = string
  default     = "brandonkorous/jotdojo"

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.jotdojo_github_repository))
    error_message = "jotdojo_github_repository must be in `owner/repo` form."
  }
}

variable "jotdojo_github_branches" {
  description = <<-EOT
    Branches whose pushes may assume the identity. One federated credential is
    created per entry.

    `main` ONLY. This briefly carried `master` as well, because the checkout was
    created by a `git init` old enough to default to it and there was no remote to
    settle the question. It is settled now: the repository publishes from `main`,
    matching every other repo here.

    THE LOCAL CHECKOUT WAS STILL ON `master` WHEN THIS WAS WRITTEN. That rename
    has to actually happen — `git branch -m master main` — before the first
    deploy, or the workflow runs on a ref no credential here matches and the
    token exchange fails with "no matching federated identity credential",
    which says nothing about branches.

    Adding a branch is free if one is ever needed: federated credentials cost
    nothing, an app supports 20, and a credential for a ref that never receives a
    push is inert.
  EOT
  type        = set(string)
  default     = ["main"]
}

variable "jotdojo_key_vault_name" {
  description = <<-EOT
    GLOBALLY unique across all of Azure (it is a DNS label), 3-24 characters,
    alphanumerics and hyphens, must start with a letter.

    Kept separate from sparx's vault rather than sharing one with a name prefix.
    A vault is the smallest thing Key Vault RBAC can scope a role to, so one
    vault per product is the only way jotDOJO's pipeline can read jotDOJO's
    secrets without also being able to read every sparx credential — the
    `Key Vault Secrets User` role below would otherwise grant exactly that.
  EOT
  type        = string
  default     = "kv-jotdojo-prod-cus"

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9-]{1,22}[a-zA-Z0-9]$", var.jotdojo_key_vault_name))
    error_message = "Key Vault names are 3-24 chars, start with a letter, end alphanumeric, and allow only letters, digits and hyphens."
  }
}

locals {
  jotdojo_count = var.jotdojo_enabled ? 1 : 0
  jotdojo_repo  = var.jotdojo_github_repository
}

# The caller's tenant, subscription and object id. bootstrap-azure declares its
# own copy; this environment had never needed one because nothing in it addressed
# the directory until the vault and the app registration below.
#
# `object_id` is the identity running Terraform — a human at `az login` locally,
# the Actions service principal in CI. It is used for the two OWNER/OFFICER
# grants, which is why applying this file as one identity and then loading
# secrets as another leaves the second one unable to write: the role went to
# whoever ran the apply.
data "azurerm_client_config" "current" {}

# ---------------------------------------------------------------------------
# Database — a SEPARATE DATABASE on sparx's existing server, never a schema.
#
# The question this answers is "can jotDOJO share sparx's Postgres, with its own
# schema?" Sharing the SERVER: yes, and it is free — Flexible Server bills per
# server, so a second database on it costs exactly nothing. Sharing the DATABASE
# with a schema: no, and the reasons are not stylistic.
#
#   1. BACKUP AND RESTORE ARE PER-SERVER, BUT PITR IS PER-SERVER TOO. A schema
#      inside `sparx` would make a point-in-time restore of sparx roll jotDOJO
#      back to the same instant. Two products whose recovery stories are welded
#      together is a real operational hazard the moment either has users. A
#      separate database does not fix PITR granularity — that is still
#      server-wide — but it does mean a logical `pg_dump`/restore of one is
#      possible without touching the other.
#   2. ROLES AND RLS. Both products enforce tenancy with row-level security and
#      a restricted application role. sparx's is `sparx_app` against
#      `current_tenant_id()`; jotDOJO's is `jotdojo_app` against
#      `app.actor_id`. Two RLS regimes sharing a database means one `GRANT` typo
#      is a cross-PRODUCT data leak rather than a bug in one of them.
#   3. EXTENSIONS ARE PER-DATABASE OBJECTS. `CREATE EXTENSION vector` installs
#      into a specific database. jotDOJO needs vector/pg_trgm/citext; sparx
#      needs neither, and there is no reason for sparx's schema to carry them.
#      (The server-level ALLOW-LIST is shared and unavoidable — see main.tf.)
#   4. MIGRATIONS. Two independent migration runners against one database will
#      eventually both take a lock, and neither knows the other exists.
#
# THE REAL CONSTRAINT IS CONNECTIONS, NOT STORAGE OR CPU. B1ms is capped at 50
# max_connections — a hard, tier-specific ceiling, not a tunable — and sparx
# already draws on it. jotDOJO's `packages/db/src/client.ts` opens
# `postgres(url, { max: 10 })`, so four services at their default is FORTY
# connections and does not fit. That is a change in the jotDOJO repo (make the
# pool size read an env var and set it low), not something this file can fix.
# Raising the tier is the alternative and it is not cheap: B1ms is $0.01921/hr
# (~$14/mo) and the next step B2s is $0.07684/hr (~$56/mo) — FOUR times, not
# double, because Azure prices the burstable series per vCore-hour and B2s is
# also a bigger core. Do not scale it reflexively; cap the pools first.
# ---------------------------------------------------------------------------
resource "azurerm_postgresql_flexible_server_database" "jotdojo" {
  count     = local.jotdojo_count
  name      = "jotdojo"
  server_id = azurerm_postgresql_flexible_server.main.id
  collation = "en_US.utf8"
  charset   = "utf8"

  lifecycle {
    # Same posture as the `sparx` database beside it. Losing this is losing
    # another product's data, and a database is a one-line resource — exactly the
    # kind of thing a careless refactor drops.
    prevent_destroy = true
  }
}

# ---------------------------------------------------------------------------
# Key Vault — jotDOJO's own, for the same reasons sparx has one.
#
# COST is a rounding error, identical to sparx's vault: Standard tier has no base
# fee, secret storage is free, and operations are $0.03 per 10,000. A pipeline
# reading a dozen secrets per run costs thousandths of a cent. Standard, never
# Premium — Premium buys HSM-backed cryptographic KEYS, which neither product
# uses.
#
# WHAT GOES IN IT (jotDOJO's .env.example is the authority, not this list):
#   DATABASE_URL              the RESTRICTED jotdojo_app role. Never the owner —
#                             PostgreSQL exempts superusers and BYPASSRLS roles
#                             from every policy, so an admin connection string
#                             turns the tenancy boundary off while every policy
#                             still reads as though it were enforced. jotDOJO's
#                             infra/README.md calls this out as the one thing not
#                             to get wrong, and `pnpm db:smoke` proves it holds.
#   DATABASE_ADMIN_URL        owner connection. MIGRATIONS ONLY, never the app.
#   AUTH_SECRET               NextAuth session signing key.
#   AUTH_GOOGLE_ID / _SECRET  Google OAuth client.
#   AZURE_STORAGE_*           the account below, for ink/audio/image blobs.
#   OPENAI_API_KEY or the AZURE_OPENAI_* trio, if embeddings are switched on.
#   ANTHROPIC_API_KEY         if handwriting recognition is switched on.
# ---------------------------------------------------------------------------
resource "azurerm_key_vault" "jotdojo" {
  count               = local.jotdojo_count
  name                = var.jotdojo_key_vault_name
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = "standard"
  tags                = local.tags

  # RBAC, not the legacy access-policy model — same choice as sparx's vault.
  # Access policies are per-vault ACLs that Terraform and the portal fight over.
  rbac_authorization_enabled = true

  soft_delete_retention_days = 7

  # Deliberately FALSE, and this is the one place jotDOJO's vault differs from
  # sparx's on purpose. Purge protection is ONE-WAY — once true it can never be
  # set false, and a destroyed vault keeps its NAME reserved for the whole
  # retention window, so rebuilding means picking a new name. sparx's vault holds
  # the credentials of a live platform and is worth that price. jotDOJO has not
  # launched; locking its vault name before the first deploy would mean a single
  # early teardown costs the name `kv-jotdojo-prod-cus` for a week.
  #
  # FLIP THIS TO TRUE AT LAUNCH. It is the same one-line change either way, and
  # after there are real users the argument reverses completely.
  purge_protection_enabled = false

  lifecycle {
    # bootstrap-azure holds sparx's vault partly so a `terraform destroy` HERE
    # can never take the platform's secrets with the cluster. jotDOJO's vault
    # stays in this environment (see the note at the foot of this file), so it
    # needs that protection stated rather than inherited from where it lives.
    #
    # Purge protection is deliberately off until launch, which makes this the
    # ONLY thing standing between a careless destroy and a vault that has to be
    # rebuilt under a different name — soft delete reserves the old one for the
    # whole retention window.
    prevent_destroy = true
  }
}

# ---------------------------------------------------------------------------
# Blob storage — ink strokes, audio, images, and rendered ink previews.
#
# jotDOJO's architecture doc puts these behind SAS URLs and explicitly never
# proxies them through the API. That is a different posture from sparx's media
# account, whose `media-public` container is private precisely BECAUSE api-rest
# serves variants itself — so the two accounts are not interchangeable and
# jotDOJO gets its own rather than a container in sparx's.
#
# LRS, not GRS: geo-redundancy roughly doubles the price, and the recovery story
# it buys is not one a pre-launch product needs. Hot tier — a note's ink preview
# is read every time the note is opened.
#
# `allow_nested_items_to_be_public = false` is the important line. Ink and audio
# are the most private thing in the product; the SAS-URL design means nothing
# ever needs anonymous access, so the account refuses to grant it at all rather
# than relying on every future container getting its access level right.
# ---------------------------------------------------------------------------
resource "azurerm_storage_account" "jotdojo" {
  count = local.jotdojo_count

  # Storage account names are globally unique, 3-24 chars, lowercase alphanumeric
  # ONLY — no hyphens, which is why this does not read like the other names here.
  name                     = "stjotdojoprodcus"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  account_kind             = "StorageV2"
  access_tier              = "Hot"
  tags                     = local.tags

  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false
  shared_access_key_enabled       = true

  # Photos upload from the BROWSER straight to blob storage, so the account
  # needs CORS or nothing can be added at all.
  #
  # `Photos.tsx` asks the app for a short-lived SAS URL and then PUTs the file
  # to it directly. That keeps whole images out of the app's request path,
  # which is the right shape — and it makes the upload a cross-origin request
  # from https://app.jotdojo.com to *.blob.core.windows.net. Without a matching
  # rule Azure answers the preflight with "403 CORS not enabled or no matching
  # rule found for this request", the PUT never runs, and the app sees only a
  # failed fetch with nothing useful to report.
  #
  # x-ms-blob-type is not optional: every block-blob PUT carries it, and a
  # header missing from this list fails the preflight exactly as a missing
  # origin would.
  blob_properties {
    cors_rule {
      allowed_origins = ["https://app.jotdojo.com"]
      allowed_methods = ["GET", "HEAD", "PUT", "OPTIONS"]
      allowed_headers = [
        "x-ms-blob-type",
        "x-ms-blob-content-type",
        "content-type",
        "content-length",
      ]
      # ETag, so the client can confirm what landed. Azure exposes only the
      # simple response headers otherwise.
      exposed_headers    = ["etag"]
      max_age_in_seconds = 3600
    }
  }
}

# ONE container, because that is what the code actually addresses.
#
# This began as three — `ink`, `media`, `renders` — on the reasoning that
# splitting them would let a lifecycle rule expire derived renders while keeping
# strokes and audio forever. That reasoning is fine and the shape was still
# wrong: `packages/storage/src/resolve.ts` takes a SINGLE
# `AZURE_STORAGE_CONTAINER`, and every SAS URL it mints is
# `<origin>/<container>/<key>`. Two of the three would have been created,
# monitored, and never written to — infrastructure that reads as though it is
# holding something.
#
# Separation is by KEY PREFIX instead (`mediaKey(spaceId, assetId, ext)` in
# packages/domain/src/media.ts), which a blob lifecycle rule can match on just as
# well. If the split ever needs to be physical, it is a container per store
# instance and a config change in that package — not something to pre-build here.
resource "azurerm_storage_container" "jotdojo" {
  count = local.jotdojo_count

  # Must equal AZURE_STORAGE_CONTAINER in the deployment's config.
  name               = "media"
  storage_account_id = azurerm_storage_account.jotdojo[0].id

  # Private. Reads happen through short-lived SAS URLs the domain layer mints;
  # there is no anonymous path and there should never be one.
  container_access_type = "private"
}


# ---------------------------------------------------------------------------
# Azure OpenAI - the four model seams, funded by the credit rather than a card.
#
# jotDOJO has four provider seams (`packages/vision`, `speech`, `embeddings`,
# `reason`) and each already speaks Azure OpenAI: they build
# `<endpoint>/openai/deployments/<name>/...?api-version=` and send `api-key`.
# Nothing in the jotDOJO repo changes to adopt this - only these secrets.
#
# WHY THIS EXISTS AT ALL. Three of the four are not optional flourishes. An
# agent cannot read a stroke, and jotDOJO's whole premise is that a user's own
# assistant reads their notes over MCP: without recognition, `get_note` hands
# that assistant a coordinate array. Recognition is the thing that makes the
# product legible to the thing that consumes it.
#
# THE KEY IS WRITTEN HERE AND NEVER TYPED, which is the same property the
# generated passwords below have and for the same reason - a hand-transcribed
# credential is a crashloop two stages later with nothing pointing at the typo.
#
# WHY NOT MANAGED IDENTITY, which would mean no key anywhere. Three things
# block it today, and none is a matter of taste:
#   1. A role assignment needs `Microsoft.Authorization/roleAssignments/write`.
#      THIS environment is applied by the release, whose identity holds
#      Contributor and cannot grant roles - the 403 recorded at the foot of this
#      file. It would have to move to bootstrap-azure, applied by a human.
#   2. All four seams send `api-key: <key>`, not `Authorization: Bearer <token>`.
#      Entra auth is a code change in the jotDOJO repo, times four.
#   3. The pods would need AKS workload identity - a federated credential and a
#      service-account annotation in jotDOJO's `infra/k8s/`.
# Worth doing later; it is a project, not a line. Until then the key lives in
# the vault beside DATABASE-URL, under the same RBAC, read by the same pipeline.
# ---------------------------------------------------------------------------

variable "jotdojo_ai_enabled" {
  description = <<-EOT
    Master switch for the account, the four deployments, and the eleven secrets
    that point at them. Off is a real state, not a broken one: every seam's
    `resolve*()` returns null when its PROVIDER variable is absent, so jotDOJO
    deploys and runs with recognition, transcription, semantic search and triage
    simply switched off.

    S0 has NO BASE FEE - an idle account and idle deployments bill nothing, and
    a deployment's `capacity` is a rate ceiling rather than a reservation. The
    cost of this section at zero usage is zero. Turn it off to close the spend
    ceiling, not to save a standing charge.
  EOT
  type        = bool
  default     = true
}

variable "jotdojo_ai_location" {
  description = <<-EOT
    DELIBERATELY NOT `var.location`, and this is the one decision in this
    section that cost a real investigation.

    Postgres and AKS must share a region because the VNet is regional. Azure
    OpenAI is reached over HTTPS from the cluster and shares nothing with the
    VNet, so it is under no such constraint - the only thing that moves is a few
    milliseconds on an already-asynchronous worker job.

    WHISPER IS NOT DEPLOYABLE IN centralus. Verified against this subscription
    on 2026-08-22 rather than recalled:

        az cognitiveservices model list -l <region>
          --query "[?kind=='OpenAI'].{m:model.name, sku:model.skus[0].name}"

        centralus       whisper                  None      <- no deployable SKU
        eastus2         whisper                  Standard
        northcentralus  whisper                  Standard

    A model can be LISTED in a region and carry no SKU, which is what `None`
    means and why a plain "is it available" check is not enough. eastus2 carries
    all three models this section needs at `Standard`, and quota is non-zero on
    each (whisper 3, gpt-4o-mini 450, text-embedding-3-small 350).

    WHY WHISPER AND NOT gpt-4o-mini-transcribe, which IS in centralus:
    `packages/speech/src/provider.ts` asks for `verbose_json` with word and
    segment `timestamp_granularities`, because the default response throws the
    timestamps away and getting them back means paying to transcribe twice. The
    gpt-4o transcribe models support neither option. The region follows the
    model, and the model follows a decision already made in the code.

    An unlisted region fails at plan time on `local.location_short` - see the
    map in main.tf. That is deliberate there and useful here.
  EOT
  type        = string
  default     = "eastus2"
}

variable "jotdojo_ai_capacity" {
  description = <<-EOT
    Per-deployment rate ceilings, in the units Azure quotes each model in:
    THOUSANDS OF TOKENS PER MINUTE for the three text models, and units of
    3 REQUESTS PER MINUTE for whisper. They are not the same scale, which is
    why `speech = 1` sits beside `vision = 100` without being a typo.

    These are LIMITS, NOT RESERVATIONS - Standard bills per token consumed, so a
    generous ceiling on an idle deployment costs nothing. They are set to
    isolate the seams from each other rather than to save money: a burst of
    handwriting recognition must not starve semantic search, and the regional
    quota is shared, so every unit given to one is unavailable to another.

    The sum must fit the region's quota. eastus2 on this subscription allows
    whisper 3, gpt-4o-mini 450 and text-embedding-3-small 350; the defaults
    below use 150 of the 450 and 100 of the 350, leaving room to raise one
    without a quota request.
  EOT
  type = object({
    vision    = number
    triage    = number
    embedding = number
    speech    = number
  })
  default = {
    # Handwriting and photographed pages - the bursty one, and the seam the MCP
    # server depends on for anything not typed.
    vision = 100
    # Reads one settled note and usually says nothing. Small on purpose.
    triage = 50
    # One vector per block on write, one per query on search.
    embedding = 100
    # Units of 3 RPM, and the regional limit is 3. This is a third of it.
    speech = 1
  }
}

locals {
  # Both switches, because AI is a sub-unit of jotDOJO: turning jotDOJO off must
  # take its models with it, not leave an orphaned account billing into a
  # subscription whose owner believes the product is gone.
  jotdojo_ai_on    = var.jotdojo_enabled && var.jotdojo_ai_enabled
  jotdojo_ai_count = local.jotdojo_ai_on ? 1 : 0

  # Named for ITS region, not the platform's. Every other jotDOJO resource ends
  # `-cus`; this one does not live there, and a name claiming otherwise is the
  # kind of small lie that costs somebody an hour during an incident.
  jotdojo_ai_loc  = local.location_short[var.jotdojo_ai_location]
  jotdojo_ai_name = "oai-jotdojo-prod-${local.jotdojo_ai_loc}"

  # VERSIONS ARE PINNED. Azure retires model versions on a published schedule,
  # and an auto-upgrade is a silent change to what the product says about
  # somebody's handwriting. `OnceCurrentVersionExpired` below is the compromise:
  # it will not move while the pin is valid, and it will not go dark when the
  # pin expires.
  jotdojo_ai_models = local.jotdojo_ai_on ? {
    # gpt-4o-mini twice, deliberately. Vision and triage are the same model and
    # separate deployments so their rate ceilings and their Azure cost metrics
    # are separable - one line per feature, not one line for "chat".
    vision    = { model = "gpt-4o-mini", version = "2024-07-18", capacity = var.jotdojo_ai_capacity.vision }
    triage    = { model = "gpt-4o-mini", version = "2024-07-18", capacity = var.jotdojo_ai_capacity.triage }
    embedding = { model = "text-embedding-3-small", version = "1", capacity = var.jotdojo_ai_capacity.embedding }
    speech    = { model = "whisper", version = "001", capacity = var.jotdojo_ai_capacity.speech }
  } : {}
}

# text-embedding-3-small IS THE 1536-DIMENSION MODEL, and that is not a
# coincidence to be re-litigated later. jotDOJO's `block_embeddings.embedding`
# is `vector(1536)` in 0000_init.sql, and `packages/embeddings/src/provider.ts`
# exports EMBEDDING_DIMENSIONS = 1536 and REFUSES a response of any other width.
# Changing this model is a migration and a full re-embed of every block.
resource "azurerm_cognitive_account" "jotdojo" {
  count               = local.jotdojo_ai_count
  name                = local.jotdojo_ai_name
  location            = var.jotdojo_ai_location
  resource_group_name = azurerm_resource_group.main.name
  kind                = "OpenAI"
  sku_name            = "S0"
  tags                = local.tags

  # REQUIRED, not cosmetic. Without a custom subdomain the account answers only
  # on the regional shared host, which does not serve the `/openai/deployments/`
  # data plane the four resolvers build their URLs against.
  custom_subdomain_name = local.jotdojo_ai_name

  # Public, and the honest note about it: AKS here uses `outbound_type =
  # "loadBalancer"`, so egress leaves through an AKS-MANAGED SNAT address with
  # no stable Terraform handle to put in a network ACL. An IP allow-list built
  # on that would break silently the first time AKS rotated it. The real
  # hardening is the managed identity described in this section's header, which
  # removes the key rather than the network path.
  public_network_access_enabled = true

  lifecycle {
    # A Cognitive Services account SOFT-DELETES and holds its name - including
    # the custom subdomain, which is a global DNS label. A careless destroy
    # therefore costs `oai-jotdojo-prod-eus2` for the retention window, and
    # every secret below has to be rewritten against a new name.
    prevent_destroy = true
  }
}

resource "azurerm_cognitive_deployment" "jotdojo" {
  for_each = local.jotdojo_ai_models

  # The seam's name, so a bill line, a metric and an env var all read the same.
  name                 = "jotdojo-${each.key}"
  cognitive_account_id = azurerm_cognitive_account.jotdojo[0].id

  model {
    format  = "OpenAI"
    name    = each.value.model
    version = each.value.version
  }

  sku {
    # Regional Standard, not GlobalStandard: whisper offers only Standard in
    # eastus2, and mixing the two would mean two different data-residency
    # stories for four seams reading the same notes.
    name     = "Standard"
    capacity = each.value.capacity
  }

  # Hold the pin until Azure retires it, then move rather than go dark. The
  # alternative, NoAutoUpgrade, turns a published retirement date into an
  # outage on a morning nobody chose.
  version_upgrade_option = "OnceCurrentVersionExpired"
}

locals {
  # ELEVEN SECRETS, and seven of them are not secret at all - the PROVIDER
  # switches, the endpoint, the API version and the deployment names. They are
  # here because the vault is the ONLY channel jotDOJO's release reads:
  # `release.yml` builds its env file from vault entries and nothing else, so a
  # value that is not here cannot reach the container. AZURE-STORAGE-ACCOUNT
  # above is carried for exactly that reason.
  #
  # THE PROVIDER SWITCHES ARE THE LOAD-BEARING PART. Every `resolve*()` in
  # jotDOJO reads its `*_PROVIDER` variable FIRST and returns null when it is
  # absent - so the endpoint, the key and all four deployment names can be
  # present and correct and every feature still be off, with no error anywhere.
  # That failure mode looks exactly like a working deployment.
  jotdojo_ai_secrets = local.jotdojo_ai_on ? {
    "VISION-PROVIDER" = {
      value = "azure"
      type  = "driver switch; absent means handwriting/image recognition is OFF"
    }
    "SPEECH-PROVIDER" = {
      value = "azure"
      type  = "driver switch; absent means transcription is OFF"
    }
    "EMBEDDING-PROVIDER" = {
      value = "azure"
      type  = "driver switch; absent costs search its semantic leg, not search"
    }
    "TRIAGE-PROVIDER" = {
      value = "azure"
      type  = "driver switch; absent means the triage agent never runs"
    }
    "AZURE-OPENAI-ENDPOINT" = {
      value = azurerm_cognitive_account.jotdojo[0].endpoint
      type  = "url; not secret. All four resolvers strip a trailing slash themselves"
    }
    "AZURE-OPENAI-API-KEY" = {
      value = azurerm_cognitive_account.jotdojo[0].primary_access_key
      type  = "account key; regenerating it in the portal makes this value stale"
    }
    "AZURE-OPENAI-API-VERSION" = {
      # Pinned rather than left to the code's default, so a version bump is a
      # vault edit instead of a jotDOJO release. 2024-10-21 serves both the chat
      # completions the text seams use and the audio/transcriptions whisper needs.
      value = "2024-10-21"
      type  = "api version; the code defaults to this same value if absent"
    }
    "AZURE-OPENAI-VISION-DEPLOYMENT" = {
      value = azurerm_cognitive_deployment.jotdojo["vision"].name
      type  = "deployment name; not secret"
    }
    "AZURE-OPENAI-SPEECH-DEPLOYMENT" = {
      value = azurerm_cognitive_deployment.jotdojo["speech"].name
      type  = "deployment name; not secret"
    }
    "AZURE-OPENAI-EMBEDDING-DEPLOYMENT" = {
      value = azurerm_cognitive_deployment.jotdojo["embedding"].name
      type  = "deployment name; not secret. The model is 1536-dim by requirement"
    }
    "AZURE-OPENAI-TRIAGE-DEPLOYMENT" = {
      value = azurerm_cognitive_deployment.jotdojo["triage"].name
      type  = "deployment name; not secret"
    }
  } : {}
}

output "jotdojo_openai_endpoint" {
  description = "Azure OpenAI data plane for jotDOJO's four model seams. Null when jotdojo_ai_enabled is false."
  value       = local.jotdojo_ai_on ? azurerm_cognitive_account.jotdojo[0].endpoint : null
}

# ---------------------------------------------------------------------------
# WHAT IS NOT IN THIS FILE, AND WHY — the CI identity and every role assignment.
#
# They live in terraform/bootstrap-azure/jotdojo.tf. They were here first, and
# the release failed on them with two 403s that are worth recording, because the
# plan and the validate were both perfectly green:
#
#   Authorization_RequestDenied         — creating `azuread_application`
#   Microsoft.Authorization/roleAssignments/write denied — every role assignment
#
# Neither is a bug in the code. This environment is applied by the RELEASE, using
# an identity that deliberately holds subscription Contributor and nothing more:
# Contributor cannot grant roles (that is the point — it stops the pipeline
# escalating its own privileges), and a directory app registration is tenant-wide
# rather than subscription-scoped, so it needs Graph rights the pipeline has
# never had and should not be given.
#
# bootstrap-azure is applied BY A HUMAN with Owner and directory rights, which is
# why every other app registration and role assignment in this repo already lived
# there. There were none in this environment before jotDOJO added some; the
# absence was the convention, and it is now documented rather than merely
# observed.
#
# THE VAULT STAYS HERE, unlike sparx's, and that is deliberate rather than
# inconsistent. The reasons bootstrap's own comment gives for holding the sparx
# vault are (1) the release reads those secrets in the same job that applies this
# environment, so a vault created here would be empty on first read, and (2) a
# destroy here must not take the secrets. Reason 1 does not apply: jotDOJO's
# release is a separate pipeline in a separate repository that never runs
# Terraform at all. Reason 2 does, and is handled by the `prevent_destroy` on the
# vault above. Moving it would also mean destroying and recreating a vault that
# already exists — and a Key Vault name stays globally reserved through the
# soft-delete window, so the move would cost the name for a week to fix nothing.
# ---------------------------------------------------------------------------

output "jotdojo_key_vault_name" {
  description = "Key Vault holding jotDOJO's secrets. Set as AZURE_KEY_VAULT_NAME on the jotDOJO repo."
  value       = var.jotdojo_enabled ? azurerm_key_vault.jotdojo[0].name : null
}

output "jotdojo_storage_account" {
  description = "Blob account for jotDOJO ink, audio and rendered previews."
  value       = var.jotdojo_enabled ? azurerm_storage_account.jotdojo[0].name : null
}

# ---------------------------------------------------------------------------
# SECRETS THE PLATFORM CAN KNOW BY ITSELF — generated here, written here, and
# never typed by a person.
#
# Eight secrets are required before jotDOJO will deploy. SIX of them are facts
# this configuration already holds or can mint: it knows the server FQDN, it
# knows the database name, it holds the storage key in state, and a password is
# only a random string. Asking a human to copy those into a vault is asking them
# to hand-transcribe values Terraform is already holding — which is not merely
# tedious, it is the step where one wrong character becomes a crashloop two
# stages later with nothing pointing back at the typo.
#
# THE TWO THAT ARE NOT HERE are AUTH-GOOGLE-ID and AUTH-GOOGLE-SECRET, absent
# for a reason no amount of automation removes: Google issues them to a human
# through a consent screen, against redirect URIs that same human registers.
# Nothing in Azure can mint a credential another company controls. Those two are
# set once, by hand, and then never again.
#
# WHY THIS DOES NOT WEAKEN THE POSTURE. jotDOJO's CI identity still holds
# `Key Vault Secrets User` — get and list, never write — so the pipeline that
# DEPLOYS jotDOJO still cannot rewrite a credential it then ships. What changes
# is that SPARX's release identity may write them, which is a different identity
# at a different moment: provisioning, not deploying. The property worth keeping
# was never "no automation writes secrets", it was "the thing that deploys
# cannot rewrite what it deploys". That still holds.
#
# WHERE THE VALUES LIVE. In Terraform state — the honest cost of this approach,
# stated here rather than discovered later. State is in `stsparxprodcustfstate`
# behind `use_azuread_auth`, and it ALREADY holds
# `random_password.postgres_admin`, the credential to the entire server. These
# add nothing to that blast radius.
# ---------------------------------------------------------------------------

# The owner of jotDOJO's database, and the answer to a question this file used
# to leave open.
#
# An Azure Flexible Server database is owned by the SERVER ADMIN unless something
# says otherwise, and this server's only admin is `sparx_owner`. Without this
# role, jotDOJO's DATABASE-ADMIN-URL would have to BE that admin — a credential
# opening the sparx and piggles databases just as readily — sitting in a
# Kubernetes Secret in the `jotdojo` namespace, readable by anything holding
# `get secrets` there. jotDOJO's migrations are not the threat; the blast radius
# around them is.
#
# The role is created by wizeworks/packages/db/sql/jotdojo-bootstrap.sql, run as
# a Job by the release's data stage, because the server is private-IP and
# nothing outside the cluster can reach it. SPARX runs it because sparx owns the
# SERVER, and a server-level role is not something a tenant of that server can
# mint for itself.
resource "random_password" "jotdojo_owner" {
  count   = local.jotdojo_count
  length  = 32
  special = true
  # The same exclusions as the server admin beside it. Postgres accepts more
  # than this; these survive a connection string, a psql `-v` substitution and a
  # dotenv line without all three having to agree about escaping.
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# The RESTRICTED role the application actually connects as. jotDOJO's own
# `0001_app_role.sql` creates it without a password and notes that production
# sets one "out of band from Key Vault" — this is that out of band, and it is a
# generated value rather than a chosen one.
resource "random_password" "jotdojo_app" {
  count            = local.jotdojo_count
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# Session-signing key material, so ALPHANUMERIC ONLY — deliberately, and not out
# of timidity about escaping.
#
# release.yml documents at length how OPERATOR_AUTH_SECRET's trailing CARRIAGE
# RETURN broke every operator's 2FA: Better Auth uses the secret's exact bytes as
# key material, a dotenv parser cannot distinguish a trailing CR from a CRLF line
# ending, and trimming it silently reconstructs a DIFFERENT key. 48 alphanumeric
# characters carry ~285 bits and cannot express that bug at all. Entropy was
# never the scarce thing here; unambiguous bytes are.
resource "random_password" "jotdojo_auth_secret" {
  count   = local.jotdojo_count
  length  = 48
  special = false
  upper   = true
  lower   = true
  numeric = true
}

locals {
  jotdojo_server = var.jotdojo_enabled ? azurerm_postgresql_flexible_server.main.fqdn : ""

  # NAMES ARE UPPERCASE-KEBAB, matching jotDOJO's release, which maps a vault
  # name to an env name with `${name//_/-}` — a case-PRESERVING substitution.
  # sparx's own pipeline uses `tr 'a-z-' 'A-Z_'` and therefore lowercase names.
  # Two conventions, each internally consistent, and mixing them produces a
  # secret that reads as present in the portal and is never found at deploy time.
  #
  # `content_type` is not decoration: `az keyvault secret show` prints it, so it
  # is the only thing telling whoever opens this vault which values may safely be
  # regenerated and which would strand something. Said here, next to the secret,
  # rather than in a document nobody has open at the time.
  jotdojo_secrets = var.jotdojo_enabled ? {
    "DATABASE-URL" = {
      # The restricted role. NEVER the owner — Postgres exempts superusers and
      # BYPASSRLS roles from every policy, so an owner connection string turns
      # jotDOJO's whole space boundary off while every policy still reads as
      # though it were being enforced.
      value = "postgresql://jotdojo_app:${urlencode(random_password.jotdojo_app[0].result)}@${local.jotdojo_server}:5432/jotdojo?sslmode=require"
      type  = "connection-string; rotate by tainting random_password.jotdojo_app"
    }
    "DATABASE-ADMIN-URL" = {
      # Migrations only, and `jotdojo_owner` rather than `sparx_owner` — see the
      # note on random_password.jotdojo_owner above.
      value = "postgresql://jotdojo_owner:${urlencode(random_password.jotdojo_owner[0].result)}@${local.jotdojo_server}:5432/jotdojo?sslmode=require"
      type  = "connection-string; migrations only, never the application"
    }
    "JOTDOJO-OWNER-PASSWORD" = {
      # Not on jotDOJO's required list and not read by its release — this one is
      # for SPARX. The data stage passes it to jotdojo-bootstrap.sql as
      # `-v owner_password=`, which is how the role in DATABASE-ADMIN-URL comes
      # to exist at all.
      #
      # It is carried in jotDOJO's vault rather than sparx's so that the password
      # and the connection string containing it cannot drift apart: they are
      # written by the same apply, from the same resource, into the same vault.
      value = random_password.jotdojo_owner[0].result
      type  = "password; read by SPARX's data stage, not by jotDOJO"
    }
    "JOTDOJO-APP-PASSWORD" = {
      # The same password as the one inside DATABASE-URL, carried separately
      # because jotDOJO's migration Job runs `ALTER ROLE jotdojo_app PASSWORD`
      # with it. Two names, one value, on purpose.
      value = random_password.jotdojo_app[0].result
      type  = "password; must match the role embedded in DATABASE-URL"
    }
    "AUTH-SECRET" = {
      value = random_password.jotdojo_auth_secret[0].result
      type  = "key material; ROTATING THIS SIGNS EVERY USER OUT"
    }
    "AZURE-STORAGE-ACCOUNT" = {
      value = azurerm_storage_account.jotdojo[0].name
      type  = "account name; not secret, carried here so one lookup finds all eight"
    }
    "AZURE-STORAGE-KEY" = {
      value = azurerm_storage_account.jotdojo[0].primary_access_key
      type  = "storage key; regenerating it in the portal makes this value stale"
    }
  } : {}
}

resource "azurerm_key_vault_secret" "jotdojo" {
  # Two maps, one resource. The AI half is empty unless jotdojo_ai_enabled,
  # so switching that off REMOVES its secrets rather than stranding entries
  # pointing at a deleted account. See the Azure OpenAI section above.
  for_each = merge(local.jotdojo_secrets, local.jotdojo_ai_secrets)

  name         = each.key
  value        = each.value.value
  key_vault_id = azurerm_key_vault.jotdojo[0].id
  content_type = each.value.type
  tags         = local.tags

  lifecycle {
    # A vault secret is VERSIONED, so rewriting one is additive and safe. A
    # DESTROY is not: it soft-deletes the NAME, and with purge protection
    # deliberately off until launch that is a name held hostage for the whole
    # retention window. The values here are all regenerable; the availability of
    # the name during an incident is not.
    prevent_destroy = true
  }
}
