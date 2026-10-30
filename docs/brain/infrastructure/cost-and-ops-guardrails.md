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
- **No Terraform drift** ([[terraform]]). The Terraform lives in wize-infrastructure, so a mirrored fix is a PR there.
- **Shared infra changes ship from wize-infrastructure, first.** A new database, vault, DNS record, Caddy route or Pub/Sub topic (and any spend it adds) is a change to [wize-infrastructure](https://github.com/wizeworksllc/wize-infrastructure), released by its own pipeline before the sparx change that relies on it. Its release is where the cloud bill moves, so the cost check above applies to its PRs too.

Related: [[phased-infra]], [[deploy-workflows]], [[terraform]]
