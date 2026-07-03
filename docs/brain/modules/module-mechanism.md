---
title: How a module is wired
node: modules
type: pattern
status: active
applies-to: [dashboard]
sources:
  - packages/modules/src/index.ts
  - packages/auth/src/module-gate.ts
  - apps/dashboard/app/(dashboard)/_shell/registry.ts
---

A module is defined in **one canonical place** and referenced from several registries that must agree.

- **Registry:** `ModuleSlug` + `ALL_MODULES` in `packages/modules/src/index.ts` — the closed set of 12. `BUNDLED_FREE` (invoicing + inventory ride free on commerce/b2b) and `REQUIRES` (b2b needs commerce) live here too.
- **Flag:** enabled at `tenants.settings.modules.<slug>.enabled`, **default-deny**.
- **Gate:** `requireModule(session, slug)` in `packages/auth/src/module-gate.ts` (composing `isModuleEnabled`). A disabled module returns 404, runs no workers, stores no rows.
- **Activation is event-driven** (`module.activated` on Pub/Sub) — never gate by reading subscription/billing rows inline ([[billing-model]]).

**To add a module you touch:** the `ModuleSlug` registry · a manifest in `_shell/registry.ts` · a hue in `module-provider.tsx` · an upsell entry in `module-catalog.ts` (compile-time forces one per slug) · a Stripe price in `packages/billing/src/price-catalog.ts` · REST routes in `services/api-rest/` · MCP tools in `packages/<domain>/src/mcp/`.

**Why:** flag / manifest / catalog / price / gate must stay in sync — a partial add gives a module that's togglable but unpriced, or priced but invisible. Same failure shape as the [[three-registries-footgun]], one layer up.

**How to apply:** adding or renaming a module → walk the full list above. The compile-time `ModuleSlug` keying catches the catalog omission; the rest won't error on their own, so verify each.

Related: [[architecture]], [[billing-model]], [[features]], [[three-registries-footgun]]
