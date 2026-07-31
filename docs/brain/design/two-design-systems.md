---
title: Two design systems
node: design
type: rule
status: active
applies-to: [both]
sources:
  - DESIGN.md
  - packages/brand/src/theme.css
  - packages/ui/src/tokens.css
  - docs/33-token-model-v2.md
  - packages/surface-compile/src/theme.ts
---

> 🚫 **The tenant-facing system is a "site", never a "storefront".** "storefront" was retired → "site" (2026-06-13) and survives only as a commerce _sales-channel_ name. Full glossary: [[terminology]].

sparx has **two** design systems. **The axis is whose brand a surface wears — NOT console vs marketing.**

|                   | **sparx's own surfaces**                                                                    | **Tenant sites**                        |
| ----------------- | ------------------------------------------------------------------------------------------- | --------------------------------------- |
| Apps              | `apps/workbench`, `apps/web`, `apps/market`, `apps/admin`, `apps/b2b-portal`                | `apps/site`                             |
| Whose brand       | **ours**                                                                                    | **the tenant's**                        |
| Token prefix      | `--color-base-*` / semantic `--color-*` / `--color-module-*` (silica, from `@sparx/brand`)  | `--st-*`                                |
| Component classes | silicaui plugin classes (`btn-*`, `bg-<color>`, `bg-soft`)                                  | `.st-c-*`                               |
| Library           | `@wizeworks/silicaui-react` (primitives) + `@sparx/ui` (compositions) + `ModuleScope`       | `@sparx/site-ui` + `@sparx/site-themes` |
| Compiled          | silica plugin + brand theme per app                                                         | `packages/surface-compile`, per-tenant  |
| Themeable         | no — one house system                                                                       | yes — per-tenant brand                  |
| Type scale        | fixed rem (no `clamp()`)                                                                    | fluid `clamp()` allowed                 |

## Correction (2026-07-31): the old split was on the wrong axis

This note previously split **"Dashboard / admin"** vs **"Site"**, which left `apps/web` and
`apps/market` belonging to neither. That gap was not academic — it read as permission to treat
marketing as its own design system with its own rules, and it directly produced a proposal to write
a second, parallel `DESIGN.md` for the marketing apps.

**Console and marketing are ONE system.** `apps/workbench`, `apps/web` and `apps/market` all import
the same `@sparx/brand/theme.css` and register the same palette through the same
`@plugin '@wizeworks/silicaui'`. The **only** difference anywhere in the platform is a single token
override — `apps/web` sets `--radius-box: 1.5rem` against the brand default `0.5rem`.

**That is the sanctioned shape of variance: override a token, never fork the language.** A surface
that needs to differ changes a value in its own `globals.css`; it does not get its own rules, doc, or
palette. Color rules are identical across all of them — see [[neutral-must-be-earned]] and `DESIGN.md`.

What legitimately differs between a console pane and a marketing page is **content register** (voice,
density, which composition idioms are allowed) — see [[console-is-not-marketing]]. That is a
different question from which design system you are in, and conflating the two is what produced the
error above.

**Why the real boundary still matters:** `apps/site` renders **someone else's brand**, so
`ModuleScope`, `--color-module-*` and the sparx palette are meaningless there, and an `--st-*` value
is meaningless in ours. The two look similar enough that rules bleed across, and a `ModuleScope`
assumption on a tenant site is wrong at a level typecheck never catches. One shared seam: the site's
`--st-*` tokens **bridge to silica base tokens** (`colorBackground → --color-base-200`,
`colorPrimary → --color-primary`, … in `site-themes/tokens.ts`) so a tenant override still cascades —
but the site system is otherwise untouched by ours.

**How to apply:** set `applies-to` on every design/component note using this vocabulary —
`[platform]` (all sparx-owned surfaces), `[site]` (tenant sites), `[both]`. Before building, name the
system out loud: _"this is a sparx surface → `@wizeworks/silicaui-react`, `--color-*`, module hues"_
or _"this is a tenant site → `--st-*`, the tenant's brand."_

Related: [[design]], [[neutral-must-be-earned]], [[console-is-not-marketing]], [[tokens-are-truth]], [[components]]
