# `apps/admin` — feature docs

Per-feature specs for the **WizeWorks admin portal** (`admin.wize.works`, `apps/admin`). These are the
granular, build-ready specs that sit **under** the umbrella spec — read it first:

- **Umbrella:** [docs/76-admin-portal-spec.md](../../76-admin-portal-spec.md) — the whole portal (access
  model, tenant ops, impersonation, billing ops, infra). Cross-product: sparx, kanNINJA, HelpNinja.

The admin app is a separate Next.js app on **WizeWorks** infra (not SparxWorks), staff-auth only, VPN/IP
allowlisted. `apps/admin` is currently an empty placeholder; these docs capture the feature requirements
as they're decided so nothing is lost before the scaffold lands.

## Features

| Doc                        | Feature                               | Companion (product side)                      |
| -------------------------- | ------------------------------------- | --------------------------------------------- |
| [feedback.md](feedback.md) | In-product feedback triage & response | [docs/112-feedback.md](../../112-feedback.md) |

Add one row per feature doc. When a feature has a product-side (dashboard / API) companion, link it so the
two halves stay paired.
