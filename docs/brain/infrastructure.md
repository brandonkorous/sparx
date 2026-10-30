---
title: Infrastructure
type: map
status: active
---

# infrastructure

AKS on Azure (`aks-sparx-prod-cus`, resource group `rg-sparx-prod-cus`, centralus), shared by every WizeWorks product. **Two repositories, two releases:**

- **[wize-infrastructure](https://github.com/wizeworksllc/wize-infrastructure)** (local checkout `G:/code/@wizeworks/wize-infrastructure`) owns the cloud and everything shared on the cluster: all Terraform (the cluster, the shared Postgres server, every product's vault and storage, DNS, identities), the Caddy ingress and its routing table, the WizeLens collector, and jotDOJO's database role. Its own release ships no app images and takes minutes.
- **sparx** (this repo) owns sparx's own workloads: workflow-driven kustomize under `k8s/`, applied by [release.yml](../../.github/workflows/release.yml) (infrastructure → data → containers → cleanup), where stage 1 is only sparx's own cluster resources.

**When a sparx change needs new infra (a Caddy route, a DNS record, a database, a vault, an event's Pub/Sub topic), it is a PR to wize-infrastructure, released FIRST.**

## Notes

- [[topology]]: the cluster, what runs in `sparx-prod`, who applies it, the managed Postgres, NATS, DNS.
- [[deploy-workflows]]: the ONE sparx release pipeline: infrastructure → data → containers → cleanup, tag last (+ ci, ops, restore), and the ingress handover.
- [[terraform]]: where the Terraform lives now (wize-infrastructure), its layout, the destroy guard, the no-drift rule.
- [[phased-infra]] — the Phase-1 substitutions + the live-Typesense deviation + upgrade triggers.
- [[cost-and-ops-guardrails]] — verify cost before raising spend; cluster mutations go through workflows only.

## Sources of truth

`k8s/**` · `.github/workflows/**` · `docs/03-infrastructure-deployment.md` (+ 20 runbook, 21 cost) · in wize-infrastructure: `terraform/**`, `k8s/ingress/**`, `.github/workflows/release.yml`.
