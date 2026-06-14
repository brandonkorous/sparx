# Sparx Platform — Documentation Index

**Platform:** Sparx (sparx.works)
**Company:** WizeWorks (wize.works)
**Author:** Brandon Korous (me@brandonkorous.com)
**Last Updated:** 2026-06-11

---

## What Is Sparx?

Sparx is WizeWorks' unified content and commerce operating system — a modular platform that gives any organization a live website, CMS, CRM, commerce, email, B2B wholesale, dropshipping, and AI integration in one place. Publish content, sell products, or both — you activate only the modules you need. Built and operated by WizeWorks.

Sparx is to WizeWorks what Shopify is to its parent company — except Sparx spans content and commerce, is modular, open to headless use, MCP-native, and never charges you for features you don't need.

## Domain Portfolio

| Domain           | Purpose                                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `sparx.works`    | Primary brand: marketing site, `app`, `api`, `mcp`                                                                                    |
| `sparx.zone`     | Tenant sites (`acme.sparx.zone`) + `customers.sparx.zone` (custom-domain CNAME target). Shopify-style split for reputation isolation. |
| `sparx.email`    | Postal sending infrastructure + platform→tenant transactional emails (replaces planned `sparx.mx` which was unavailable)              |
| `sparx.host`     | Managed hosting product marketing (301 → sparx.works/hosting until built)                                                             |
| `sparx.software` | Developer portal: SDK docs, API reference, MCP guides (301 → sparx.works/docs until built)                                            |
| `sparx.exchange` | Defensive registration (301 → sparx.works)                                                                                            |
| `sparx.market`   | Future theme/plugin/connector marketplace                                                                                             |
| `sparxcms.com`   | CMS module marketing site                                                                                                             |
| `sparxcrm.com`   | CRM module marketing site                                                                                                             |
| `sparxemail.com` | Email module marketing site                                                                                                           |
| `sparxb2b.com`   | B2B/wholesale module marketing site                                                                                                   |

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

Each module is an independent, flat-priced toggle (no tiers, no base plan). See [17-billing-subscriptions.md](17-billing-subscriptions.md) §2.

| Module      | Price  | Marketing Domain |
| ----------- | ------ | ---------------- |
| Builder     | $10/mo | sparx.works      |
| Commerce    | $49/mo | sparx.works      |
| CMS         | $49/mo | sparxcms.com     |
| CRM         | $49/mo | sparxcrm.com     |
| Email       | $29/mo | sparxemail.com   |
| B2B · Fleet | $99/mo | sparxb2b.com     |
| AI · MCP    | $49/mo | sparx.works      |
| Dropship    | $29/mo | sparx.works      |
| Live Chat   | $19/mo | sparx.works      |

## Key v2 Decisions

Decisions locked in during the v2 documentation pass (vs. the original WizeWorks-Platform draft):

- **Platform name:** Sparx (`sparx.works`) — was "WizeWorks Platform"
- **Email infrastructure:** Postal (self-hosted) — was Resend
- **Auth:** Better Auth (self-hosted, open source) — was custom JWT only
- **Pricing:** Modular per-module — was tiered plans
- **CMS:** Standalone module, no Commerce required — was bundled
- **Commerce:** Separate module from CMS — was combined

## Document Index

