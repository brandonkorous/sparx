---
title: Infrastructure
type: map
status: active
---

# infrastructure

GKE Autopilot on GCP (project `sparxworks`, us-central1). **Terraform owns the platform; workflow-driven kustomize owns workloads.**

## Notes

- [[topology]] — the cluster, in-cluster pods (Redis / PgBouncer / Caddy / Typesense), Cloud SQL, Pub/Sub, Cloud Run, DNS.
- [[deploy-workflows]] — the ONE release pipeline: infrastructure → data → containers → cleanup (+ ci, ops, restore, auto-tag).
- [[terraform]] — TF layout + modules + the no-drift rule.
- [[phased-infra]] — the Phase-1 substitutions + the live-Typesense deviation + upgrade triggers.
- [[cost-and-ops-guardrails]] — verify cost before raising spend; cluster mutations go through workflows only.

## Sources of truth

`terraform/envs/prod/` · `k8s/**` · `.github/workflows/**` · `docs/03-infrastructure-deployment.md` (+ 20 runbook, 21 cost).
