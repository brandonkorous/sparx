# sparx Platform — Tier 3 Build Plan

**Version:** 1.1
**Author:** Brandon Korous
**Last Updated:** 2026-06-10

---

## Overview

Tier 3 covers the platform polish work needed before real tenant signups: completing the legal & consent framework, fully building out the marketplace (all four categories), finishing Universal Search Phase 2, and implementing product markup & surcharges.

These are all largely independent of each other and can be built in parallel. Legal & Consent is the highest priority since it gates compliant signups. Marketplace and Universal Search are enhancement work. Product Markup is an important Commerce feature that directly serves Gillett Diesel.

**Build constraints (CLAUDE.md):** production-complete, event-driven side effects, module-gated where appropriate, RLS on all tenant tables, conventional commits, no Co-Authored-By.

> **Status snapshot (2026-06-10).** Most of Tier 3 has shipped — this plan predates several of those
> builds, so treat the per-feature notes below as authoritative over the original "Remaining" lines.
>
> - **Marketplace (Feature 2): DONE** except Typesense (scale-only). All four categories are live on
>   both surfaces; the marketplace was re-specced as the data-driven catalog in [docs/60](60-marketplace.md)
>   v0.3, which supersedes this section's phasing.
> - **Universal Search (Feature 3): DONE.** Ph1 + Ph2 projectors shipped and the scoped-key 501 is
>   fixed (`generateScopedSearchKey` in `@sparx/search`).
> - **Product Markup (Feature 4): Ph1, Ph2, and Surcharges (Ph2b) shipped.** Remaining: Ph3
>   (quote/invoice-line markup) and Ph4 (cost-change recompute worker + MCP tools).
> - **Legal & Consent (Feature 1): slices 3b–6 shipped** (seed worker, site consent UX,
>   dashboard surfaces, onboarding acceptance gate). Remaining: **Slice 7 (backfill existing tenants)**
>   and **Slice 8 (polish)**.

---

## Feature 1 — Legal & Consent Completion (docs/42)

**Spec:** [docs/42-legal-and-consent.md](42-legal-and-consent.md)
**Already shipped:** Slices 0 (design doc), 1 (foundations: 4 tables + RLS migrations, `LEGAL_TEMPLATES` catalog, `legalKind` on `content_entries`, `legal-versions` constant, `GET/PATCH /v1/tenant/consent`), 2 (public placements API, site footer fix, real legal pages replacing ComingSoon stubs on apps/web), 3a (public consent POST + config fanout into `/v1/public/tenants/:slug`), PageView fix.
**Remaining:** Slices 3b, 4, 5, 6, 7, 8.

### Slice 3b — Seed worker + Terraform

`tenant.created` Pub/Sub event is published by `signUpMerchant` but the consumer (seed worker) is not built.

New Cloud Run worker `services/legal-seed-worker/`:

- Subscribes to `tenant.created`
- Under the new tenant's RLS context (`withRequestTenant`), seeds one `content_entry` per `LEGAL_TEMPLATES` row (status: **draft**, `legalKind`, `legalTemplateVersion`, disclaimer set)
- Seeds `site_doc_placements` rows for footer placements
- Idempotent on `(tenantId, typeKey, slug)` unique constraint — safe to redeliver

Terraform additions:

- `google_pubsub_topic` for `tenant.created`
- `google_pubsub_subscription` pointing at the Cloud Run worker URL
- Add `legal-seed-worker` to cloud-run-worker TF module

### Slice 4 — Site consent UX

The banner/preference-center island that renders on tenant sites.

`apps/site/lib/consent.ts` — client registry:

- `getConsent()` — reads `sparx_consent_state` cookie
- `onConsentChange(cb)` — listens on `window` `CustomEvent('sparx:consent')`
- `gateTracker({ category, load })` — runs `load` when category is granted

SSR in `apps/site/app/layout.tsx`:

- Read consent cookie server-side (existing pattern: same as `sparx_theme` cookie)
- Pass `consentConfig` (from `/v1/public/tenants/:slug` — already in the payload) and `initialConsent` to the consent island

Consent island `apps/site/components/consent/consent-island.tsx` (React client component):

