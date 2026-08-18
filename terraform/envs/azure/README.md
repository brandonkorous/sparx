# Azure environment

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-07-31

The cost-constrained deployment that replaces GKE + Cloud SQL. Budget is $1000 of
credit targeted to last ~10 months, and every sizing decision here is made
against that number — the reasoning sits next to each resource in
[main.tf](main.tf) rather than in a separate doc.

This Terraform creates **infrastructure only**: resource group, VNet, AKS, and
Postgres. Workloads come from a kustomize overlay on top (see _Next_ below).

## Cost

| Component                     | Choice                                   | ~$/mo         |
| ----------------------------- | ---------------------------------------- | ------------- |
| AKS control plane             | `Free` tier — no SLA                     | $0            |
| Node                          | 1 × `Standard_D2_v3`, ephemeral OS disk  | $70           |
| Postgres                      | Flexible Server B1ms + 32 GiB, PG 18     | $16           |
| Egress load balancer          | AKS-provisioned, unavoidable — see below | $4–20         |
| PVCs                          | Typesense + media                        | ~$6           |
| Registry / Redis / ingress LB | GHCR / dropped / cloudflared             | $0            |
| **Total**                     |                                          | **≈ $96–112** |

Two things that could move it:

- **The egress load balancer is the one number I am not confident about.** AKS
  provisions a Standard LB for outbound SNAT even with no `LoadBalancer` Service.
  The cluster genuinely needs egress — GHCR pulls, Postgres, and cloudflared
  dialling out — so it cannot be removed. It is somewhere between the public IP
  alone (~$4) and a full Standard LB (~$18–20). **Check the first week's actual
  bill.** `managedNATGateway` was considered and rejected at ~$32/mo.
- **New Azure accounts get 12 months free** of Flexible Server B1ms + 32 GiB. If
  this subscription is inside its first year, Postgres is $0.

## Why these SKUs

**`Standard_D2_v3` because it is not burstable.** A B-series node throttles to
baseline once burst credits are exhausted, and the moment that bites is a mass
cold start — 20 containers booting after a rollout. api-rest is known to lose
that fight: it crashlooped for ~30h on GKE (~400 restarts, exit 137) purely from
CPU starvation during boot, which is what the 300s `startupProbe` in
[k8s/apps/api-rest.yaml](../../../k8s/apps/api-rest.yaml) exists to survive.
`Standard_D2ads_v5` was the first choice but returns
`NotAvailableForSubscription` in eastus2/eastus/centralus here.

**`Free` AKS tier** saves the ~$74/mo that the GKE Autopilot equivalent charged.
That single difference is most of why this environment is affordable.

**Postgres is VNet-private**, mirroring the private-IP Cloud SQL it replaces. So
you cannot reach it from a laptop — migrations run as an in-cluster Job, exactly
as [wizeworks/packages/db/CLAUDE.md](../../../packages/db/CLAUDE.md) already describes.

## Apply

```bash
cd terraform/envs/azure
terraform init
terraform apply -var="subscription_id=$(az account show --query id -o tsv)"
```

Takes ~10 minutes, most of it AKS. Then:

```bash
az aks get-credentials --resource-group rg-sparx-prod-eus2 --name aks-sparx-prod-eus2
```

## Required manual step: create the `sparx_app` role

**The apps cannot connect until this is done.** Terraform creates the
`sparx_owner` admin login, but `sparx_app` — the unprivileged, `NOBYPASSRLS` role
every application connection uses — comes from
[wizeworks/packages/db/docker/init/01-roles.sql](../../../packages/db/docker/init/01-roles.sql).
That file is a **Docker image entrypoint convention**, not a Postgres feature, so
a managed server will never run it.

It also cannot be run from a laptop, because the server is VNet-private. Run it
from inside the cluster:

```bash
kubectl run psql --rm -it --restart=Never --image=postgres:18-alpine -- \
  psql "postgresql://sparx_owner:<password>@<fqdn>:5432/sparx?sslmode=require"
```

Paste the contents of `01-roles.sql`, adjusting the passwords — the file's
hardcoded `devpassword` is correct for a Docker-network-isolated dev database and
wrong for anything else. Whatever you choose must match `DATABASE_URL` in the k8s
Secret.

Get the values from Terraform:

```bash
terraform output -raw postgres_admin_password
terraform output -raw postgres_fqdn
```

## Next

1. `k8s/azure/` — a kustomize overlay, a small delta on
   [k8s/local/](../../../k8s/local/): drop the in-cluster Postgres and Redis,
   point images at GHCR, pin the `managed-csi` (StandardSSD) storage class.
   `D2_v3` does not support Premium SSD, so `managed-csi-premium` will fail.
2. Publish images to GHCR and add the pull secret.
3. Repoint the Cloudflare Tunnel at this cluster.

## State

Local backend, deliberately — the GCP environment's state lives in
`gs://sparx-terraform-state`, unreachable while that project's billing is off, so
there was no shared backend to reuse. An Azure Storage backend is the right
destination once this is proven.

**`terraform.tfstate` contains the Postgres admin password in plaintext.** It is
gitignored; back it up somewhere real before relying on it.
