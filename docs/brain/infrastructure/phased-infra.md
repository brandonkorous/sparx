---
title: Phased infra (start cheap)
node: infrastructure
type: rule
status: active
sources:
  - docs/03-infrastructure-deployment.md
---

Infra is **phased — start cheap.** Don't propose a Phase 2/3 managed service without a stated revenue/scale trigger (docs/03 §3 + §10).

- **Redis in a GKE pod, not Memorystore** — ✅ current. Upgrade trigger: first customer-visible missed email/automation, or >20 paying tenants.
- **Postal in a pod, not SendGrid** — **superseded by Mailgun** (managed HTTP API on `sparx.email`). Still not SendGrid/Postmark/SES. See [[mailgun]].
- **Postgres FTS, not Typesense/Elasticsearch** — **partially superseded:** Typesense is **already live** (`k8s/typesense/`, `@wizeworks/search`, commerce-indexer) — a deliberate, documented deviation for Gillett Diesel fitment-faceted search (docs/22). Elasticsearch remains Phase 3.

## ⚠️ Doc-vs-code

docs/03 + CLAUDE.md still frame Typesense as Phase-2 and email as Postal; live reality is **Typesense-now + Mailgun**. Reconcile the docs — tracked in [[open-punch-list]].

Related: [[cost-and-ops-guardrails]], [[integrations]], [[mailgun]]
