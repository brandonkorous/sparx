# ---------------------------------------------------------------------------
# Naming
#
# Azure Cloud Adoption Framework convention:
#
#     <resource-type-abbreviation>-<workload>-<environment>-<region>
#     e.g.  rg-sparx-prod-eus2 / aks-sparx-prod-eus2 / psql-sparx-prod-eus2
#
# The REGION SEGMENT IS THE POINT. Resource group names are unique per
# subscription and Postgres server names are unique GLOBALLY, so a name like
# `sparx-rg` or `sparx-pg` cannot be deployed twice — the day a second region is
# added, every name in this file would collide and have to be renamed, which in
# Azure means destroy-and-recreate, not rename. Encoding region + environment now
# costs nothing and makes `terraform apply -var location=westus2` a working
# second deployment rather than a rewrite.
#
# Adding a region should require changing exactly one variable. Nothing below
# hardcodes a region.
# ---------------------------------------------------------------------------
locals {
  # Short region codes. Azure has no canonical abbreviation list, so this is the
  # widely-used CAF-style one. Add entries as regions are adopted — an unlisted
  # region fails loudly at plan time rather than silently producing a name with
  # the full region string in it.
  location_short = {
    eastus         = "eus"
    eastus2        = "eus2"
    centralus      = "cus"
    southcentralus = "scus"
    northcentralus = "ncus"
    westus         = "wus"
    westus2        = "wus2"
    westus3        = "wus3"
    canadacentral  = "cac"
    northeurope    = "neu"
    westeurope     = "weu"
    uksouth        = "uks"
  }

  loc = local.location_short[var.location]

  # The suffix every top-level resource name ends with.
  suffix = "${var.workload}-${var.environment}-${local.loc}"

  tags = {
    platform    = "sparx"
    workload    = var.workload
    environment = var.environment
    region      = var.location
    managed     = "terraform"
  }
}

# ---------------------------------------------------------------------------
# Resource group — everything lives in one, deliberately.
#
# At this scale separate groups per tier buy nothing but extra plumbing. The
# provider is configured to refuse deleting a non-empty group, which is the
# guardrail that makes a single group safe.
# ---------------------------------------------------------------------------
resource "azurerm_resource_group" "main" {
  name     = "rg-${local.suffix}"
  location = var.location
  tags     = local.tags
}

# ---------------------------------------------------------------------------
# Network
#
# Postgres is VNet-integrated (private endpoint), NOT a public endpoint with
# firewall rules. This mirrors the Cloud SQL setup it replaces — private-IP only
# — and costs nothing extra. The consequence is the same one the GCP environment
# already lives with and documents in wizeworks/packages/db/CLAUDE.md: you cannot reach the
# database from a laptop. Migrations run as an in-cluster Job, which is exactly
# how the local overlay already does it (scripts/local-up.ps1 -Migrate).
#
# Address space is small on purpose but leaves room to add a second node pool.
# ---------------------------------------------------------------------------
resource "azurerm_virtual_network" "main" {
  name                = "vnet-${local.suffix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  address_space       = ["10.20.0.0/16"]
  tags                = local.tags
}

resource "azurerm_subnet" "aks" {
  name                 = "snet-aks"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.20.0.0/20"]
}

# Flexible Server requires a subnet DELEGATED to it, which cannot host anything
# else — hence a dedicated /28 rather than sharing the AKS subnet.
resource "azurerm_subnet" "postgres" {
  name                 = "snet-psql"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.20.16.0/28"]

  # Azure ADDS this itself when a Flexible Server is placed in the subnet — the
  # server needs it to reach backup storage. Declaring it here is not decoration:
  # without it Terraform sees an undeclared endpoint, plans to REMOVE it, and the
  # next apply quietly degrades database backups. Caught by a post-migration plan
  # showing "1 to change" that should have been zero.
  service_endpoints = ["Microsoft.Storage"]

  delegation {
    name = "fs"
    service_delegation {
      name = "Microsoft.DBforPostgreSQL/flexibleServers"
      actions = [
        "Microsoft.Network/virtualNetworks/subnets/join/action",
      ]
    }
  }
}

