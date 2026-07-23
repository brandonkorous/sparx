# 135 — GraphQL ↔ REST Parity Audit & Backlog

Version: 1.1
Author: Brandon Korous
Last Updated: 2026-07-22

> **Status (2026-07-22): documented, build deferred.** The decisions in §9 are made — **Pothos**
> code-first, and the parity build is **sequenced to ride along with the future REST DDD split**, not
> undertaken now. Rationale: the split reorganizes `api-rest`'s routes around domain boundaries and
> the `@sparx/<domain>` services; GraphQL resolvers wrap those _same_ services, so building both
> together lands the thin resolvers once instead of twice. This doc is the standing backlog to execute
> at that time. See §8.

## Purpose

`api-graphql` was scoped from an early draft of [docs/06-api-specification.md](06-api-specification.md) §10
and has not tracked the growth of `api-rest`. The decision recorded here is that **GraphQL is a
first-class alternate to the REST API**, not a narrow read slice — so the target is full parity on
the queryable/manageable surface. This document is the endpoint-level audit and the concrete backlog
to close the gap.

Source of truth: a full sweep of `services/api-rest/src/routes/**` (250 route files) and the entire
`services/api-graphql/src` surface, performed 2026-07-22.

---

## 1. Verdict

**Not aligned.** GraphQL implements **2 of ~27** authenticated domains.

- **~1,030** authenticated (staff/admin) REST endpoints exist across ~27 domains.
- GraphQL covers **CRM in full** (60 REST endpoints → 20 queries / 29 mutations) and **CMS content
  partially** (~13 of 22).
- Effective parity: **~7%**.
- **No `Subscription` type exists** — the real-time surface the spec called for (`orderCreated`,
  `orderUpdated`, `inventoryUpdated`) was never built.
- Separately, GraphQL has **drifted from its own spec**: [docs/06](06-api-specification.md) §10 lists
  `products`, `orders`, `customers`, `analytics` + subscriptions. Of those, only `customers` (as CRM)
  exists; `products`, `orders`, `analytics`, and all subscriptions are absent, while CMS content —
  which the spec's GraphQL overview never mentioned — was added instead.

## 2. Why this is tractable (the important finding)

REST routes are **thin**. Every domain route delegates to service objects in a reusable
`@sparx/<domain>` package — e.g. `commerce/carts.ts` imports `cartService`, `checkoutService` from
`@sparx/commerce`; the CRM GraphQL resolvers already wrap `@sparx/crm`'s `customerService`,
`dealService`, etc. Domain-logic packages exist for nearly every domain (commerce, inventory, crm,
cms, billing, dropship, scheduling, automation, builder, channels, email, forms, media, payments,
search).

**Consequence:** closing parity is _write SDL + thin resolvers over the existing service tier_, not
re-implementing business logic. The pattern is already proven twice (CRM thin, CMS inline). The work
is high-volume and mechanical, not deep — which is exactly why it should be generated, not
hand-written (§6).

---

## 3. Current GraphQL surface (what is DONE)

Single Mercurius instance at `POST /v1/graphql`, hand-written SDL, auth via `@sparx/api-core/auth`.

### CMS content — 🟡 partial (6 queries / 5 mutations)

