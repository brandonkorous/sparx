---
title: Module vs program vs platform
node: features
type: rule
status: active
sources:
  - wizeworks/packages/modules/src/index.ts
  - sparx/packages/ui/src/providers/module-provider.tsx
---

Every capability is exactly one of three. The dividing line is **mechanical**, not a judgment call:

- **Module** — a key in `ModuleSlug` (`wizeworks/packages/modules/src/index.ts`). 12 of them. Each has a manifest, a catalog entry, a **Stripe price**, and a `settings.modules.<slug>.enabled` flag. Paid, toggleable, spectrum-hued. → [[modules]].
- **Program** — a gated capability that is **not** a paid module. Gated by something *other than* a module flag — a tenant opt-in row + an org role. **partner** is the canonical case (`partners` row + `PARTNER_OPS`). → [[partner]].
- **Platform** — every tenant gets it, no gate (auth, billing, search, onboarding, finance, automations, seo, notifications, the shell).

A **hue** in `module-provider.tsx` does **not** make something a module — that file deliberately carries hues for `partner`, `finance`, `seo`, `automations`, `storefront` (a **legacy** code key — the retired term; see [[terminology]]), `platform`, and flags each in-file as "owns a hue, NOT a module."

**Why:** treating a program like a module (or vice-versa) is exactly what made the partner portal read as off-brand — the missing ADR from [[partner-pages-drift]].

**How to apply:** new capability? Classify it here **first**. `ModuleSlug` key with a price → module. Gated by a non-flag → program. Ungated + universal → platform. The class decides billing, gating, and whether it wears a module hue.

Related: [[partner]], [[modules]], [[partner-pages-drift]]