# Private DNS so `<server>.postgres.database.azure.com` resolves to the private
# IP from inside the VNet. Without this the pods resolve a public address they
# cannot reach and every connection times out.
resource "azurerm_private_dns_zone" "postgres" {
  name                = "${local.suffix}.private.postgres.database.azure.com"
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "postgres" {
  name                  = "pdnsl-${local.suffix}"
  resource_group_name   = azurerm_resource_group.main.name
  private_dns_zone_name = azurerm_private_dns_zone.postgres.name
  virtual_network_id    = azurerm_virtual_network.main.id
  registration_enabled  = false
  tags                  = local.tags
}

# ---------------------------------------------------------------------------
# AKS
#
# sku_tier = "Free": no control-plane charge and no uptime SLA. Azure does not
# bill the ~$74/mo that GKE Autopilot charges for the equivalent, which is a
# large part of why this environment is affordable at all. Move to "Standard"
# when an SLA actually matters — i.e. when there are paying users.
#
# ONE node, and no autoscaler. Autoscaling on a single-node budget cluster only
# creates a way to accidentally double the bill; scaling here is a deliberate
# `node_count` or `node_size` change.
#
# AND WHEN IT IS TIME TO SCALE, IT IS `node_size` — NOT `node_count`. The two
# cost the same to the cent (D-series pricing is linear), but a second node pays
# AKS's regressive memory reservation a second time, pays a second DaemonSet
# tax, splits free memory into two pools that cannot host one large pod, and
# doubles image pulls — while buying zero availability, because every Deployment
# here is `replicas: 1` and sku_tier is "Free". The full four-point comparison is
# in the `node_size` variable description. Grew 8 GiB → 16 GiB on 2026-08-21 for
# exactly this reason.
#
# COST NOTE — the one number I am not confident about: AKS provisions a Standard
# Load Balancer for outbound (SNAT) connectivity even when no Service is of type
# LoadBalancer. The cluster genuinely needs egress — to pull images from GHCR, to
# reach Postgres, and for cloudflared to dial out — so it cannot simply be
# removed. Expect somewhere between the public IP alone (~$4/mo) and a full
# Standard LB (~$18-20/mo). Verify against the first week's actual bill.
# managedNATGateway was considered and rejected: it is ~$32/mo, strictly worse.
#
# This is a correction to my earlier "$0 ingress" framing. Using cloudflared
# genuinely avoids an INGRESS load balancer, but it does not avoid the EGRESS
# one, and I under-counted that.
# ---------------------------------------------------------------------------
resource "azurerm_kubernetes_cluster" "main" {
  name                = "aks-${local.suffix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  dns_prefix          = "aks-${local.suffix}"
  sku_tier            = "Free"
  tags                = local.tags

  # AKS creates a second, Azure-managed resource group for the node VMs, disks
  # and load balancer. Left alone it is named `MC_<rg>_<cluster>_<region>`, which
  # is both ugly and inconsistent with everything else. Naming it explicitly
  # keeps the portal readable and keeps the convention intact — and it matters
  # more in multi-region, where two default names differ only by a buried
  # substring.
  node_resource_group = "rg-${local.suffix}-nodes"

  # automatic_upgrade_channel is deliberately OMITTED, which is how the provider
  # expresses "no automatic upgrades" — there is no "none" value, and setting one
  # is a validation error. A single-node cluster has nowhere to drain to, so an
  # unattended control-plane upgrade is not something it should discover on its
  # own; upgrades here are a deliberate act.

  default_node_pool {
    name       = "system"
    vm_size    = var.node_size
    node_count = 1

    # Ephemeral OS disk: the OS lives on the VM's own local NVMe instead of a
    # billed managed disk. Free, and much faster for container image pulls, which
    # is what a 20-image cold start is bottlenecked on. A node reimage wipes it,
    # which is fine — nothing stateful lives on the node.
    #
    # SIZED TO THE SKU'S WHOLE LOCAL DISK, ON PURPOSE. D4ads_v7 exposes 220 GiB
    # (`az vm list-skus --size Standard_D4ads_v7` → NvmeDiskSizeInMiB=225280),
    # and because ephemeral placement consumes that disk rather than a billed
    # one, 220 costs exactly what 30 did: nothing. Asking for less does not save
    # money, it only leaves the rest unusable.
    #
    # THIS NUMBER IS A FUNCTION OF vm_size — it was 110 under D2ads_v7, whose
    # local disk was half this. Change one and re-read the other: asking for more
    # than the SKU exposes fails the node pool outright, and asking for less
    # silently strands the remainder.
    #
    # 30 GiB is what this was, and it is why the first deploy failed. The three
    # API images are ~820 MB each — they ship the whole pnpm workspace because
    # api-rest boots through runtime tsx — and the 11 workers are built the same
    # way. Twenty of those plus the system images overran the disk, the kubelet
    # raised DiskPressure, and it tainted the only node
    # `node.kubernetes.io/disk-pressure:NoSchedule`. Every pod not already
    # placed then stopped scheduling with a message about a taint, which reads
    # like an affinity bug and is really a full disk. Leave the headroom.
    os_disk_type    = "Ephemeral"
    os_disk_size_gb = 220

    # Changing os_disk_size_gb (or vm_size) on the DEFAULT pool is ForceNew. Left
    # to itself the provider would destroy and recreate the whole CLUSTER; with a
    # rotation name it cycles the node pool in place instead, so the cluster
    # identity, its kubeconfig and the CSI-provisioned media disk all survive.
    temporary_name_for_rotation = "systemtmp"

    vnet_subnet_id = azurerm_subnet.aks.id

    # Steady state is ~37 (22 Deployment pods incl. 2 cloudflared, Typesense,
    # and ~14 kube-system). 50 looked like headroom and was not: a deploy SURGES.
    # Eight app Deployments start a replacement before retiring the old pod, and
    # while images are still pulling BOTH generations exist — which is how this
    # cluster reached 51/50 and stayed there. Everything unscheduled then blocked,
    # including the migration Job, which sat Pending for its entire 15-minute
    # timeout and reported only "timed out waiting for the condition".
    #
    # Raising it costs NOTHING here. The note that used to sit on this line —
    # about not inflating the subnet's IP reservation — is true for regular Azure
    # CNI and false for the overlay mode configured below: pod IPs come from
    # `pod_cidr` (10.244.0.0/16), not from snet-aks, so max_pods does not consume
    # a single VNet address. The real ceiling is the node's own CPU and memory,
    # and requests are what enforce that.
    #
    # 110 leaves room for the surge, for CronJob pods, and for one-off Jobs.
    max_pods = 110

    upgrade_settings {
      # A single-node pool has nowhere to drain to, so a surge node is required
      # for an upgrade to complete at all.
      max_surge = "1"
    }
  }

  identity {
    type = "SystemAssigned"
  }

  network_profile {
    # Azure CNI Overlay: pod IPs come from an overlay space rather than the VNet,
    # so the /20 above is consumed by NODES, not pods. On kubenet this cluster
    # would work too, but overlay is the current default recommendation and
    # leaves room to grow without re-addressing.
    network_plugin      = "azure"
    network_plugin_mode = "overlay"
    pod_cidr            = "10.244.0.0/16"
    service_cidr        = "10.0.0.0/16"
    dns_service_ip      = "10.0.0.10"
    load_balancer_sku   = "standard"
    outbound_type       = "loadBalancer"
  }

  # Cheap wins, both off by default:
  #   - local accounts stay ON (no Entra integration to configure yet)
  #   - no Azure Monitor / Container Insights: it is billed per GB ingested and
  #     would be a meaningful fraction of this budget. `kubectl logs` is enough
  #     until it isn't.
}

# ---------------------------------------------------------------------------
# Postgres 18 — replaces Cloud SQL Postgres 18, same major version.
# ---------------------------------------------------------------------------
resource "random_password" "postgres_admin" {
  length  = 32
  special = true
  # Azure rejects these in the admin password.
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "azurerm_postgresql_flexible_server" "main" {
  name                = "psql-${local.suffix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  version    = var.postgres_version
  sku_name   = var.postgres_sku
  storage_mb = var.postgres_storage_mb

  administrator_login    = "sparx_owner"
  administrator_password = random_password.postgres_admin.result

  delegated_subnet_id           = azurerm_subnet.postgres.id
  private_dns_zone_id           = azurerm_private_dns_zone.postgres.id
  public_network_access_enabled = false

  # 7 days is the free minimum. The reason to pay for managed Postgres at all is
  # point-in-time restore; going below the floor would defeat the purpose.
  backup_retention_days        = 7
  geo_redundant_backup_enabled = false

  # No high availability. It doubles the compute cost, and this environment has
  # an explicitly non-SLA control plane in front of it — buying HA for the
  # database while the cluster has none would be incoherent.
  zone = "1"

  tags = local.tags

  depends_on = [azurerm_private_dns_zone_virtual_network_link.postgres]

  lifecycle {
    # Losing this is losing the platform's data. Removing the flag is a
    # deliberate two-step, exactly like the Cloud SQL instance it replaces.
    prevent_destroy = true
  }
}

resource "azurerm_postgresql_flexible_server_database" "sparx" {
  name      = "sparx"
  server_id = azurerm_postgresql_flexible_server.main.id
  collation = "en_US.utf8"
  charset   = "utf8"

  lifecycle {
    prevent_destroy = true
  }
}

# Extensions must be ALLOW-LISTED before anything can create them. This is the
# sharpest difference from Cloud SQL, where `CREATE EXTENSION` just worked and
# the migrations were written against that.
#
# `azure.extensions` defaults to EMPTY on Flexible Server. Until a name appears
# here, `CREATE EXTENSION pgcrypto` fails with "extension is not allow-listed",
# and because it is the migration runner that fails, the symptom is a deploy
# that has already created the roles and rolled out pods — not an obvious
# infrastructure error.
#
# The names are the ones the schemas actually ask for; grep the migrations
# before adding more:
#     grep -rhoiE 'CREATE EXTENSION [^;]+' wizeworks/packages/db/prisma/migrations/
#
#   pgcrypto    — gen_random_uuid() and the digest/hmac helpers.
#   btree_gist  — required by the EXCLUDE constraints that stop overlapping
#                 bookings and price-list date ranges. A plain btree index
#                 cannot back an EXCLUDE, so this is not optional.
#
# THE LAST THREE BELONG TO jotDOJO, NOT sparx, and they sit here because
# `azure.extensions` is a SERVER-level parameter — Flexible Server has no
# per-database allow-list. jotdojo.tf adds a second DATABASE to this same
# server; its first migration opens with `CREATE EXTENSION vector / pg_trgm /
# citext` (packages/db/migrations/0000_init.sql in the jotDOJO repo), and
# without these names that migration fails in exactly the way the paragraph
# above describes: after the roles exist and the pods have already rolled.
#
#   vector      — pgvector. jotDOJO embeds note blocks for semantic search.
#   pg_trgm     — trigram fuzzy search (its 0010_fuzzy_search migration).
#   citext      — case-insensitive text for email identity columns.
#
# Adding a name is additive and free: an allow-listed extension no database ever
# creates is inert, so sparx gains nothing and loses nothing. The isolation
# between the two products is the DATABASE and the role — never this list.
#
# Dynamic (`isDynamicConfig: true`), so applying it does NOT restart the server.
resource "azurerm_postgresql_flexible_server_configuration" "extensions" {
  name      = "azure.extensions"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "PGCRYPTO,BTREE_GIST,VECTOR,PG_TRGM,CITEXT"
}

# ---------------------------------------------------------------------------
# Media storage
#
# The durable home for tenant media: originals, and the transcoded variants
# media-worker derives from them.
#
# WHY THIS EXISTS. Media used to live in GCS. When GCP was retired
# `GCS_MEDIA_BUCKET` went with it, and every `getStorage()` in the codebase —
# api-rest, media-worker, wizeworks/packages/media — fell through to its LAST branch,
# LocalStorage, the backend written for a developer's laptop. Production media
# was therefore served off a single ReadWriteOnce Azure Disk, which is why
# api-rest and media-worker are pinned to the same node by pod affinity: a RWO
# volume mounts on exactly one. It worked, and it is a dead end — one node, no
# object durability, and a PVC that has to be restored by hand.
#
# Two containers, mirroring the GCS split the object keys already encode
# (`<tenant>/originals/...` vs `<tenant>/variants/...`):
#
#   media         private — originals + tenant-sensitive objects. Read back via
#                 short-lived SAS, never a public URL.
#   media-public  derived variants. ALSO PRIVATE: api-rest serves these over
#                 /v1/public/media/variants/* exactly as it did under GCS (where
#                 an org policy forbade allUsers), so every existing URL —
#                 media.sparx.works, the MEDIA_DIRECT_BASE_URL host the social
#                 adapters fetch from, Cloudflare in front of both — keeps
#                 working with no DNS or CDN change. The name records intent;
#                 anonymous access is deliberately NOT granted.
#
# LRS, not GRS: these are derived assets with a re-transcodable source, and
# geo-redundancy would roughly double the price for a recovery story we do not
# need. Hot tier — variants are read on every page view.
# ---------------------------------------------------------------------------
resource "azurerm_storage_account" "media" {
  # Storage account names are globally unique, 3–24 chars, lowercase alphanumeric
  # ONLY — no hyphens, which is why this cannot reuse `local.suffix` directly.
  name                     = replace("st${local.suffix}", "-", "")
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  account_kind             = "StorageV2"
  access_tier              = "Hot"

  # The app authenticates with the account key (it signs the SAS URLs the browser
  # PUTs to), so shared-key auth stays on. Everything else is closed down.
  shared_access_key_enabled       = true
  allow_nested_items_to_be_public = false
  https_traffic_only_enabled      = true
  min_tls_version                 = "TLS1_2"

  blob_properties {
    # A deleted blob is recoverable for a week. Cheap insurance against a bad
    # `deletePrefix` — which the code guards against, but guards are not backups.
    delete_retention_policy {
      days = 7
    }

    # The browser PUTs its upload straight here, so the ACCOUNT has to allow the
    # console's origin — api-rest only signs the URL, it never sees the bytes, and
    # nothing server-side can grant this on the browser's behalf.
    #
    # Its absence is why every upload failed on the Blob cutover with a preflight
    # error and no server-side trace: the GCS buckets carried an equivalent `cors`
    # block (terraform/modules/storage/main.tf) and it did not come across with the
    # rest of the storage layer.
    #
    # PUT + OPTIONS only. Browsers never GET from this account — variants are
    # streamed by api-rest — so read methods would widen the surface for nothing.
    # `x-ms-blob-type` is in the header list because Azure REQUIRES it on a direct
    # PUT (400 InvalidHeaderValue without it), which makes it non-safelisted and
    # therefore part of the preflight.
    cors_rule {
      allowed_origins = var.media_upload_origins
      allowed_methods = ["PUT", "OPTIONS"]
      allowed_headers = ["content-type", "x-ms-blob-type"]
      # The upload reads nothing off the response, so this would ideally be empty —
      # Azure itself accepts that. The PROVIDER requires at least one entry (and
      # `terraform validate` does not catch it; only `plan` does), so it names the one
      # header worth having: `x-ms-request-id` is what correlates a failed upload in
      # the browser with the request on Azure's side. `*` would satisfy the schema too
      # and expose every response header to script for no reason.
      exposed_headers    = ["x-ms-request-id"]
      max_age_in_seconds = 3600
    }
  }

  tags = local.tags
}

resource "azurerm_storage_container" "media" {
  name                  = "media"
  storage_account_id    = azurerm_storage_account.media.id
  container_access_type = "private"
}

resource "azurerm_storage_container" "media_public" {
  name               = "media-public"
  storage_account_id = azurerm_storage_account.media.id
  # Private on purpose — see the note above. api-rest streams these bytes.
  container_access_type = "private"
}