`contentTypes`, `contentType`, `entries`, `entry`, `entryBySlug`, `revisions` ·
`createEntry`, `updateEntry`, `publishEntry`, `unpublishEntry`, `deleteEntry`.
Missing vs REST content surface: preview-token issue/revoke, content reports (summary/cadence/recent),
content-analytics (top-content), revision _restore_, content-type schema authoring (`PUT …/schema`).
Resolvers here **inline** their logic (don't wrap a single service fn).

### CRM — ✅ full (20 queries / 29 mutations)

Customers, B2B accounts, pipelines, stages, deals, deal forecast, deal↔order/quote attachments,
activities, tasks (+overdue/today), segments (+members/preview/recompute), reports (snapshot, funnel,
win-loss, acquisition). Resolvers are genuinely thin over `@sparx/crm`.
**Quality gap:** every CRM mutation takes an opaque `JSON!` input — the SDL doesn't type the payloads.

---

## 4. Coverage math

| Bucket             | Domains                                                      | REST endpoints | GraphQL  |
| ------------------ | ------------------------------------------------------------ | -------------: | -------- |
| Covered            | CRM                                                          |             60 | ✅ full  |
| Partial            | CMS content                                                  |             22 | 🟡 ~13   |
| **Missing**        | 25 domains (below)                                           |       **~950** | ❌ none  |
| Excluded by design | webhooks, byte/render, OAuth, dev, public storefront runtime |           ~230 | n/a (§7) |

---

## 5. Parity backlog (missing domains, by priority)

Priority = how central the domain's _entities_ are to "an alternate to the REST data API." Each row
is a resolver package to build (SDL + thin resolvers over the named `@sparx/*` service). Endpoint
counts are the REST surface being mirrored; the GraphQL field count will be lower (reports collapse to
queries, bulk/lifecycle actions to mutations).

### Tier 1 — core commerce/ops data (defines "alternate to REST")

| Domain           | REST | Service pkg             | Entities → GraphQL                                                                                                                                                                                                                                                                                                   |
| ---------------- | ---: | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Commerce catalog | ~232 | `@sparx/commerce`       | products, variants, options, images, translations, categories, collections, price-lists, discounts, gift-cards, account-credit, markup/surcharge rules, shipping/tax zones+rates, providers, returns, subscriptions, reviews, Q&A, wishlists, fitment, bundles, configurators, storefront settings, commerce reports |
| Orders           |   18 | `@sparx/commerce`       | orders, payments, fulfillments, shipping labels/tracking, refunds                                                                                                                                                                                                                                                    |
| Inventory        |  104 | `@sparx/inventory`      | levels, locations, sources, lots/serials/recalls, suppliers, purchase-orders, receipts, reorder, counts, transfers, movements, sync/agent, reports                                                                                                                                                                   |
| B2B              |   40 | `@sparx/commerce` (b2b) | accounts, fleets, overrides, pricing-tiers, price resolution, quotes, AR invoices, approval rules/queue, holds, reports                                                                                                                                                                                              |
| Invoicing        |   45 | `@sparx/billing`        | documents (+lines/snapshots/payments/convert), workflows+stages, line-types, templates, aging, reports                                                                                                                                                                                                               |
| Scheduling       |   57 | `@sparx/scheduling`     | services, resources, availability, bookings (+lifecycle), policies, calendar connections, series, waitlist, classes/attendees, reports                                                                                                                                                                               |

### Tier 2 — content, marketing, site

| Domain                                   | REST | Service pkg                 | Notes                                                                                                                                                                                         |
| ---------------------------------------- | ---: | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Builder                                  |   72 | `@sparx/builder`            | pages, layouts, silica site, components/symbols, archetypes, emails, governance, analytics. Op-log autosave (`PUT /site`) is REST-shaped — expose reads + publish/release/restore as GraphQL. |
| Site (sitebuilder)                       |   67 | `@sparx/sitebuilder`        | layout slots, sections, assignments, page-layouts, definitions, themes, saved-themes, publish/rollback/schedule, blueprints, navigation, presets, brand                                       |
| Email                                    |   25 | `@sparx/email*`             | settings, domains, suppressions, broadcasts (+send/schedule/cancel), analytics                                                                                                                |
| Content (finish)                         |    9 | `@sparx/cms`                | preview-tokens, reports, content-analytics, revision restore, schema authoring                                                                                                                |
| SEO                                      |   15 | `@sparx/seo-audit`          | audit/audits, reports, organic (search-console reads). OAuth exchange stays REST (§7).                                                                                                        |
| Automation                               |   15 | `@sparx/automation`         | automations, versions/publish/restore, runs, reports                                                                                                                                          |
| Media                                    |    8 | `@sparx/media`              | assets read/patch/delete + reports. Upload presign/complete stays REST (§7).                                                                                                                  |
| Authors / Redirects / Forms / Taxonomies |   24 | cms / seo / forms           | straightforward CRUD                                                                                                                                                                          |
| Channels / Market                        |   16 | `@sparx/channels`           | connections, mappings, merchant profile/products/settlement. OAuth callback stays REST.                                                                                                       |
| Dropship                                 |   22 | `@sparx/dropship`           | suppliers, catalog import, products, order routing, analytics/reports                                                                                                                         |
| Finance                                  |    8 | `@sparx/commerce`/`billing` | payments/payouts/receivables/channels ledgers (read-only)                                                                                                                                     |

### Tier 3 — platform, tenant, AI, misc

| Domain        | REST | Notes                                                                                                                                                                                |
| ------------- | ---: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tenant-admin  |   56 | tenant, business, modules, onboarding, team, members/invites, properties, domains, `me/*`, brand                                                                                     |
| AI            |   44 | ai reports, prompt-templates, tool-policies, api-keys, credentials, mcp-connections; chat conversations/analytics/quick-replies/settings; analytics dashboards/query; dashboard home |
| Platform      |   43 | component catalog, saved-views, partner practice + bootcamps, webhook _subscriptions_ (webhook _ingress_ excluded)                                                                   |
| Misc          |   30 | legal, feedback, jobs, activity/audit, sample-data, industry-starters, universal search                                                                                              |
| Notifications |    7 | inbox, read, preferences, push subscriptions                                                                                                                                         |

**Tier totals:** T1 ≈ 496 · T2 ≈ 316 · T3 ≈ 180 (≈ 950 missing endpoints).

---

## 6. Build approach

1. **Generate, don't hand-write. — DECIDED: Pothos.** The drift happened because SDL is
   hand-maintained. Move to **Pothos** code-first (already the intent in
   [docs/02](02-architecture-overview.md) §"GraphQL API (Pothos + Mercurius)"). Define types once;
   Pothos emits the SDL. A CI check fails the build if the committed SDL doesn't match the generated
   one, so REST and GraphQL can't silently diverge again. The existing hand-written CMS + CRM SDL is
   rewritten as Pothos type/field builders during the migration (§8) — no new hand-SDL is added in the
   meantime.
2. **Resolvers stay thin over `@sparx/*` services** — the CRM pattern. No business logic in resolvers.
   Where a REST route currently inlines logic (CMS content, and a few commerce routes), extract to the
   service package first so both surfaces share one code path.
3. **Type the inputs.** Replace the CRM `JSON!` inputs with real input types derived from the
   `*-schemas` Zod packages (`@sparx/crm-schemas`, `@sparx/commerce-schemas`, …). A Zod→GraphQL-input
   generator keeps them in lockstep with REST validation.
4. **Subscriptions.** Stand up the missing real-time surface over the existing Pub/Sub event catalog
   (`order.placed`/`order.paid`, `inventory.*`, `booking.*`, …) via `mercurius` subscriptions — the
   events already exist; only the GraphQL transport is missing.
5. **Auth/tenancy/audit are already shared** via `@sparx/api-core` (`requireRole`, `withRequestTenant`,
   `writeAudit`, `publish`, module gates). Reuse verbatim — no parallel implementation.

## 7. What stays REST-only (honest scope of "parity")

These are not GraphQL-shaped; excluding them is deliberate, not a gap:

- **Inbound webhooks / signature-authed ingress:** Mailgun, Stripe (sparx-pay, direct, billing),
  provider/channel/calendar-push webhooks.
- **OAuth handshakes & redirects:** channels callback, search-console exchange, Stripe Connect
  onboarding, calendar OAuth, the Better Auth mount + `.well-known`.
- **Byte / document rendering:** media serving & upload presign, form/CSV export (`/v1/export/*`),
  `sitemap.xml`/`rss.xml`, invoice/PO **PDF & print-HTML**, email preview HTML, `.ics` feeds.
- **Short-lived token minting:** preview-token / calendar-token JWT issuance.
- **Public storefront runtime (~170 routes):** cart, checkout, shopper account, b2b-portal, guest
  booking, reviews/Q&A submit, consent, chat widget. These belong to the **shopper session**, not the
  staff admin surface. If a headless-storefront GraphQL is ever wanted, it is a **separate** schema
  with shopper-session auth — out of scope for this admin-parity effort.
- **Dev-only routes** (local media receiver, etc.).

## 8. Rollout — sequenced with the REST DDD split

**This work is not undertaken standalone.** It executes as part of the planned **REST DDD
restructure** of `api-rest`. That split reorganizes routes around domain boundaries and hardens the
`@sparx/<domain>` service tier; because GraphQL resolvers are thin wrappers over that _same_ tier,
each domain gets its Pothos resolver module built **in the same pass** that carves out its REST
domain module — the thin-wrapper work is done once, not twice, and both surfaces are guaranteed to
share one code path per domain.

Within that effort, ship **domain-by-domain behind the Pothos generator**, each domain a
self-contained resolver module merged into the schema (the current `extend type Query/Mutation`
compose pattern already supports this). Order follows the DDD split's own domain sequence; where that
is open, prefer **T1 first** (commerce → orders → inventory → b2b → invoicing → scheduling), then
finish **CMS content** and roll **T2**, then **T3**. **Subscriptions** land alongside
commerce/inventory/scheduling (where the events matter most). No big-bang cutover — REST stays the
system of record throughout; GraphQL is additive.

**Until the split begins:** the current CMS + CRM GraphQL surface stays live and maintained, but no
new hand-written SDL domains are added — new domains wait for the Pothos foundation so we don't create
more drift to migrate later.

## 9. Decisions

1. **Approach — DECIDED: Pothos** code-first, SDL generated + CI drift-check. Chosen 2026-07-22.
2. **Timing — DECIDED: couple to the REST DDD split.** Not built standalone; the parity build rides
   along with the DDD restructure (§8). This doc is the standing backlog for that time. Chosen
   2026-07-22.
3. **Scope of parity — OPEN, decide at split time.** Full ~1,030-endpoint parity vs. a defined "core"
   line. The tiers in §5 make this a dial; everything in §7 is excluded regardless. Deferred to when
   the domain sequence of the DDD split is set.
4. **Subscriptions — OPEN, leaning yes.** Recommendation stands: in scope but scoped to
   commerce/inventory/scheduling events, not every event type. Revisit at split time.
5. **Typed inputs — OPEN, leaning yes.** Retrofit CRM's opaque `JSON!` inputs into typed inputs
   derived from the `*-schemas` Zod packages as part of the Pothos migration. Revisit at split time.

### Prerequisite when this is picked up

- Confirm the REST DDD split has a written plan/doc; link it here and align the domain sequence (§8).
- Two REST hygiene items surfaced by this audit, worth folding into the split: `partner/bootcamps.ts`
  hard-codes a `/v1/partner` prefix but is **not registered** in `partner/index.ts` (confirm it's
  mounted); and the doc-comment headers on `builder/site.ts` and `sitebuilder/publish.ts` are **stale**
  (several live routes aren't listed — this audit read the real `app.<method>` registrations).
