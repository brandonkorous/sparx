# `apps/admin` — feature docs

Per-feature specs for the **WizeWorks admin portal** (`admin.wize.works`, `apps/admin`). These are the
granular, build-ready specs that sit **under** the umbrella spec — read it first:

- **Umbrella (scope):** [docs/76-admin-portal-spec.md](../../76-admin-portal-spec.md) — the whole portal
  (access model, tenant ops, impersonation, billing ops, infra). Cross-product: sparx, kanNINJA, HelpNinja.
- **Build plan (how):** [build-plan.md](build-plan.md) — the phased, grounded plan for building `apps/admin`:
  scaffold, the Layer-4 operator auth + capability model, cross-tenant data access **without** an RLS-bypass
  connection (all tenant data via api-rest `/internal/operator/*`, per [docs/16 §2.4](../../16-auth-security.md)),
  the `wize_admin` schema, data-model deltas, deploy wiring, and the security non-negotiables. Impersonation
  is **deliberately excluded** (D7). **Read this before writing any admin code.**
- **Architecture (authoritative):** [docs/16-auth-security.md](../../16-auth-security.md) §2.4 — the
  Platform-Operator (Layer 4) tier this app implements. Where 76 and 16 §2.4 disagree on _how_, 16 §2.4 wins.

The admin app is a separate Next.js app on **WizeWorks** infra (not SparxWorks), staff-auth only, VPN/IP
allowlisted. `apps/admin` is currently an empty placeholder; these docs capture the feature requirements
as they're decided so nothing is lost before the scaffold lands.

## Features

| Doc                        | Feature                               | Companion (product side)                      |
| -------------------------- | ------------------------------------- | --------------------------------------------- |
| [feedback.md](feedback.md) | In-product feedback triage & response | [docs/112-feedback.md](../../112-feedback.md) |

Add one row per feature doc. When a feature has a product-side (dashboard / API) companion, link it so the
two halves stay paired.