- **Off mode:** render nothing
- **Quiet notice:** persistent "Manage cookies" link in footer; opens preference center
- **GDPR banner:** Accept All / Reject All / Manage; non-essential trackers off until accept
- **CCPA banner:** "Do Not Sell or Share My Personal Information" persistent control

Preference center drawer: one toggle per non-essential category (`preferences`, `analytics`, `marketing`) with descriptions. "Save preferences" POSTs to `/v1/public/consent` → sets `sparx_consent_state` cookie client-side → dispatches `sparx:consent` event.

Before-paint script: inline script in `<head>` that reads `sparx_consent_state` before hydration and applies the current state — prevents tracker flash.

### Slice 5 — Dashboard surfaces

Three dashboard surfaces (none built yet):

**CMS → Legal checklist (`/cms/legal`):**

- Add `{ id: 'legal', label: 'Legal', href: '/cms/legal' }` to `cmsManifest.sections`
- Checklist view: one row per `LEGAL_TEMPLATES` entry, status (Complete / Missing / Stale / Unplaced), completeness ring
- "Create from template" → `POST /v1/legal/pages` → deep-link to CMS editor
- Placement manager panel: ordered/toggleable list of footer placements

**Settings → Cookie Consent:**

- Mode selector (off / gdpr / ccpa) with per-category toggles
- Preview of what the site banner will look like
- Saves via `PATCH /v1/tenant/consent`

**Onboarding progress step:**

- Non-blocking legal readiness indicator in the dashboard (not an onboarding wizard step — docs/15 §1 mandates no extra steps)

### Slice 6 — Onboarding acceptance gate

Single combined checkbox on the sign-up form: _"I agree to the sparx [Terms of Service], [Privacy Policy], and [Acceptable Use Policy]."_ Links open in new tabs.

Write `platform_legal_acceptance` rows (terms/privacy/aup) inside the existing `signUpMerchant` transaction, stamping `docVersion` from `legal-versions` constant and IP/UA from the server action.

`GET /v1/me/legal-status` — compares latest accepted version per docType against current constant; returns `{ stale: DocType[] }`.

`POST /v1/me/legal-accept` — records re-acceptance for a docType.

Re-acceptance banner on dashboard: if `GET /v1/me/legal-status` returns stale docs, show a non-blocking banner on next dashboard load. Only hard-gates if the version is flagged `material: true` in the constant.

### Slice 7 — Backfill existing tenants

**High-risk slice — schedule via DB Migrate workflow only.**

A migration that loops all existing tenants and seeds legal pages + placements under each tenant's RLS context. Must use the `set_config('app.tenant_id', ...)` pattern per tenant (see CLAUDE.md + `packages/db/CLAUDE.md` — `sparx_owner` is a non-superuser, sees zero rows without `set_config`).

Script structure:

```sql
DO $$
DECLARE t RECORD;
BEGIN
  FOR t IN SELECT id FROM tenants LOOP
    PERFORM set_config('app.tenant_id', t.id::text, true);
    -- seed content_entries + site_doc_placements per template
    -- idempotent ON CONFLICT DO NOTHING
  END LOOP;
END $$;
```

This is the heaviest migration slice — run against a staging clone first, confirm row counts, then apply via the DB Migrate workflow.

### Slice 8 — Polish

- Newer-template indicator in the Legal checklist (when `LEGAL_TEMPLATES` version > stored `legalTemplateVersion`)
- Disclaimer-ack badge: "Unreviewed starter text" badge until the tenant acknowledges the disclaimer in the CMS editor
- CCPA "Do Not Sell" footer link in quiet-notice mode

---

## Feature 2 — Marketplace Completion (docs/60)

**Spec:** [docs/60-marketplace.md](60-marketplace.md) — note the marketplace was re-specced as a
data-driven catalog in docs/60 v0.2/v0.3, which supersedes the phasing below; statuses here reflect
that build.
**Shipped (2026-06-10):** the data-driven catalog spine (4 per-category tables + publisher model +
RLS), the generic `[category]` dashboard shell, and **all four categories live on both surfaces** —
Blueprints (install/go-live), Themes (Apply → active-site theme), Integrations (Connect →
`/commerce/providers`), Components (Add → `/builder/components`). The **public marketplace** is live at
`sparx.works/market` with the sign-up funnel hand-off. Catalog seeded in prod.
**Remaining:** only **Typesense-backed search** (Phase 4 below) — scale-only; the SQL adapter is the
documented fallback until listing volume warrants an index.

