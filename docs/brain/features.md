---
title: Features
type: map
status: active
---

# features

The master catalog of **every capability**, each classified. Read [[taxonomy]] for the dividing line. The rule that made this node necessary: *not every feature is a module* — [[partner]] is a **program**. Classifying a new capability here, **before** building it, is now a required step (see [[partner-pages-drift]]).

## Modules (12) — paid, flagged, spectrum-hued

Full cross-link detail in [[modules]]. Keys: builder · commerce · cms · crm · email · b2b · invoicing · dropship · inventory · chat · scheduling · ai.

## Programs — gated, but not a paid module

| Feature | Gate | Home |
|---|---|---|
| **partner** | `partners` tenant-row + `PARTNER_OPS` org role | [[partner]] |

## Platform — every tenant, no module flag

| Feature | One-liner | Home / anchor |
|---|---|---|
| **auth** | Better Auth; orgs = tenants | [[architecture]] · `@wizeworks/auth` |
| **billing / subscriptions** | turns module flags into charges | [[billing-model]] · `v1/billing.ts` |
| **onboarding** | live site in <5 min | [[onboarding]] |
| **search** | Typesense projections + universal search | [[api-events]] · [[integrations]] |
| **finance** | the money hub (owns a hue, not a module) | `finance/` · docs/109 |
| **automations** | platform capability; reachable when MCP is | `automations/` · docs/81 |
| **seo** | always-on discoverability | `seo/` · docs/50 |
| **marketplace** | blueprint / market install | `marketplace/` · docs/60 |
| **notifications** | web-push | `settings/notifications/` · `v1/push.ts` |
| **shell chrome** | the dashboard that hosts every module | [[apps]] · [[components]] |

A platform feature grows its own `features/<slug>.md` note when it accrues real gotchas (boy-scout) — until then its home node/anchor is enough ([[CONTRACT]]).

## Sources of truth

`wizeworks/packages/modules/src/index.ts` (modules) · `sparx/packages/ui/src/providers/module-provider.tsx` (hue superset — flags each non-module in-file) · `_shell/registry.ts` (manifests).
