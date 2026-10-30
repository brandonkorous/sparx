# Monitoring

## Now — the WizeLens collector (AKS)

wize-infrastructure's release ([`.github/workflows/release.yml`](https://github.com/wizeworksllc/wize-infrastructure/blob/main/.github/workflows/release.yml),
job `cluster`, step "Install the WizeLens collector") installs the WizeLens collector chart into the `monitoring`
namespace on every run. It moved there from sparx's release on 2026-10-29, because it watches the whole cluster, not
only sparx; to change its version or its key, change that repository. It sends node, pod, container and workload metrics of
`aks-sparx-prod-cus` to app.wizelens.com, project `sparx-prod`, so the Hosts and Kubernetes pages sit beside the apps'
traces.

- **Chart:** `oci://ghcr.io/brandonkorous/charts/wizelens-collector`, pinned by `COLLECTOR_VERSION` in that step.
- **Access:** a read-only ClusterRole (get, list, watch on nodes, pods, workloads, events). It changes nothing.
- **Key:** `wizelens-collector-ingest-key` in the WizeLens vault (`kv-wizelens-prod-cus`), never sparx's vault (every
  secret there goes into all app pods). With no key the step warns and skips.
- **Size:** one agent per node (128 Mi asked, 512 Mi cap) and one cluster collector.

The sections below are the old GKE plan, kept for history.

## Phase 1 — GCP native (no manifests needed)

Per [docs/03-infrastructure-deployment.md](../../docs/03-infrastructure-deployment.md) §9, Phase 1 monitoring uses:

- **Cloud Monitoring** — GKE pod metrics (CPU, memory, restarts), Cloud SQL metrics
- **Cloud Logging** — structured JSON logs from all containers; queries documented in [docs/20-operational-runbook.md](../../docs/20-operational-runbook.md) §6
- **Uptime checks** — pings `/health` on each app's public domain (created out-of-band in Cloud Console or via Terraform later)

Alerts to configure in Cloud Monitoring on day one:

- Pod crash loop (`kubernetes.io/container/restart_count`)
- Cloud SQL CPU > 80%
- API 5xx rate > 5% over 5 min
- Caddy down (`/health` on `api.sparx.works`)
- Domain SSL cert expiring < 30 days

## Phase 2 — Self-hosted Prometheus + Grafana

When custom business metrics matter, install in the `monitoring` namespace:

```powershell
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install kube-prom prometheus-community/kube-prometheus-stack `
  --namespace monitoring `
  --values prometheus-values.yaml
```

Then add `ServiceMonitor` resources alongside each app Deployment.

## Phase 3 — PagerDuty + Sentry

Per [docs/21-cost-scaling-guide.md](../../docs/21-cost-scaling-guide.md) §8 — only when there's revenue to justify the spend.
