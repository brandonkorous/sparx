# Sparx Kubernetes Manifests

**Version:** 2.0
**Author:** Brandon Korous
**Last Updated:** 2026-10-29

The workloads sparx runs on the shared AKS cluster `aks-sparx-prod-cus`. The cloud underneath them (the cluster, the managed Postgres server, networking, DNS, the vaults, the identities) and the Caddy ingress in front of them are **not in this repository**: they live in [wize-infrastructure](https://github.com/wizeworksllc/wize-infrastructure) (local checkout `G:/code/@wizeworks/wize-infrastructure`) and ship through its own release, because they serve every WizeWorks product on the cluster. Terraform there owns the platform; kubectl/kustomize here owns sparx's workloads.

## Layout

```
k8s/
├── azure/                   # The deployed overlays: infra (stage 1), jobs (stage 2), apps (stage 3)
├── apps/                    # App + API Deployments, consumed verbatim by every overlay
├── cronjobs/                # Every CronJob (`curl` containers, no per-service image)
├── self-hosted/             # The worker fleet + the NATS broker, shared with local
├── typesense/               # Search
├── pgbouncer/               # GCP-era pooler copy; on AKS see azure/infra/pgbouncer.yaml
├── local/                   # Docker Desktop overlay (pulls the ingress from wize-infrastructure)
├── monitoring/              # Alerting notes; the WizeLens collector is wize-infrastructure's
├── postal/                  # Decommissioned (email runs on Mailgun)
├── redis/                   # GCP-era; dropped on Azure, where NATS carries its job
├── jobs/, workers/          # GCP-era notes
└── scripts/                 # sync-secrets.ps1 (loads Key Vault)
```

The Caddy ingress used to be `k8s/ingress/` here. It is now wize-infrastructure's [`k8s/ingress/`](https://github.com/wizeworksllc/wize-infrastructure/blob/main/k8s/ingress), applied by that repository's release into namespace `sparx-prod` under the label `app.kubernetes.io/managed-by: wize-infrastructure`. A new host block is a pull request there.

## Phase 1 acceptable trade-offs

These match [docs/03-infrastructure-deployment.md](../docs/03-infrastructure-deployment.md) §4 — start cheap, upgrade on observable signal:

- **No External Secrets Operator.** The release syncs `sparx-app-secrets` from Key Vault `kv-sparx-prod-cus` on every run (see [azure/README.md](azure/README.md)).
- **Caddy is single-replica.** Cert storage is local to its PVC. Multi-replica Caddy needs distributed cert storage: Phase 2, and a change to wize-infrastructure.
- **One shared PgBouncer Deployment**, not per-app sidecar. Lower complexity; if it becomes a hotspot, move to sidecars.

## Apply order

There is no hand-run apply order any more. [release.yml](../.github/workflows/release.yml) applies `azure/infra`, then runs the data Jobs from `azure/jobs`, then applies `azure/apps`, every push to `main`. See [azure/README.md](azure/README.md) for the overlays and [.github/workflows/README.md](../.github/workflows/README.md) for the stages. If the change you are shipping needs new cloud resources or a new route, release wize-infrastructure first.

## What's still TODO

- [ ] External Secrets Operator (when the release-time sync becomes painful)
- [ ] PodMonitor / ServiceMonitor when Prometheus lands (Phase 2)
- [ ] NetworkPolicies (when tenant isolation testing demands it)
