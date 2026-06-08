# Sparx Platform — Documentation Index

**Platform:** Sparx (sparx.works)
**Company:** WizeWorks (wize.works)
**Author:** Brandon Korous (me@brandonkorous.com)
**Last Updated:** 2026-06-08

---

## What Is Sparx?

Sparx is WizeWorks' unified content and commerce operating system — a modular platform that gives any organization a live website, CMS, CRM, commerce, email, B2B wholesale, dropshipping, and AI integration in one place. Publish content, sell products, or both — you activate only the modules you need. Built and operated by WizeWorks.

Sparx is to WizeWorks what Shopify is to its parent company — except Sparx spans content and commerce, is modular, open to headless use, MCP-native, and never charges you for features you don't need.

## Domain Portfolio

| Domain           | Purpose                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `sparx.works`    | Primary brand: marketing site, `app`, `api`, `mcp`                                                                                          |
| `sparx.zone`     | Tenant storefronts (`acme.sparx.zone`) + `customers.sparx.zone` (custom-domain CNAME target). Shopify-style split for reputation isolation. |
| `sparx.email`    | Postal sending infrastructure + platform→tenant transactional emails (replaces planned `sparx.mx` which was unavailable)                    |
| `sparx.host`     | Managed hosting product marketing (301 → sparx.works/hosting until built)                                                                   |
| `sparx.software` | Developer portal: SDK docs, API reference, MCP guides (301 → sparx.works/docs until built)                                                  |
| `sparx.exchange` | Defensive registration (301 → sparx.works)                                                                                                  |
| `sparx.market`   | Future theme/plugin/connector marketplace                                                                                                   |
| `sparxcms.com`   | CMS module marketing site                                                                                                                   |
| `sparxcrm.com`   | CRM module marketing site                                                                                                                   |
| `sparxemail.com` | Email module marketing site                                                                                                                 |
| `sparxb2b.com`   | B2B/wholesale module marketing site                                                                                                         |

## WizeWorks Portfolio Context

Sparx is one of several products under the WizeWorks umbrella:

- sparx.works — Content & commerce platform (this platform)
- kanninja.com — Project management
- helpninja.ai — AI support
- stumbleable.com — TBD
- agconn.com — TBD
- splits.network — TBD
- applicant.network — TBD
- employment-networks.com — TBD

## Core Design Principles

1. **Live in 5 minutes** — Default experience gets you to a live site faster than any competitor
2. **Modular by design** — You pay only for what you use; modules activate independently
3. **Progressive disclosure** — Power features exist but never block the simple path
4. **API-first** — Every feature accessible via API; the UI is one consumer among many
5. **MCP-native** — AI integration is a first-class citizen, not a plugin
6. **Own your data** — You own your data; Sparx is the platform, not the warden
7. **Single pane of glass** — Every active module visible in one unified dashboard

## Module Structure

Sparx is built around independently activatable modules:

| Module        | Standalone | Marketing Domain |
| ------------- | ---------- | ---------------- |
| Storefront    | $49/mo     | sparx.works      |
| Commerce      | +$49/mo    | sparx.works      |
| CMS           | $49/mo     | sparxcms.com     |
| CRM           | +$49/mo    | sparxcrm.com     |
| Email         | +$29/mo    | sparxemail.com   |
| B2B/Wholesale | +$99/mo    | sparxb2b.com     |
| AI/MCP        | +$49/mo    | sparx.works      |
| Dropship      | +$29/mo    | sparx.works      |

## Key v2 Decisions

Decisions locked in during the v2 documentation pass (vs. the original WizeWorks-Platform draft):

- **Platform name:** Sparx (`sparx.works`) — was "WizeWorks Platform"
- **Email infrastructure:** Postal (self-hosted) — was Resend
- **Auth:** Better Auth (self-hosted, open source) — was custom JWT only
- **Pricing:** Modular per-module — was tiered plans
- **CMS:** Standalone module, no Commerce required — was bundled
- **Commerce:** Separate module from CMS — was combined

