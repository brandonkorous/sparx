---
title: Apps
type: map
status: active
---

# apps

Inventory of the deployable frontends + the service fleet. (Root CLAUDE.md calls `apps/*` "empty placeholders" — false for 4 of 6; see [[claude-md-drifted]].)

## Apps (`apps/*`)

| App | What | Stack | Port |
|---|---|---|---|
| **dashboard** `@sparx/dashboard` | primary staff/admin UI (builder, commerce, CRM, CMS, email…) — the largest app | Next.js 16 App Router, React 19, Tailwind v4, dnd-kit | 3000 |
| **site** `@sparx/site` | tenant site renderer (the live Builder output) | Next.js, site-ui / site-themes, builder-render | 3000 |
| **market** `@sparx/market` | sparx.market first-party marketplace (MoR checkout channel) | Next.js, Stripe.js | 3000 |
| **web** `@sparx/web` | WizeWorks marketing site + auth pages (`@sparx/web-chrome`) | Next.js, posthog | 3000 |
| **admin** | **empty placeholder** (spec'd docs/76, not scaffolded) | — | — |
| **b2b-portal** | **empty placeholder** (B2B served inside dashboard today) | — | — |

## More

- [[services]] — the 18 backend services (4 APIs + 14 workers).
- [[packages]] — the ~60 workspace packages, grouped by domain.

## Sources of truth

`apps/*/package.json` · `k8s/apps/*.yaml` · `pnpm-workspace.yaml`.
