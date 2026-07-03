---
title: Modules are feature-flags
node: architecture
type: rule
status: active
sources:
  - packages/modules/src/index.ts
  - packages/auth/src/module-gate.ts
  - services/api-rest/src/routes/v1/tenant.ts
---

A module is gated by a **flag**, never by a subscription/plan row. The flag lives at `tenants.settings.modules.<slug>.enabled` (JSON on the RLS-exempt `tenants` row), **default-deny**. `isModuleEnabled(tenantId, slug)` reads it with a 60s in-process cache.

- **Gated at every transport:** REST `*-context.ts` helpers throw `ModuleDisabledError` → **404** (`moduleDisabledEnvelope`); the MCP server refuses the tool (`MODULE_BY_SCOPE`); `requireModule(session, slug)` guards Server Actions/preHandlers. A disabled module returns 404, runs no workers, stores no rows.
- **Activation dual-publishes:** the toggle route publishes `module.activated` to **Pub/Sub** (out-of-process consumers + cache invalidation) **and** to an **in-process platform bus** (`publishPlatformEvent`) that synchronously seeds module defaults before the route returns — so there's no separate bootstrap round-trip. Assuming Pub/Sub is the only bus misses the sync provisioning path.
- Provisioning is idempotent find-or-create (redelivery-safe); a 6h reconcile loop (advisory lock) self-heals.

**Why:** plan-tier gating couples features to billing rows — fragile, and against the pricing model ([[billing-model]]).

**How to apply:** gate with `isModuleEnabled` / `requireModule` / a `*-context.ts` helper — never inline subscription checks. The full add-a-module registry walk is [[module-mechanism]].

Related: [[modules]], [[module-mechanism]], [[billing-model]], [[event-driven]]
