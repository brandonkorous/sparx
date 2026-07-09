---
title: Two design systems
node: design
type: rule
status: active
applies-to: [both]
sources:
  - packages/brand/src/theme.css
  - packages/ui/src/tokens.css
  - docs/33-token-model-v2.md
  - packages/surface-compile/src/theme.ts
---

> 🚫 **The tenant-facing system is a "site", never a "storefront".** "storefront" was retired → "site" (2026-06-13) and survives only as a commerce *sales-channel* name. Full glossary: [[terminology]].

sparx has **two** design systems that share a token *shape* but keep separate *layers*. Every design/component decision must first answer "which one?"

| | Dashboard / admin | Site (tenant sites) |
|---|---|---|
| Token prefix | `--color-base-*` / semantic `--color-*` / `--color-module-*` (silica, from `@sparx/brand`) | `--st-*` |
| Component classes | silicaui plugin classes (`btn-*`, `bg-<color>`, `bg-soft`) | `.st-c-*` |
| Library | `@wizeworks/silicaui-react` (primitives) + `@sparx/ui` (compositions) + `ModuleProvider` | `@sparx/site-ui` + `@sparx/site-themes` |
| Compiled | silica plugin + brand theme per app | `packages/surface-compile`, per-tenant |
| Themeable | no — one house system (silicaui + brand) | yes — per-tenant brand |
| Type scale | fixed rem (no `clamp()`) | fluid `clamp()` allowed |

**Why:** they look similar enough that rules bleed across. A `--st-*` value in the dashboard, or a `ModuleProvider` assumption on a tenant site, is wrong at a level typecheck never catches. Note the one shared seam: the site's `--st-*` tokens now **bridge to silica base tokens** (`colorBackground → --color-base-200`, `colorPrimary → --color-primary`, … in `site-themes/tokens.ts`) so a tenant override still cascades — but the site system is otherwise untouched by the dashboard's silicaui migration.

**How to apply:** set `applies-to` on every design/component note. When building, name the system out loud first ("this is a dashboard surface → `@wizeworks/silicaui-react` + `@sparx/ui` compositions, `--color-base-*`/`--color-*`"). The dashboard is `#6366F1`-indigo-anchored; sites wear the tenant's brand.

Related: [[design]], [[tokens-are-truth]], [[components]]