### Phase 1 — Themes category

The Themes catalog pulls from the tenant's available saved themes + system-provided themes. A "theme" in this context is a set of design tokens (from docs/33 / docs/45 / docs/36 — the Brand & Theme model).

Theme catalog adapter for `/marketplace/themes`:

- List: system themes (curated registry in `@sparx/ui`) + tenant-saved themes
- Facets: Style/mood (minimal, bold, editorial, playful), Color family, Layout density, Industry
- Detail page: live preview using the Builder's theme preview mechanism, "Apply" CTA

"Apply" a theme: updates `savedThemeService` / `SiteTheme` for the tenant's active site — same flow as the existing Brand & Theme editor in `/builder/_brand`. Shows a confirmation dialog naming the active site.

Install count + rating: stub with static data for system themes until telemetry exists (docs/60 §12 open question — defer real data).

### Phase 2 — Components category

The Components catalog exposes the system/shared component registry (docs/53 — `@sparx/blueprints` + system catalog).

Component catalog adapter for `/marketplace/components`:

- List: system components + any shared/tenant-published components
- Facets: Kind (section/block/widget), Source (system/shared), Module affinity (commerce/cms/crm/…)
- Detail page: component preview screenshot, what's included, props schema, "Add to workspace" CTA

"Add to workspace": runs the existing tenant component install flow from docs/53 — creates a `tenant_component_versions` row from the system component definition.

### Phase 3 — Integrations category

The Integrations catalog pulls from the integration registry (the existing `integrations` / `provider_catalog` data model used by the integration-published-docs bridge).

Integration catalog adapter for `/marketplace/integrations`:

- List: all registered integrations (payment providers, shipping providers, tax providers, marketing tools, accounting)
- Facets: Type (payments/shipping/tax/accounting/marketing), Provider, Pricing (free/paid)
- Detail page: description, features list, setup requirements, "Connect" CTA

"Connect" CTA routes to the existing Settings → Integrations flow for that provider. The marketplace is discovery; the settings page is configuration.

Mark integrations without a live connect flow as `status: coming-soon` (same pattern as categories) — they appear in search but the CTA is disabled.

### Phase 4 — Typesense-backed search + facets

A `marketplace` Typesense collection (or add `category` facet to the existing `entities` collection — see docs/39 Universal Search for the single-collection precedent).

Schema for marketplace items:

```
id, category, name, slug, tagline, tags[], facets{} (category-specific), install_count, created_at
```

Projector in `services/typesense-worker/` for each live category:

- Blueprints projector: syncs the blueprints registry → `marketplace` collection
- Themes projector: system themes registry
- Components projector: system components registry
- Integrations projector: integration registry

The category browse page switches from in-memory filter/sort to Typesense queries for full-text + facet counts + pagination. In-memory adapter stays as the dev/no-index fallback.

### Phase 5 — Public pre-auth funnel

`apps/web` public marketplace browse surface (no auth required):

- Route: `sparx.works/marketplace`
- Same three-tier IA (home / category / detail) but no install CTAs — replaced with "Sign up to install" + sign-up modal
- Reuses the same category adapters via a no-auth catalog read (public endpoint strips per-tenant overlay: no installed/applied state)
- SEO: static metadata per category + item; sitemap entries

---

## Feature 3 — Universal Search Phase 2 (docs/39)

**Spec:** [docs/39-universal-search.md](39-universal-search.md)
**Already shipped (Ph1):** `entities` Typesense collection, projector registry, `search.entity.changed` event, 5 projectors (products, customers, orders, CMS entries, collections), `/v1/search/all` endpoint, ⌘K command palette in dashboard.
**Remaining (Ph2):** Write-sites projector, CMS projectors (additional content types), scoped-key 501 fix.

### Phase 1 — Write-sites projector

Add a `sites` projector to the `entities` collection:

