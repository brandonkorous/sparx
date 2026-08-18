---
title: Terminology — retired & kept terms
node: business
type: rule
status: active
sources:
  - platform glossary (the storefront→site rename landed 2026-06-13 across copy + DB + API + CSS + docs)
---

The words we use are load-bearing — a **retired term is a bug**, not a style choice. The `storefront`→`site` rename (2026-06-13) swept copy, DB, API, CSS, and docs.

| retired | use | detail |
|---|---|---|
| **storefront** | **site** | The tenant-facing web system is a *site* — `wizeworks/apps/site`, `@sparx/site-ui`, `@wizeworks/site-themes`, CSS prefix `--st-*` / `.st-c-*` (**st = site**, renamed from `sf-`). |
| **store** | **site** | Sparx is website-as-a-service; the website is the *site*, selling is just the Commerce module. |
| **merchant** | **tenant** | "tenant" = the platform's customer; reserve "merchant" for a tenant that actually sells ([[what-sparx-is]]). |

**Kept — do NOT "fix" these** (real, intentional identifiers):

- The **sales-channel** enum value `'storefront'` (carts / orders / subscriptions) — a commerce-only channel (vs `b2b_portal` / `admin` / `mcp`). Legitimately "storefront" *there*.
- The site-builder **module key is `builder`** (renamed storefront→builder). A **legacy** `storefront` module-color alias survives in `module-provider.tsx` for `/sitebuilder`.
- Prefixes: `--st-*` = **site**; `sx-` = `@wizeworks/ui` (dashboard). Never confuse the two.

**Why this note exists:** "storefront" is **not** a synonym for "website" — the plain word is **site** (long form *website*); "storefront" means a *store's* front. When it slips out it's a tell that the platform is being framed **commerce-first**, which is wrong: sparx is a **site** platform and selling is one optional module ([[what-sparx-is]]). The recurring leak is a framing bug, not a vocabulary one — see [[terminology-drift]]. **Before you type "storefront" for anything but the commerce sales-channel: it's "site".**

Related: [[two-design-systems]], [[what-sparx-is]], [[terminology-drift]]
