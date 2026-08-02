---
title: Cost & ops guardrails
node: infrastructure
type: rule
status: active
sources:
  - docs/21-cost-scaling-guide.md
  - docs/03-infrastructure-deployment.md
---

**Never silently raise ongoing spend.** Any change to pod requests/limits, replica counts, new services, or a managed-tier upgrade must surface the **$ delta + get approval** — reach for the zero-cost structural fix first.

- Cost postures already in the wild: api-rest replicas **clamped to 1** (SSD quota); Phase-1 Pub/Sub topics with **empty subscriber lists** (topic-only until a consumer exists). Don't "fix" these without recognizing they're deliberate.
- **Cluster mutations go through the release pipeline** (`release.yml`) or, for a one-off chore, `ops.yml` — reads (`get` / `logs`) are fine; **no manual `kubectl apply`** ([[deploy-workflows]]).
- **No Terraform drift** ([[terraform]]).

Related: [[phased-infra]], [[deploy-workflows]], [[terraform]]
