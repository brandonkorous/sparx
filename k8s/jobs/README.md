# One-Off Jobs

## `migrate.yaml`

**GCP-era.** On AKS, migrations do not use this file: stage 2 (data) of [release.yml](../../.github/workflows/release.yml) runs `prisma migrate deploy` from the `db` image as an in-cluster Job (`db-migrate`), connected as the owner role, after the `db-roles` Job and before the platform seed. See [wizeworks/packages/db/CLAUDE.md](../../wizeworks/packages/db/CLAUDE.md). The `deploy-prod.yml` workflow that used to apply this template is deleted.

The template ran `prisma migrate deploy` against Cloud SQL via PgBouncer, in-cluster (where the Cloud SQL private IP is reachable) so it needed no Cloud SQL Auth Proxy.

### Manual run (GCP only)

The GCP Terraform now lives in [wize-infrastructure](https://github.com/wizeworksllc/wize-infrastructure), so the project id comes from that checkout:

```powershell
$tag = "v1.2.3"
$project = terraform -chdir=../wize-infrastructure/terraform/envs/prod output -raw project_id
$suffix = (Get-Date -UFormat %s).Substring(5)

(Get-Content k8s/jobs/migrate.yaml) `
  -replace 'IMAGE_TAG', $tag `
  -replace 'PROJECT_ID', $project `
  -replace 'JOB_SUFFIX', $suffix |
  kubectl apply -f -

kubectl wait --for=condition=complete --timeout=15m `
  job/sparx-migrate-$suffix -n sparx-prod

kubectl logs job/sparx-migrate-$suffix -n sparx-prod
```

### Rollback

Prisma migrations are forward-only — per [docs/03 §8](../../docs/03-infrastructure-deployment.md): "Database migrations are forward-only. Schema rollbacks are a new forward migration." Never `prisma migrate reset` in production.