- Entity type: `site`
- Fields: `id`, `tenantId`, `title` (site name), `slug`, `type: 'site'`, `url`, `status`, `updatedAt`
- Triggers: `site.created`, `site.updated`, `site.deleted` events → publish `search.entity.changed`
- Dashboard ⌘K result: shows site name + URL, navigates to `/builder/site/{id}`

### Phase 2 — Additional CMS projectors

The existing CMS projector handles `content_entries` of type `page`. Extend to cover:

- **Blog posts** (`type: post`) — title, excerpt, author, published_at, tags
- **Templates** (`type: template`) — title, template kind
- **Components** (`type: component`) — title, component kind
- **Media assets** — filename, alt_text, mime_type (for `/v1/media` search hits in ⌘K)

Each new entity type gets a card in the ⌘K result list with an appropriate icon and navigate-to URL.

### Phase 3 — Scoped-key 501 fix

The Typesense scoped-key generation (per-tenant search isolation) currently returns 501 Not Implemented. Implement `generateScopedSearchKey(tenantId)` in `services/typesense-worker/` or `@sparx/search` using the Typesense Node.js client's `generateScopedSearchKey()` method with a filter_by `tenantId:{tenantId}` embedded.

The site's public search (`/v1/public/search`) uses this scoped key — fix unblocks site product search from being truly tenant-isolated.

---

## Feature 4 — Product Markup & Surcharges (docs/48)

**Spec:** [docs/48-product-markup-pricing.md](48-product-markup-pricing.md)
**Status:** Design doc only. The `product_variants.cost` field already exists. Builds on B2B pricing (Tier 2 B2B Phase 1) and dropship imports (Tier 2 Dropship Phase 2).
**Module flag:** `commerce`

### Phase 1 — Catalog markup rules (percentage, multiplier, flat, margin_target)

DB migration — new tables (RLS ENABLE + FORCE):

- `markup_rules` (full schema per docs/48 §7 — all fields except `bands` JSONB for matrix)
- Add to `product_variants`: `markup_rule_id UUID REFERENCES markup_rules(id)`, `applied_markup JSONB`

`applyMarkupRule(cost, rule)` — pure function in `@sparx/commerce` package. Applies method, rounding, floor, ceiling. Returns `{ price, margin, appliedRule }`.

API:

- `GET/POST /v1/markup-rules` — list + create
- `GET/PATCH/DELETE /v1/markup-rules/:id`
- `POST /v1/markup-rules/:id/preview` — dry-run: returns before/after price + margin for all scoped variants, no writes
- `POST /v1/markup-rules/:id/apply` — bind + recompute all scoped variants (publishes `price.recomputed` events per variant, processed async)

Product/variant editor: "Price by rule" toggle. When enabled, shows the computed price + margin readout (live, from `applyMarkupRule`). When disabled, manual price field.

### Phase 2 — Cost-band matrix + bulk pricing tool

Add `method: 'matrix'` support to `markup_rules` — the `bands` JSONB column is already in the schema. `applyMarkupRule` handles matrix by finding the matching band.

Bulk pricing tool in the dashboard (`/commerce/products/pricing`):

- Select scope: collection, product type, vendor, or all products
- Pick a rule
- **Preview table**: side-by-side before/after price + margin for every matching variant (paginated)
- "Apply" button — calls `POST /v1/markup-rules/:id/apply` for the selected scope
- Dry-run is mandatory before apply — the Apply button is disabled until preview has been viewed

Generalize the dropship import's existing pricing-rule step to use the new `markup_rules` entity instead of a one-off config.

### Phase 2b — Surcharges (credit-card fee pass-through)

Independent of markup phases — can ship alongside Phase 1 or 2.

DB migration — new table `surcharge_rules` (full schema per docs/48 §7 — RLS ENABLE + FORCE).

Add to `orders`: `surcharge_total NUMERIC(12,2) DEFAULT 0`, `applied_surcharges JSONB`.

Surcharge computation at checkout (in `POST /v1/checkout/sessions/:id/complete`): after tax, query active `surcharge_rules` for the tenant, filter by payment method, compute and snapshot. Show as a line item on the checkout confirmation step ("Card processing fee — 3%").

