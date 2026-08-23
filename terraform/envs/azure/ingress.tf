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

  # jotacular.com's five records already existed in Cloudflare before this module
  # described them, so they are ADOPTED rather than created — see
  # imports-jotacular.tf, which holds the import blocks and the reasoning. Left
  # as a plain create, the `www` CNAME fails with 81057 and the four A records
  # quietly double up.
  jotacular_dns_enabled = local.jotacular_dns_enabled
}