| #   | Document                           | Description                                                                                                                                                                                                                                                                                                                      |
| --- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01  | Platform Vision & Strategy         | Why Sparx exists, who it's for, how it competes                                                                                                                                                                                                                                                                                  |
| 02  | Architecture Overview              | System design, infrastructure, tech stack                                                                                                                                                                                                                                                                                        |
| 03  | Infrastructure & Deployment        | GKE, Terraform, CI/CD, environments                                                                                                                                                                                                                                                                                              |
| 04  | Domain & SSL Automation            | Subdomain provisioning, custom domains, cert management                                                                                                                                                                                                                                                                          |
| 05  | Data Model                         | Core entities, relationships, multi-tenancy                                                                                                                                                                                                                                                                                      |
| 06  | API Specification                  | REST + GraphQL, auth, versioning, webhooks                                                                                                                                                                                                                                                                                       |
| 07  | MCP Server Spec                    | AI integration for Claude, ChatGPT, Copilot                                                                                                                                                                                                                                                                                      |
| 08  | Site Builder Spec                  | Theme system, visual customizer, headless SDK                                                                                                                                                                                                                                                                                    |
| 09  | E-Commerce Engine PRD              | Products, orders, cart, checkout, payments                                                                                                                                                                                                                                                                                       |
| 10  | B2B & Wholesale PRD                | Accounts, pricing, quotes, net terms, fleet                                                                                                                                                                                                                                                                                      |
| 11  | CRM PRD                            | Contacts, pipeline, activity log, automation                                                                                                                                                                                                                                                                                     |
| 12  | CMS PRD                            | Content, media, SEO, blog, landing pages                                                                                                                                                                                                                                                                                         |
| 13  | Email Platform PRD                 | Postal infrastructure, automations, domain auth                                                                                                                                                                                                                                                                                  |
| 14  | Dropship Integration PRD           | Supplier connectors, catalog sync, order routing                                                                                                                                                                                                                                                                                 |
| 15  | Merchant Onboarding PRD            | Modules-first 6-step wizard (modules → template → workspace → domain → payments → launch); two-pane frame; live in < 5 min                                                                                                                                                                                                       |
| 16  | Multi-Tenancy & Security           | Isolation, Better Auth, RBAC, audit logs                                                                                                                                                                                                                                                                                         |
| 17  | Billing & Subscriptions            | Per-module pricing; two Stripe integrations (Subscriptions + Connect); 14-day trial → grace → suspend lifecycle                                                                                                                                                                                                                  |
| 18  | Frontend Architecture              | Next.js, design system, monorepo                                                                                                                                                                                                                                                                                                 |
| 19  | Testing Strategy                   | Unit, integration, E2E, load testing                                                                                                                                                                                                                                                                                             |
| 20  | Operational Runbook                | Monitoring, incidents, backup, restore                                                                                                                                                                                                                                                                                           |
| 21  | Cost & Scaling Guide               | Phased infrastructure, cost ceilings, upgrade triggers                                                                                                                                                                                                                                                                           |
| 22  | Typesense Search Specification     | Day-1 search index, schemas, sync workers                                                                                                                                                                                                                                                                                        |
| 23  | Frontend Component Architecture    | CVA + Shadcn + ModuleProvider, tokens, variants                                                                                                                                                                                                                                                                                  |
| 24  | Domain Purchase & Management       | GoDaddy Reseller integration, instant connect, lifecycle                                                                                                                                                                                                                                                                         |
| 25  | Monorepo Structure                 | pnpm workspaces + Turborepo layout, bootstrap order                                                                                                                                                                                                                                                                              |
| 26  | Domain Transfer Runbook            | GoDaddy → Cloudflare migration, ordered checklist, rollback paths                                                                                                                                                                                                                                                                |
| 27  | Customer Accounts & Site Auth      | Layer-2 shopper auth, tenant-scoped, Argon2id, account area                                                                                                                                                                                                                                                                      |
| 28  | Third-Party Inventory Sync         | Generic ERP/WMS mirror, source adapters, on-prem bridge, backlog                                                                                                                                                                                                                                                                 |
| 29  | Site Builder Architecture          | Theme/section engine, draft→publish→schedule, light/dark, boundaries                                                                                                                                                                                                                                                             |
| 30  | Site Builder Redesign              | One-screen editor, layout/template model, assignment, navigation flip                                                                                                                                                                                                                                                            |
| 32  | Workspace Switching & Breadcrumb   | Phased plan: module switcher + workspace switch/create, org-plugin risk                                                                                                                                                                                                                                                          |
| 33  | Token Model v2                     | Semantic palette + shape/rhythm/effects, brand-vs-presentation ownership                                                                                                                                                                                                                                                         |
| 34  | Platform Glossary & Concept Model  | Canonical terms; tenant → brand → site → modules; "site" overload                                                                                                                                                                                                                                                                |
| 35  | UI Variant System                  | Multi-axis color × variant × size recipe system for `@sparx/ui` components                                                                                                                                                                                                                                                       |
| 36  | Site Builder Layering Model        | Brand+Theme / SiteLayout / PageLayout tiers; template→layout; data-driven targets; assignment cascade                                                                                                                                                                                                                            |
| 37  | Site Builder Section System        | Landing-composition gaps + target model: multi-CTA, full-bleed media, Panels/Media+Text/Stats/Embed                                                                                                                                                                                                                              |
| 38  | Site Builder Extensible Sections   | Letting tenants add components: compose → saved blocks → declarative custom types → marketplace                                                                                                                                                                                                                                  |
| 39  | Universal Search                   | One `entities` Typesense collection + projector registry + generic `search.entity.changed` event                                                                                                                                                                                                                                 |
| 40  | Site Builder Composition Model     | Website = tree; Tier-1 primitives vs Tier-2 data-aware components; typed binding schema keystone                                                                                                                                                                                                                                 |
| 41  | Builder: Page Model & Persistence  | UI-first page editor node model, registry, canvas/inspector, persistence                                                                                                                                                                                                                                                         |
| 42  | Legal Documents & Cookie Consent   | Tenant legal pages, configurable cookie consent, platform legal acceptance gate                                                                                                                                                                                                                                                  |
| 43  | Builder: The Binding Schema        | Typed data-binding contract for builder nodes (single / scope / iterate cardinality)                                                                                                                                                                                                                                             |
| 44  | Builder: The Site Render Path      | Published node tree → production site markup (distinct from editor canvas)                                                                                                                                                                                                                                                       |
| 45  | Builder: The Site Layout Editor    | Site chrome/layout shell editor — header / footer / announcement / regions                                                                                                                                                                                                                                                       |
| 46  | `@sparx/site-ui` Component Library | Tenant-themed (`--st-*`) SSR-first site component library; four-axis recipe foundation                                                                                                                                                                                                                                           |
| 47  | Class-First Authoring Model        | Brand-governed component classes (Surface) + per-tenant `@apply`→CSS compile pipeline                                                                                                                                                                                                                                            |
| 48  | Product Markup, Surcharges & Fees  | _Planned._ Cost→price markup rules, parts matrix, invoice-line markup, configurable card-fee surcharge                                                                                                                                                                                                                           |
| 49  | Multi-Site per Tenant              | _Planned._ One tenant → many sites; `site_id` presentation scope vs. the multi-workspace axis                                                                                                                                                                                                                                    |
| 50  | SEO & AIO Discoverability          | Sitemap completeness, redirect enforcement, Builder-page SEO, AIO `llms.txt` + crawler policy + FAQ schema                                                                                                                                                                                                                       |
| 51  | Content Architecture               | Content (page-level schema) / Components / Templates / Pages; schema owned by content, authored in the builder; first-class content-type→template link replaces the `record_type` string                                                                                                                                         |
| 52  | Email Builder                      | Email as one self-contained node tree, same composition model, renderer, and publish lifecycle as pages                                                                                                                                                                                                                          |
| 53  | Builder Tenant Components          | User-authored components without a deploy; declarative, versioned, parameterized node-trees; system → Copy → tenant; publish-expands `custom:*` to primitives                                                                                                                                                                    |
| 54  | Tenant Blueprints                  | _Planned._ One-click marketplace templates that provision a whole tenant (brand/theme + content + commerce + pages + emails + components), draft → review → go live                                                                                                                                                              |
| 60  | Marketplace                        | _Planned._ Unified categorized add-on surface (Blueprints/Themes/Integrations/Components); category registry + home/browse/detail tiers + faceted Typesense search                                                                                                                                                               |
| 63  | External Data Connections          | _Planned — capstone._ Bind live external REST/GraphQL/SQL sources into Builder pages as native `ext.*` `DataSource`s; hardened SSRF proxy, declarative mapping, cached/SSR/live render modes                                                                                                                                     |
| 64  | Tier 2 Build Plan                  | Sequenced implementation plan for Domain Purchase, B2B/Wholesale, Dropship, and Inventory Sync — phased slices, build order, cross-cutting rules                                                                                                                                                                                 |
| 65  | Tier 1 Build Plan                  | Checkout & Payment (Stripe), Merchant Onboarding completion (Stripe OAuth + domain), MCP/AI module — phased slices and build order                                                                                                                                                                                               |
| 66  | Tier 3 Build Plan                  | Legal & Consent completion (slices 3b–8), Marketplace (all 4 categories), Universal Search Ph2, Product Markup & Surcharges — phased slices and build order                                                                                                                                                                      |
| 67  | Billing Build Plan                 | Stripe subscription engine, module activation/deactivation, trial lifecycle, Customer Portal, transaction fees, enterprise provisioning — final unlock before commercial launch                                                                                                                                                  |
| 56  | Live Chat Module                   | Built-in customer communication: site widget, AI-first responses (Claude Haiku + Typesense product context), merchant dashboard inbox, sparx.market integration. +$19/mo module.                                                                                                                                                 |
| 68  | Wizards, Import/Export & Bulk Ops  | Multi-step creation wizards (Product, B2B Account, Customer); CSV import/export with column mapping + row-level results; bulk operations bar (status, price, tags, delete) across all entities                                                                                                                                   |
| 69  | Tier 4 Build Plan                  | Live Chat module (Track A: DB/WebSocket/AI/widget/inbox/notifications) + Wizards/Import/Bulk (Track B: six phases); tracks are fully independent                                                                                                                                                                                 |
| 80  | Marketing Attribution & Analytics  | Two-level attribution (WizeWorks acquisition + tenant commerce) on one engine; UTM taxonomy, first-party consent-gated capture, cross-domain identity stitch, revenue models, MCP tools, phased build                                                                                                                            |
| 81  | Automation Module                  | _Planned._ One cross-module workflow engine; Locked/Managed/Custom tiers, mandatory gate layer, durable resumable runs, AI authoring; external Zapier/Make/n8n as complementary partners                                                                                                                                         |
| 82  | Event Bus Unification & Fan-In     | _Planned — docs/81 Phase 0._ Unify the divergent `EventType` registries into one canonical source + a single `automation.trigger` fan-in topic teed from all three publish paths                                                                                                                                                 |
| 83  | Tenant Attribution (L-TEN) Tracker | _Planned — docs/80 Phase 3._ Build tracker for tenant-level site attribution: capture in apps/site, 3 tables + columns on customers/orders, ingestion API, conversion stitching, reports, MCP                                                                                                                                    |
| 85  | Creator Marketplace                | _Planned — extends docs/60._ Third-party submissions (theme/component/blueprint/integration) as an allow-listed bundle compiled to a declarative artifact; GCS storage, scan/approve review, no-deploy runtime apply, feature-count price caps + payouts, deferred integration code sandbox; Sparx dogfoods it                   |
| 88  | Integrations Catalog & Taxonomy    | _Planned — hub._ The front door for integrations: the `purpose` × `shape` taxonomy (8 closed shapes), an index mapping every integration doc with build status, the code-vs-catalog reconciliation (`ProviderKind` vs phantom facets), the workflow-connector contract (docs/81 shape #4), and a prioritized named build catalog |
| 86  | Wizard Layout Pattern              | Two-pane wizard frame as a reusable pattern — full-page (onboarding) + modal (create-wizards) variants; one `WizardFrame` primitive, module-colored rail                                                                                                                                                                         |
