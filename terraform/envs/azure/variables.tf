variable "subscription_id" {
  description = "Azure subscription id. From `az account show --query id -o tsv`."
  type        = string
}

variable "location" {
  description = <<-EOT
    Azure region. Everything public is fronted by Cloudflare, so origin latency
    barely affects users and the choice is driven by availability, not geography.

    Postgres is VNet-integrated and VNets are regional, so the database and the
    cluster MUST live in the same region. This variable moves both — which is why
    the region has to satisfy TWO independent constraints at once.

    HOW TO CHECK A REGION BEFORE APPLYING (this cost several failed applies to
    work out; do not skip it):

    1. Postgres. `az postgres flexible-server list-skus -l <region>` exposes a
       feature flag `OfferRestricted`. Enabled => every create fails with
       `LocationIsOfferRestricted`, regardless of tier or size. It predicted
       every failure we hit, exactly:
           eastus2  Enabled   BLOCKED
           eastus   Enabled   BLOCKED
           westus2  Enabled   BLOCKED
           centralus Disabled  ok
           westus    Disabled  ok
           westus3   Disabled  ok
       A restricted region returns an EMPTY supportedServerEditions list, so a
       response under ~2KB is itself the tell.

       NOTE: the portal Quotas blade flags `standardBSFamily` (Burstable) as
       "deprecated" with a red triangle. That is a legacy quota-family naming
       artifact, NOT a service retirement — the capabilities API lists Burstable
       and Standard_B1ms as supported in every unrestricted region.

    2. VM SKU. `az vm list-skus -l <region>` — see node_size. The allow-list is
       per-region AND per-subscription.

    Do NOT trust the retail pricing API for availability. It returns a price for
    Standard_D2ads_v7 in westus3, where the SKU is not offered to this
    subscription at all (westus3 carries no AMD sizes whatsoever).

    centralus is the cheapest region satisfying both: D2ads_v7 at $83.22/mo (tied
    with eastus, the lowest observed) and Postgres unrestricted. westus costs
    $97.82 for the same node; westus3's cheapest workable node is $96.36 and
    loses the free ephemeral OS disk.
  EOT
  type        = string
  default     = "centralus"
}

variable "workload" {
  description = <<-EOT
    Workload segment of every resource name. Keep it short — Azure storage
    accounts (if ever added here) cap at 24 lowercase alphanumeric characters,
    and that is the tightest constraint in the platform.
  EOT
  type        = string
  default     = "sparx"
}

variable "environment" {
  description = <<-EOT
    Environment segment of every resource name. Part of the name, not just a tag,
    so `prod` and `staging` can coexist in one subscription without collision.
  EOT
  type        = string
  default     = "prod"

  validation {
    condition     = can(regex("^[a-z0-9]{2,10}$", var.environment))
    error_message = "environment must be 2-10 lowercase alphanumeric characters."
  }
}

variable "node_size" {
  description = <<-EOT
    AKS node VM size: 2 vCPU / 8 GiB, ~$70-75/mo.

    Chosen for ONE property above all: it is NOT burstable. A B-series node
    throttles to baseline once burst credits are exhausted, and the moment that
    happens is a mass cold start — 20 containers booting at once after a rollout.
    api-rest is known to lose that fight: it crashlooped for ~30h on GKE (~400
    restarts, exit 137) purely because it was CPU-starved during boot and could
    not finish loading its ~50-package workspace through runtime tsx before the
    probe killed it. The 300s startupProbe in k8s/apps/api-rest.yaml is scar
    tissue from that incident. ~$14/mo over a B2ms to remove that failure mode is
    cheap.

    The `ads` suffix matters: `a` = AMD, `d` = LOCAL TEMP DISK, `s` = premium
    storage. The local disk is what allows an EPHEMERAL OS disk (see the node
    pool), which is both free and much faster for image pulls. A no-`d` size like
    Standard_D2as_v6 would force a billed managed OS disk.

    GETTING HERE TOOK TWO REJECTIONS, both subscription restrictions rather than
    config errors:
      - Standard_D2ads_v5: `NotAvailableForSubscription` in eastus2/eastus/centralus.
      - Standard_D2_v3:    rejected in eastus2. AKS's allow-list there was
                           ENTIRELY v6/v7 generation — no v3/v4/v5 at all.
      - Standard_D2ads_v6: rejected in eastus. The allow-list is PER-REGION as
                           well as per-subscription: eastus2 offers v6 and v7,
                           eastus offers v7 only.

    So the allowed set is a function of BOTH subscription and region. If the
    region changes, re-read the allow-list in the AKS error — do not assume a
    size that worked elsewhere is available.

    Do NOT "simplify" this to an older, cheaper-looking size; it will be rejected.
    Also avoid the `l` variants (D2als/D2lds) — those are low-memory, 4 GiB not 8 —
    and the `p` variants (D2ps/D2pds), which are ARM64 and would need multi-arch
    images.

    Upgrade path when real users arrive: Standard_D4ads_v7 (4 vCPU / 16 GiB).
  EOT
  type        = string
  default     = "Standard_D2ads_v7"
}

variable "postgres_sku" {
  description = <<-EOT
    Burstable B1ms (1 vCore / 2 GiB, ~$12/mo). Burstable is fine HERE, unlike the
    node: a database's load is short query bursts against a warm cache, not a
    sustained multi-minute cold start, so credit exhaustion is not the same cliff.

    Watch it if the seed grows large. Scaling up is an in-place change.
  EOT
  type        = string
  default     = "B_Standard_B1ms"
}

variable "postgres_storage_mb" {
  description = "Postgres storage. 32 GiB is the smallest tier and matches the free-offer allotment."
  type        = number
  default     = 32768
}

variable "postgres_version" {
  description = <<-EOT
    Matches Cloud SQL exactly. Azure Flexible Server offers 18 in eastus2
    (verified), so this is a straight lift-and-shift — no version-compatibility
    risk against the 164 existing migrations.
  EOT
  type        = string
  default     = "18"
}

variable "admin_ip_cidr" {
  description = <<-EOT
    Your public IP, as a /32, allowed to reach Postgres directly for restores and
    psql. Leave empty to allow no public access at all (the AKS pods reach it via
    the Azure-services firewall rule regardless).

    Example: "203.0.113.7/32"
  EOT
  type        = string
  default     = ""
}
