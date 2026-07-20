---
title: sparx brain — home
type: map
status: active
---

# sparx brain

> The front door to how sparx is designed and built. **Start here.** Every node below is a Map of Content that routes you to the real source files — it indexes knowledge, it doesn't replace it. New here? Read [[CONTRACT]].

## ⚠️ Internalize this first: there are TWO design systems

Almost every UI mistake starts by conflating them. Every design/component note declares which one it governs (`applies-to`).

| | Dashboard / admin | Site (tenant sites) |
|---|---|---|
| Tokens | `--color-base-*` / semantic `--color-*` / `--color-module-*` (silicaui, from `@sparx/brand`) | `--st-*` |
| Component classes | silicaui plugin classes (`btn-*`, `bg-<color>`, `bg-soft`) | `.st-c-*` |
| Library | `@wizeworks/silicaui-react` primitives + `@sparx/ui` compositions + `ModuleProvider` | `@sparx/site-ui` + `@sparx/site-themes` |
| Compiled by | silica plugin + brand theme per app | `packages/surface-compile` per tenant |
| Themeable | no (house system: silicaui + brand) | yes (per-tenant brand) |

**Sources of truth:** dashboard color → `packages/brand/src/theme.css` (silicaui theme); dashboard non-color tokens → `packages/ui/src/tokens.css`; house rules → `apps/dashboard/DESIGN.md`. Site → `docs/33-token-model-v2.md` + `packages/surface-compile/src/theme.ts`.

> The tenant-facing system is a **site** — never a "storefront" (retired 2026-06-13, kept only as a commerce sales-channel). Glossary: [[terminology]].

## Nodes

**Design & build**
- [[design]] ⚠️ — the visual *language*; applies down onto components, elements, and content. **The acute node.**
- [[components]] — the silicaui primitives + `@sparx/ui` compositions, `SurfaceFrame`/`form-surface`, composition patterns, builder catalog.

**Product & business**
- [[features]] — the master catalog of every capability, each classified **module | program | platform**. Not every feature is a module — *partner* is a program. Owns the module-vs-program taxonomy.
- [[modules]] — the *module-kind* features: paid, feature-flagged, spectrum-hued domains; each links **PRD ↔ UI ↔ API ↔ data**.
- [[apps]] — inventory of `apps/*` + `services/*` (what each is, stack, entry points).
- [[business]] — WizeWorks, the content-and/or-commerce vision, **who we serve — non-technical business owners ([[audience]])**, clients, the billing/module model.

**System**
- [[architecture]] — RLS multi-tenancy, Better Auth, modules-are-flags, event-driven, API-first, MCP-first.
- [[activity]] — the awareness layer (product name: **Pulse**): Jobs ("is it running?"), Audit/Activity ("what happened?"), Notifications ("what needs me?"). The four-term taxonomy, built on the event firehose.
- [[data]] — Prisma schema, RLS mechanics, the customer/contact spine, the migration pipeline.
- [[api-events]] — our REST surface, the MCP server, the Pub/Sub event catalog, the email pipeline.
- [[infrastructure]] — GKE, phased infra, deploy/build/db-migrate/auto-tag workflows, Terraform, Caddy, cost.
- [[integrations]] — registry of every external service & tool (Stripe, kanNINJA, Mailgun, GCP, …) and the ones we rejected.

**Process & memory**
- [[conventions]] — ways of working: production-not-MVP, no-deferring, commit/release automation, pre-push, file size.
- [[lessons-learned]] — postmortems: what drifted, why, and the rule it produced (the partner drift lives here).
- [[tasks]] — durable roadmap + active-work index; live cards live in kanNINJA (see [[integrations]]).

## Task router — "I'm about to…"

Don't build from memory. Enter these nodes first.

| I'm about to… | Enter |
|---|---|
| Write ANY user-facing copy, label, description, error, or empty state | [[audience]] — non-technical business owners; informative + jargon-free → the `copywriter` agent |
| Build/redesign a **dashboard** page or overlay | [[design]] → [[components]] → the module in [[modules]] (match its existing surfaces) |
| Build a **create/edit form** | [[components]] (`SurfaceFrame`/`form-surface`) → [[design]] |
| Add a feature to a **module** | [[modules]] (its PRD + existing UI) → [[architecture]] → [[data]] → [[api-events]] |
| Touch **site / site-builder** UI | [[design]] (site branch) → [[components]] (builder catalog) |
| Change **schema / migrations** | [[data]] → [[infrastructure]] (pipeline) |
| Add an **API endpoint or MCP tool** | [[api-events]] → [[architecture]] |
| Build a **jobs / activity / audit / notification** surface | [[activity]] — use the four-term taxonomy; read-spine over ledgers, don't add a table |
| Wire up an **external service** | [[integrations]] → [[infrastructure]] |
| Deploy / infra / cost change | [[infrastructure]] → [[conventions]] (cost discipline) |
| Add a **program/feature** that isn't a module (like partner) | [[features]] (classify it) → [[design]] → [[components]] |
| Understand the **why** / business context | [[business]] |
| Need an exact **color / hue / size / radius** | [[dashboard-tokens]] — the materialized dashboard values |

## Quarantine — looks authoritative, is stale (do NOT trust)

- `docs/18-frontend-architecture.md` — HSL blue tokens, Inter font, pre-CVA components. Keep only the stack table / perf targets.
- `docs/sparx-design-tokens.css` — a token file that has diverged from live `tokens.css` (14px base, removed 3px stripe, wrong `--color-info`). The root doc-map points here by mistake.
- **root `CLAUDE.md` "Repository status" + a few specifics** — the "early scaffold / empty apps / no UI components" framing is false (277 models, ~18 services, ~90 UI components); email is **Mailgun** not Postal; the event examples `order.created`/`customer.updated` don't exist. The *architectural commitments* in CLAUDE.md are authoritative; the status framing + those specifics are not. See [[claude-md-drifted]].

_See [[CONTRACT]] for how notes are structured, named, and kept from drifting._
