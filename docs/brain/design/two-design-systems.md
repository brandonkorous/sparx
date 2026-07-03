---
title: Two design systems
node: design
type: rule
status: active
applies-to: [both]
sources:
  - packages/ui/src/tokens.css
  - docs/33-token-model-v2.md
  - packages/surface-compile/src/theme.ts
---

> 🚫 **The tenant-facing system is a "site", never a "storefront".** "storefront" was retired → "site" (2026-06-13) and survives only as a commerce *sales-channel* name. Full glossary: [[terminology]].

sparx has **two** design systems that share a token *shape* but keep separate *layers*. Every design/component decision must first answer "which one?"

| | Dashboard / admin | Site (tenant sites) |
|---|---|---|
| Token prefix | `--color-*` / `--module-*` / `--sparx-*` | `--st-*` |
| Role classes | `.sx-c-*` | `.st-c-*` |
| Library | `@sparx/ui` + `ModuleProvider` | `@sparx/site-ui` + `@sparx/site-themes` |
| Compiled | imported once per app | `packages/surface-compile`, per-tenant |
| Themeable | no — one house system | yes — per-tenant brand |
| Type scale | fixed rem (no `clamp()`) | fluid `clamp()` allowed |

**Why:** they look similar enough that rules bleed across. A `--st-*` value in the dashboard, or a `ModuleProvider` assumption on a tenant site, is wrong at a level typecheck never catches.

**How to apply:** set `applies-to` on every design/component note. When building, name the system out loud first ("this is a dashboard surface → `@sparx/ui`, `--color-*`"). The dashboard is `#6366F1`-indigo-anchored; sites wear the tenant's brand.

Related: [[design]], [[tokens-are-truth]], [[components]]
