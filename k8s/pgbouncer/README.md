# PgBouncer

Transaction-mode connection pooler in front of Cloud SQL Postgres. Required for RLS `SET LOCAL` to work correctly per [docs/03-infrastructure-deployment.md](../../docs/03-infrastructure-deployment.md) §8.

App pods connect to `pgbouncer.sparx-prod.svc.cluster.local:5432` — same wire protocol as Postgres itself.

## Cloud Run reachability (internal LB)

In-cluster pods use the ClusterIP `Service` ([service.yaml](service.yaml)) above. The **Cloud Run worker fleet** (commerce-indexer, automation-worker, channel-sync-worker, …) reaches the cluster only over the Serverless VPC connector, where kube-DNS names and ClusterIPs are **not routable**. So those workers connect through [service-internal.yaml](service-internal.yaml) — an internal LoadBalancer pinned to the reserved private IP `10.0.0.55` (`google_compute_address.pgbouncer_internal` in [terraform/envs/prod/main.tf](../../terraform/envs/prod/main.tf)). This mirrors the Typesense internal-LB setup.

The workers' `DATABASE_URL` comes from the **`database-url-cloudrun`** Secret Manager secret — identical to `database-url` except the host is `10.0.0.55` instead of the kube-DNS name. Add/refresh it out-of-band (host-swapped from the in-cluster secret so the password is never printed):

```bash
gcloud secrets versions access latest --secret=database-url \
  | sed 's#@pgbouncer.sparx-prod.svc.cluster.local:5432#@10.0.0.55:5432#' \
  | gcloud secrets versions add database-url-cloudrun --data-file=-
```

> When rotating the `sparx_app` password (below), re-run this so `database-url-cloudrun` tracks the new value too.

The `edoburu/pgbouncer` image generates `pgbouncer.ini` from env vars at startup, so there's no ConfigMap — just a Secret with the host + password.

## Bootstrap secret

After `terraform apply`, sync the Cloud SQL private IP + `sparx_app` password into a k8s Secret:

```powershell
$pgHost = terraform -chdir=../../terraform/envs/prod output -raw cloud_sql_private_ip
$pgPass = terraform -chdir=../../terraform/envs/prod output -raw cloud_sql_app_password

kubectl create secret generic pgbouncer-secrets `
  --from-literal=POSTGRES_HOST=$pgHost `
  --from-literal=POSTGRES_PASSWORD=$pgPass `
  -n sparx-prod
```

## Password rotation

```powershell
gcloud sql users set-password sparx_app `
  --instance=$(terraform -chdir=../../terraform/envs/prod output -raw cloud_sql_instance_name) `
  --password=$NEW_PASSWORD

kubectl delete secret pgbouncer-secrets -n sparx-prod
# Recreate with the new password
kubectl rollout restart deployment pgbouncer -n sparx-prod
```
