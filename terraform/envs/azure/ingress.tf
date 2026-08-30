# The ingress address, and the DNS that points at it.
#
# WHY A RESERVED IP AND NOT THE ONE AKS HANDS OUT. A `Service type=LoadBalancer`
# with no address specified gets an ephemeral public IP, and that IP changes
# whenever the Service is deleted and recreated — which a namespace rebuild, a
# kustomize rename, or a bad `kubectl delete` all do. DNS then points at an
# address Azure has already handed to someone else, and nothing in the cluster
# reports a problem because the cluster is fine. Reserving it makes the address
# a fact about the platform rather than a side effect of the last apply.
#
# It lives in the AKS NODE resource group on purpose. The cluster's managed
# identity already owns everything in there, so it can attach this IP with no
# extra role assignment; putting it in the workload group instead would need a
# Network Contributor grant, which is more privilege and one more thing to get
# wrong. The group is created by AKS, hence the depends_on.

resource "azurerm_public_ip" "ingress" {
  name = "pip-ingress-${local.suffix}"
  # NOT azurerm_resource_group.main. See above — this is the AKS-managed group.
  resource_group_name = azurerm_kubernetes_cluster.main.node_resource_group
  location            = azurerm_resource_group.main.location

  # Standard + Static are both required, not preferences: an AKS Standard Load
  # Balancer will not attach a Basic-SKU IP, and a Dynamic address defeats the
  # entire point of reserving one.
  allocation_method = "Static"
  sku               = "Standard"

  # ~$3.65/mo. The reason this is worth paying rather than tracking an ephemeral
  # address by hand is that the failure it prevents is silent: DNS keeps
  # resolving, the pods keep passing health checks, and the platform is simply
  # unreachable.
  tags = {
    purpose = "caddy ingress — every public hostname resolves here"
  }

  depends_on = [azurerm_kubernetes_cluster.main]
}

# Public DNS. The records live in ../../modules/dns and are shared VERBATIM with
# the GCP env — the only difference between the two deployments is the one line
# below saying where traffic lands.
#
# Before this, DNS existed only in envs/prod and every A record read
# `google_compute_address.ingress.address` directly, so the Azure deployment had
# no managed DNS at all: its records were created by hand against the Cloudflare
# Tunnel and drifted from Terraform the moment they were.
module "dns" {
  source = "../../modules/dns"

  ingress_ip         = azurerm_public_ip.ingress.ip_address
  cloudflare_enabled = var.cloudflare_enabled

  operator_access_emails    = var.operator_access_emails
  sparx_email_dkim_selector = var.sparx_email_dkim_selector
  sparx_email_dkim_value    = var.sparx_email_dkim_value

  # jotacular_dns_enabled is left at its default (on). Its five records already
  # existed in Cloudflare when this module first described them and were ADOPTED
  # into state by import blocks in the v1.227.1 release rather than created; the
  # import file was one-shot and has been removed now that it has applied.

  # THE kanNINJA CUTOVER SWITCH — flipped 2026-08-26.
  #
  # Until now this was left at its default of OFF, alone among the brands here,
  # because kanNINJA was LIVE on GKE and its four records pointed at a Google
  # address. The module writes them with `allow_overwrite`, so turning this on
  # does not begin managing them — it REPOINTS them. Enabling it IS the cutover,
  # which is why it waited for a window rather than riding along with whichever
  # apply happened to come next.
  #
  # Preconditions, all verified rather than assumed, before this line changed:
  #   - backend / frontend / mcp each 1/1 on aks-sparx-prod-cus
  #   - the backend's readiness probe answering 200 from a real `select 1` as
  #     kanninja_app against Azure Postgres
  #   - 2,963 rows migrated from Supabase and reconciled, 49 foreign keys
  #     re-applied, every profile linked to a Better Auth user
  #   - Caddy already serving the four host blocks, with all four names
  #     allow-listed in api-rest's PLATFORM_HOSTNAMES for on-demand TLS
  #
  # See docs/azure-migration-plan.md Phase 5 in the kanNINJA repository.
  kanninja_dns_enabled = true

  # ON as of 2026-08-27. The gate this was waiting on has cleared: AGCONN's nine
  # Deployments are Running 1/1 with zero restarts, its migration Job Succeeded
  # against Supabase, api answers /health 200 and web answers GET /en 200 — all
  # verified in-cluster before this flipped.
  #
  # IF THIS FAILS AT PLAN TIME with a zone-not-found on agconn.com, the cause is
  # not this line. The `data "cloudflare_zone"` lookup runs as sparx's
  # cloudflare_api_token, and agconn.com was previously managed from the
  # AgConnect repo's own Terraform under a different token. Scope sparx's token
  # to that zone, or revert this to false and keep agconn.com's records in
  # AgConnect's state — what must not happen is two states writing them.
  agconn_dns_enabled = true

  # OFF until the site is verified in-cluster. Turning this on REPOINTS the
  # wize.works apex (the records carry `allow_overwrite`), so it is a cutover,
  # not an adoption — same as kanNINJA's and AGCONN's switches above.
  #
  # The `admin` record in this zone is NOT gated by this and is unaffected; it
  # has been serving the operator console for months.
  #
  # Preconditions in variables.tf. The one that fails confusingly is the TLS
  # allow-list: without `wize.works` in api-rest's PLATFORM_HOSTNAMES, on-demand
  # issuance is denied at the ask endpoint and the site presents a CERTIFICATE
  # error rather than a 404 — which reads like DNS and is not.
  wizeworks_dns_enabled = false

  # OFF until RocketEase is verified in-cluster. rocketease.com is already in
  # Cloudflare, so turning this on REPOINTS the zone rather than adopting it —
  # a cutover, like kanNINJA's and AGCONN's switches above, not a no-op.
  #
  # Preconditions, in the module variable's own description. The short form: web,
  # platform and worker Running in the `rocketease` namespace, and the platform
  # answering /api/health 200 — which it does NOT do until the worker has booted
  # and pg-boss has created its schema, so a started pod is not the signal.
  #
  # The failure that reads like DNS and is not: without all three names in
  # api-rest's PLATFORM_HOSTNAMES, on-demand issuance is denied at the ask
  # endpoint and the site presents a CERTIFICATE error rather than a 404.
  rocketease_dns_enabled = true
}