## Document Index

| #   | Document                            | Description                                                                                                                                                                                  |
| --- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01  | Platform Vision & Strategy          | Why Sparx exists, who it's for, how it competes                                                                                                                                              |
| 02  | Architecture Overview               | System design, infrastructure, tech stack                                                                                                                                                    |
| 03  | Infrastructure & Deployment         | GKE, Terraform, CI/CD, environments                                                                                                                                                          |
| 04  | Domain & SSL Automation             | Subdomain provisioning, custom domains, cert management                                                                                                                                      |
| 05  | Data Model                          | Core entities, relationships, multi-tenancy                                                                                                                                                  |
| 06  | API Specification                   | REST + GraphQL, auth, versioning, webhooks                                                                                                                                                   |
| 07  | MCP Server Spec                     | AI integration for Claude, ChatGPT, Copilot                                                                                                                                                  |
| 08  | Site Builder Spec                   | Theme system, visual customizer, headless SDK                                                                                                                                                |
| 09  | E-Commerce Engine PRD               | Products, orders, cart, checkout, payments                                                                                                                                                   |
| 10  | B2B & Wholesale PRD                 | Accounts, pricing, quotes, net terms, fleet                                                                                                                                                  |
| 11  | CRM PRD                             | Contacts, pipeline, activity log, automation                                                                                                                                                 |
| 12  | CMS PRD                             | Content, media, SEO, blog, landing pages                                                                                                                                                     |
| 13  | Email Platform PRD                  | Postal infrastructure, automations, domain auth                                                                                                                                              |
| 14  | Dropship Integration PRD            | Supplier connectors, catalog sync, order routing                                                                                                                                             |
| 15  | Merchant Onboarding PRD             | 5-minute signup flow, progressive disclosure                                                                                                                                                 |
| 16  | Multi-Tenancy & Security            | Isolation, Better Auth, RBAC, audit logs                                                                                                                                                     |
| 17  | Billing & Subscriptions             | Modular pricing, Stripe, managed hosting                                                                                                                                                     |
| 18  | Frontend Architecture               | Next.js, design system, monorepo                                                                                                                                                             |
| 19  | Testing Strategy                    | Unit, integration, E2E, load testing                                                                                                                                                         |
| 20  | Operational Runbook                 | Monitoring, incidents, backup, restore                                                                                                                                                       |
| 21  | Cost & Scaling Guide                | Phased infrastructure, cost ceilings, upgrade triggers                                                                                                                                       |
| 22  | Typesense Search Specification      | Day-1 search index, schemas, sync workers                                                                                                                                                    |
| 23  | Frontend Component Architecture     | CVA + Shadcn + ModuleProvider, tokens, variants                                                                                                                                              |
| 24  | Domain Purchase & Management        | GoDaddy Reseller integration, instant connect, lifecycle                                                                                                                                     |
| 25  | Monorepo Structure                  | pnpm workspaces + Turborepo layout, bootstrap order                                                                                                                                          |
| 26  | Domain Transfer Runbook             | GoDaddy → Cloudflare migration, ordered checklist, rollback paths                                                                                                                            |
| 27  | Customer Accounts & Storefront Auth | Layer-2 shopper auth, tenant-scoped, Argon2id, account area                                                                                                                                  |
| 28  | Third-Party Inventory Sync          | Generic ERP/WMS mirror, source adapters, on-prem bridge, backlog                                                                                                                             |
| 29  | Site Builder Architecture           | Theme/section engine, draft→publish→schedule, light/dark, boundaries                                                                                                                         |
| 30  | Site Builder Redesign               | One-screen editor, layout/template model, assignment, navigation flip                                                                                                                        |
| 32  | Workspace Switching & Breadcrumb    | Phased plan: module switcher + workspace switch/create, org-plugin risk                                                                                                                      |
| 33  | Token Model v2                      | Semantic palette + shape/rhythm/effects, brand-vs-presentation ownership                                                                                                                     |
| 34  | Platform Glossary & Concept Model   | Canonical terms; tenant → brand → site → modules; "storefront" overload                                                                                                                      |
| 35  | UI Variant System                   | Multi-axis color × variant × size recipe system for `@sparx/ui` components                                                                                                                   |
| 36  | Site Builder Layering Model         | Brand+Theme / SiteLayout / PageLayout tiers; template→layout; data-driven targets; assignment cascade                                                                                        |
| 37  | Site Builder Section System         | Landing-composition gaps + target model: multi-CTA, full-bleed media, Panels/Media+Text/Stats/Embed                                                                                          |
| 38  | Site Builder Extensible Sections    | Letting tenants add components: compose → saved blocks → declarative custom types → marketplace                                                                                              |
| 39  | Universal Search                    | One `entities` Typesense collection + projector registry + generic `search.entity.changed` event                                                                                             |
| 40  | Site Builder Composition Model      | Website = tree; Tier-1 primitives vs Tier-2 data-aware components; typed binding schema keystone                                                                                             |
| 41  | Builder: Page Model & Persistence   | UI-first page editor node model, registry, canvas/inspector, persistence                                                                                                                     |
| 42  | Legal Documents & Cookie Consent    | Tenant legal pages, configurable cookie consent, platform legal acceptance gate                                                                                                              |
| 43  | Builder: The Binding Schema         | Typed data-binding contract for builder nodes (single / scope / iterate cardinality)                                                                                                         |
| 44  | Builder: The Storefront Render Path | Published node tree → production storefront markup (distinct from editor canvas)                                                                                                             |
| 45  | Builder: The Site Layout Editor     | Site chrome/layout shell editor — header / footer / announcement / regions                                                                                                                   |
| 46  | `@sparx/site-ui` Component Library  | Tenant-themed (`--sf-*`) SSR-first storefront component library; four-axis recipe foundation                                                                                                 |
| 47  | Class-First Authoring Model         | Brand-governed component classes (Surface) + per-tenant `@apply`→CSS compile pipeline                                                                                                        |
| 48  | Product Markup, Surcharges & Fees   | _Planned._ Cost→price markup rules, parts matrix, invoice-line markup, configurable card-fee surcharge                                                                                       |
| 49  | Multi-Site per Tenant               | _Planned._ One tenant → many sites; `site_id` presentation scope vs. the multi-workspace axis                                                                                                |
| 50  | SEO & AIO Discoverability           | Sitemap completeness, redirect enforcement, Builder-page SEO, AIO `llms.txt` + crawler policy + FAQ schema                                                                                   |
| 51  | Content Architecture                | Content (page-level schema) / Components / Templates / Pages; schema owned by content, authored in the builder; first-class content-type→template link replaces the `record_type` string     |
| 52  | Email Builder                       | Email as one self-contained node tree, same composition model, renderer, and publish lifecycle as pages                                                                                      |
| 53  | Builder Tenant Components           | User-authored components without a deploy; declarative, versioned, parameterized node-trees; system → Copy → tenant; publish-expands `custom:*` to primitives                                |
| 54  | Tenant Blueprints                   | _Planned._ One-click marketplace templates that provision a whole tenant (brand/theme + content + commerce + pages + emails + components), draft → review → go live                          |
| 60  | Marketplace                         | _Planned._ Unified categorized add-on surface (Blueprints/Themes/Integrations/Components); category registry + home/browse/detail tiers + faceted Typesense search                           |
| 63  | External Data Connections           | _Planned — capstone._ Bind live external REST/GraphQL/SQL sources into Builder pages as native `ext.*` `DataSource`s; hardened SSRF proxy, declarative mapping, cached/SSR/live render modes |