API:

- `GET/POST/PATCH/DELETE /v1/surcharge-rules`

Dashboard Settings → Payments: Surcharge configuration panel (on/off toggle, percentage/flat, payment methods, label, cap). Compliance notice displayed inline: "Credit-card surcharging laws vary by state. Review the legal requirements for your jurisdiction before enabling."

Refund proration: when `POST /v1/orders/:id/refunds` is called, reverse the surcharge proportionally from `applied_surcharges`.

### Phase 3 — Invoice/quote-line markup + snapshot

**Depends on:** Tier 2 B2B Phase 2 (quotes) and B2B Phase 3 (invoices) being done.

Extend `b2b_quote_items` and order lines to carry `cost` + `applied_markup JSONB` snapshot.

On a B2B quote, each line can switch between "catalog price" and "price by markup" — entering a cost + selecting a rule (including the matrix) computes the charged price. The computed price and the full markup snapshot (rule id, method, value, cost used, computed_price, computed_at) are stored on the line at save time, making the document reproducible forever.

Manual lines (not catalog products): user enters a cost, picks a rule → price computed. Used for labor, freight, sublet, shop materials.

### Phase 4 — Cost-change recompute worker

Event-driven price recomputation when costs change.

New `variant.cost.updated` event published whenever `product_variants.cost` changes (via API PATCH or bulk import).

Cloud Run worker `services/markup-recompute-worker/`:

- Subscribes to `variant.cost.updated` and `dropship.cost.synced`
- For each event: find variants bound to a markup rule whose `cost_basis` matches the changed field
- Recompute list price with `applyMarkupRule`
- Auto-apply if new price is within a configurable tolerance band (default ±10%)
- Queue for merchant review if outside tolerance → dashboard notification

MCP tools (docs/48 §9 / docs/07):

- `preview_markup({ ruleId, scope })` — dry-run, returns before/after for scope
- `apply_markup({ ruleId, scope })` — write scope, requires confirmation
- `get_margin({ variantId })` — current cost/price/margin breakdown
- `set_surcharge({ type, value, paymentMethods })` — write scope, requires confirmation

---

## Build order summary

| #   | Feature          | Phase                                  | Notes                               |
| --- | ---------------- | -------------------------------------- | ----------------------------------- |
| 1   | Legal & Consent  | Slice 3b seed worker + TF              | Unblocked                           |
| 2   | Legal & Consent  | Slice 4 site consent UX                | After 3b                            |
| 3   | Legal & Consent  | Slice 5 dashboard surfaces             | After 3b                            |
| 4   | Legal & Consent  | Slice 6 onboarding acceptance gate     | Unblocked (can go first)            |
| 5   | Product Markup   | Ph1 Catalog markup rules               | Unblocked                           |
| 6   | Product Markup   | Ph 2b Surcharges                       | After Checkout (Tier 1)             |
| 7   | Universal Search | Ph1 Write-sites projector              | Unblocked                           |
| 8   | Universal Search | Ph2 Additional CMS projectors          | After Ph1                           |
| 9   | Universal Search | Ph3 Scoped-key 501 fix                 | Unblocked                           |
| 10  | Marketplace      | Ph1 Themes category                    | Unblocked                           |
| 11  | Marketplace      | Ph2 Components category                | Unblocked                           |
| 12  | Marketplace      | Ph3 Integrations category              | Unblocked                           |
| 13  | Product Markup   | Ph2 Matrix + bulk pricing tool         | After Ph1                           |
| 14  | Product Markup   | Ph3 Invoice/quote-line markup          | After Tier 2 B2B Ph2–3              |
| 15  | Marketplace      | Ph4 Typesense search + facets          | After Universal Search Ph1          |
| 16  | Legal & Consent  | Slice 7 backfill (DB Migrate workflow) | After Slice 3b; scheduled carefully |
| 17  | Product Markup   | Ph4 Recompute worker + MCP tools       | After Ph1; MCP after Tier 1 MCP Ph3 |
| 18  | Legal & Consent  | Slice 8 polish                         | After Slice 5                       |
| 19  | Marketplace      | Ph5 Public pre-auth funnel             | After Ph3                           |
