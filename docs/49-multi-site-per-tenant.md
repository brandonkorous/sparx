# Sparx Platform — Multi-Site per Tenant

**Version:** 1.0 (Phases 1–4 built)
**Author:** Brandon Korous
**Last Updated:** 2026-06-04

> **Status: BUILT — Phases 1–4 shipped (2026-06-04); Phase 5 foundation-laid, enforcement deferred.**
> One tenant can run **more than one website** (e.g. a main brand site + a campaign microsite, a
> wholesale site and a retail site over the same catalog, a publisher with several publications).
>
> **Implementation naming:** the entity ships as **`Property`** (table `properties`), NOT `Site` —
> `Site*` collides with the legacy sitebuilder `SiteConfig`/`SiteVersion`/`SiteTheme` tables, and
> "Property" reads as broader than a store (content-or-commerce). User-facing copy says **"Site"**;
> the code identifier is `Property`/`property_id`. Read `Site` ≙ `Property` throughout this doc.
>
> **Scope note vs. doc 32.** This re-key was applied **Builder-only** (go-forward render path:
> `builder_pages`/`builder_layouts`/`builder_page_assignments` gained `property_id`). The legacy
> `sitebuilder_*` layer (`SiteConfig.tenantId @id`, …) was **left single-site** since it is
> retiring — it is NOT re-keyed. This still directly revisits doc 32 §2's "no `Site` model" — that
> decision was about a _different axis_ (multiple workspaces a user belongs to); the `Property`
> entity lives _inside_ a tenant and the two don't conflict (§2).
>
> **What's built:** `properties` + `domains` tables (+ RLS/partial-unique/host-resolution);
> per-property Builder render path; host→property routing + Caddy authorization; create-site /
> make-primary APIs; the dashboard **Sites** settings hub + in-builder site switcher; BYO custom
> domain connect + DNS-TXT verify; per-site **brand override** (`Property.brand_override`, Phase 4).
> **Deferred (Phase 5):** Model B catalog/content `property_id` scoping (additive, enforcement
> deferred per §3), per-site module scope, the site-scoped search facet. See §10.

---

## 1. Why

Today a tenant has exactly one website. The whole site-authoring layer encodes that literally:
`SiteConfig`'s primary key **is** `tenant_id`, and every sibling table is uniquely keyed
`(tenant_id, …)` — `SiteVersion`, `PageLayout`, `SiteLayoutBlock`, `SiteTheme`,
`SiteLayoutDefault`, `SiteLayoutAssignment`, `TenantSectionDefinition`, plus the Builder
(`BuilderPage`, `BuilderLayout`) and the commerce-owned `StorefrontSettings`/`StorefrontTheme`
(all `Tenant @relation` one-to-one or one-per-tenant). Domain resolution maps a hostname to a
**tenant**, and that tenant has one site to render.

Real tenants outgrow one site:

- **Multiple brands, one back office** — a company runs two storefronts with different names,
  themes, and domains but one catalog, one customer list, one set of orders and one bill.
- **Microsites / campaign sites** — a separate landing site for a product launch or event, on
  its own domain, that should not clutter the main site's page tree.
- **Wholesale vs. retail** — a B2B site and a D2C site over the same products with different
  presentation and pricing visibility ([10-b2b-wholesale-prd.md](10-b2b-wholesale-prd.md)).
- **Multi-publication content** — a CMS-only tenant ([12-cms-prd.md](12-cms-prd.md)) running
  several publications with distinct themes and navigation from one editorial back end.
- **Agencies** — one account managing several client-facing sites without making each a fully
  separate, separately-billed workspace.

Each of those wants **a second site that shares the back office**, not a second tenant.

---

## 2. Two axes — this is NOT multi-workspace (read first)

Sparx has two orthogonal "more than one" needs. Conflating them is the trap doc 32 §2 was
guarding against. They are different and both legitimate:

| Axis                         | "One **_ has many _**"          | Isolation boundary                                               | Shares                                                            | Mechanism                                                             |
| ---------------------------- | ------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| **Multi-workspace** (doc 32) | one **user** → many **tenants** | **Hard** — separate RLS `tenant_id`, separate org, separate bill | nothing (each tenant is its own world)                            | Better Auth org membership + active-org switch                        |
| **Multi-site** (this doc)    | one **tenant** → many **sites** | **None between sites** — same `tenant_id`, same RLS, same bill   | back office (catalog, customers, orders, staff, billing) — see §3 | a new `Site` sub-entity + a `site_id` scope on the presentation layer |

So:

- **One Better Auth org still maps 1:1 to one tenant** (CLAUDE.md is unchanged). A `Site` is a
  child of a tenant, not a new org.
- **RLS is unchanged.** `tenant_id` remains the only security boundary. `site_id` is an
  _application-tier scoping_ column within a tenant, **not** a security boundary — two sites in
  the same tenant can read each other's rows as far as Postgres is concerned; the app scopes by
  `site_id`. (Anyone needing hard isolation between two sites should use two **workspaces**, not
  two sites. State this loudly in the UI.)

> Doc 32 §2's "no Site model" was the right call **for the workspace switcher** — it kept
> workspace == tenant == org clean. This doc adds a Site model _below_ the tenant for the
> presentation axis, which doesn't disturb that mapping. [32](32-workspace-switching-breadcrumb.md)
> §2 and [34-platform-glossary.md](34-platform-glossary.md) need a note pointing at this doc when
> it lands (§9).

---

## 3. The central question: what's shared vs. per-site

Introducing `Site` forces one decision per category of data: does it live at the **tenant** level
(shared by all sites) or the **site** level (one per site)? There's a spectrum of ambition:

**Model A — Presentation-only multi-site (recommended starting point).**
A site is a distinct **presentation + domain + page tree** over the _same shared back office_.
Per-site: theme/brand presentation, layouts, page/section composition, navigation, domain,
storefront settings (currency, policies), appearance policy. Shared (tenant-wide): catalog &
products, CRM customers, orders, inventory, pricing, billing/subscription, staff users,
search index. This is the **smallest structural change** and covers multi-brand / microsite /
multi-publication out of the box. Recommended first, per the platform's "deploy small" discipline.

**Model B — Scoped multi-site (opt-in, later).**
Add the ability to scope a _subset_ of shared data to a site: which collections/products a site
exposes, which content types/entries publish to which site, per-site pricing visibility. Mechanism:
a nullable `site_id` (or a site↔entity join) on the relevant catalog/content rows, where `null`
means "all sites." Lets the wholesale and retail sites show different slices of one catalog.

**Model C — Fully isolated sites.**
Separate customers, separate orders, separate everything per site. **This is just
multi-workspace** (doc 32) — do not build it as multi-site. If a tenant needs full isolation,
they create a second workspace.

Recommendation: **ship Model A, design the schema so Model B is additive** (nullable `site_id`
scoping is forward-compatible), and explicitly route Model C to workspaces.

### Brand is the hard sub-question

[34-platform-glossary.md](34-platform-glossary.md) and
[33-token-model-v2.md](33-token-model-v2.md) say **brand is a tenant primitive, "read by every
surface, overridable by none."** Multi-brand multi-site breaks that by definition — two sites with
different identities need different brands. Resolution: keep `TenantBrand` as the **default**, and
allow an **optional per-site brand override** (`SiteBrand?`) that a site reads in preference to the
tenant brand. This is a genuine amendment to the doc-34 rule and must be made deliberately, not
silently — it is the single biggest conceptual change here.

---

## 4. Data model sketch

A new `Site` entity, and a re-key of the presentation layer from `(tenant, …)` to `(site, …)`.

```sql
CREATE TABLE sites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  slug          VARCHAR(63) NOT NULL,     -- stable per-tenant handle
  name          VARCHAR(255) NOT NULL,
  is_primary    BOOLEAN NOT NULL DEFAULT false, -- exactly one per tenant
  status        VARCHAR(20) NOT NULL DEFAULT 'active', -- active | paused | archived
  -- which tenant-enabled modules this site exposes (subset of the tenant's set);
  -- null/empty = all enabled modules. Defer enforcement to a later phase.
  module_scope  JSONB DEFAULT '{}',
  settings      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, slug)
);
CREATE INDEX idx_sites_tenant ON sites(tenant_id);
-- partial unique: exactly one primary per tenant
CREATE UNIQUE INDEX uniq_sites_primary ON sites(tenant_id) WHERE is_primary;
```

> The `is_primary` partial unique index mirrors the pattern already used for the active builder
> layout (see the "Builder multi-layouts" work) — one row flagged per tenant, enforced in the DB.

**Re-key (one site → many of each).** Every table that is one-per-tenant in the presentation layer
gains `site_id UUID NOT NULL REFERENCES sites(id)` and its unique key changes from `(tenant_id, …)`
to `(tenant_id, site_id, …)` (keep `tenant_id` for RLS; add `site_id` for scoping):

- Sitebuilder: `SiteConfig` (PK becomes `site_id`, not `tenant_id`), `SiteVersion`, `PageLayout`,
  `SiteLayoutBlock`, `SiteTheme`, `SiteLayoutDefault`, `SiteLayoutAssignment`,
  `TenantSectionDefinition`, `SitePublishSchedule`.
- Builder: `BuilderPage`, `BuilderLayout`.
- Commerce storefront: `StorefrontSettings`, `StorefrontTheme` (these are one-per-tenant today and
  drive the public render → must become per-site).
- CMS navigation: `NavigationMenu`/`NavigationItem` are referenced by `SiteLayoutBlock`; navigation
  is inherently per-site, so these re-key too (or gain a `site_id`).

**Stays tenant-level (Model A):** `Tenant`, `TenantBrand` (+ optional new `SiteBrand`), users,
catalog (`Product`/`ProductVariant`/collections), CRM (`Customer`/`B2BAccount`), orders, pricing,
inventory, billing, email sending domains, audit. These are the "shared back office."

**RLS:** every re-keyed table keeps `ENABLE + FORCE` RLS on `tenant_id` exactly as today. `site_id`
gets **no** RLS policy — it is scoped in application queries, not by Postgres (§2).

---

## 5. Routing & domains

Today: hostname → **tenant**, render its one site. With multi-site the resolver maps hostname →
**site** (→ its tenant):

- The domain/host mapping ([02-architecture-overview.md](02-architecture-overview.md) routing,
  [24-domain-purchase-management.md](24-domain-purchase-management.md),
  [04-domain-ssl-automation.md](04-domain-ssl-automation.md)) gains a `site_id`: each site has its
  own custom domain and/or its own `*.sparx.zone` subdomain.
- `apps/site` resolves `host → site`, loads that site's published `SiteVersion` + storefront theme,
  and `withTenant(site.tenantId)` for all data reads. `site_id` scopes the presentation reads;
  RLS still isolates the tenant.
- The primary site keeps the tenant's existing subdomain for backward compatibility; additional
  sites get new hostnames.
- Confirm (doc 32 §9 open question 2): switching the **active workspace** in the dashboard must
  never affect storefront host→site resolution — they're independent lookups.

---

## 6. Dashboard UX — a site switcher (distinct from the workspace switcher)

The dashboard already plans a **workspace** switcher in breadcrumb segment 1 (doc 32). Multi-site
adds a **site** scope _within_ a workspace. Proposed shape:

- A **site selector** scoped to the site-facing modules — Site Builder, Builder, storefront
  settings, navigation, CMS publishing targets. It picks "which site am I editing."
- **Back-office modules** that are tenant-wide in Model A (Commerce catalog, CRM, orders, billing)
  are **not** site-scoped and show no selector — they're the same across sites. This keeps the
  mental model honest: the selector only appears where the data is actually per-site.
- Breadcrumb (tentative): `Workspace › Site › Module › Section`, with the Site segment **only
  rendered for site-scoped modules**. Coordinate with [24-dashboard-shell.md](24-dashboard-shell.md)
  and doc 32's segment model so the two switchers don't read as the same control.
- Single-site tenants (the default, and all tenants at migration) see **no site switcher at all** —
  it appears only once a second site exists. Zero friction for the common case.

---

## 7. Billing

Per [17-billing-subscriptions.md](17-billing-subscriptions.md), billing is per tenant + per
enabled module. A second site is a natural **add-on line item** (a per-additional-site fee), the
same coordination concern doc 32 flagged for creating a second workspace (R5).

**Decision (2026-06-04): flat per-additional-site add-on**, NOT a higher plan tier. The tenant's
**primary** site is included in the base plan; each **additional** site (`properties` rows where
`is_primary = false`) is one recurring add-on line item. Rationale: keeps the mental model honest
(you pay per extra site, regardless of plan), mirrors the per-module add-on shape already in doc
17, and makes the "create a second site" CTA a clear, predictable upsell. Enforcement (metering
the add-on, gating create-site behind the subscription) lands with the billing build — until then
create-site is open. The Sites settings page is where the count surfaces.

---

## 8. Migration

Backfill is mechanical and low-risk because every tenant has exactly one site today:

1. Create one `sites` row per existing tenant, `is_primary = true`, `slug = 'primary'` (or derived
   from the tenant slug), `id` newly generated.
2. Add `site_id` (nullable first), backfill every re-keyed presentation row with that tenant's
   primary `site.id`, then set `NOT NULL` and swap the unique keys.
3. Point the tenant's existing domain/subdomain mapping at the primary site.
4. Hand-author the SQL for the PK change on `SiteConfig` (tenant_id → site_id) and the unique-key
   swaps — Prisma won't generate the RLS policies or the partial unique index, so those are
   hand-edited into the migration ([packages/db/README.md](../packages/db/README.md)). Run it
   through the **DB Migrate pipeline**, never a local Auth Proxy (Cloud SQL is private-IP).

After migration the platform behaves identically for every existing tenant (one primary site);
multi-site is purely additive from there.

---

## 9. Open questions / out of scope

- **Per-site brand override** (§3) — the deliberate amendment to doc-34's "brand overridable by
  none." Decide scope: full identity override, or presentation-only.
- **Model B scoping** — when (if) catalog/content gets a nullable `site_id`; whether pricing
  visibility is per-site.
- **Per-site module scope** — can a site expose a subset of the tenant's enabled modules
  (`sites.module_scope`)? Enforcement deferred.
- **Customer accounts across sites** — one shopper logging into two sibling sites
  ([27-customer-accounts-storefront-auth.md](27-customer-accounts-storefront-auth.md)): shared
  login across the tenant's sites, or per-site? (Leaning shared, since customers are tenant-level.)
- **Search** — universal/Typesense ([39-universal-search.md](39-universal-search.md),
  [22-typesense-search-spec.md](22-typesense-search-spec.md)) is tenant-scoped; a site-scoped
  storefront search needs `site_id` as a filter facet.
- **Email from-identity per site** — a per-site sending domain / from-address
  ([13-email-platform-prd.md](13-email-platform-prd.md))? Defer.
- **Hard isolation** is explicitly **not** a multi-site feature — that's multi-workspace (§2).

---

## 10. Phasing

| Phase | Scope                                                                                                                                                                                                                                                                                                                                                                                                    | Depends on                                                                        |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1 ✅  | `Property` entity + migration (one primary site per tenant); re-key the **Builder** presentation layer (`builder_pages`/`builder_layouts`/`builder_page_assignments`) to `property_id`; **no UX change**. Legacy `sitebuilder_*` left single-site (retiring).                                                                                                                                            | DB Migrate pipeline; hand-authored RLS/keys SQL                                   |
| 2 ✅  | Host→property routing (`domains` dispatch table + resolver + Caddy authorization); create-additional-site flow; per-site `*.sparx.zone` subdomain + BYO custom-domain connect/verify; storefront renders the resolved site (`apps/site` host→property threading).                                                                                                                                        | Phase 1; [04](04-domain-ssl-automation.md)/[24](24-domain-purchase-management.md) |
| 3 ✅  | Dashboard **Sites** settings hub + in-builder **site switcher** (cookie → `x-sparx-property-id`); single-site tenants see nothing new.                                                                                                                                                                                                                                                                   | Phase 2; doc 32 breadcrumb; [24](24-dashboard-shell.md)                           |
| 4 ✅  | Per-site **brand override** (`Property.brand_override` JSON; presentation-only identity — display name + theme colours + logo; merged over the tenant brand in the public payload). Amends [34](34-platform-glossary.md)/[33](33-token-model-v2.md).                                                                                                                                                     | Phase 3                                                                           |
| 5 ◐   | **Foundation laid, enforcement deferred** (per §3 — Model B is "opt-in, later"). Additive `property_id` scoping on catalog/content, per-site `module_scope`, billing add-on metering, site-scoped search facet are NOT yet built — the schema is forward-compatible (nullable `property_id` = "all sites") and the billing decision is recorded (§7). Build when a tenant actually needs split catalogs. | [17](17-billing-subscriptions.md), [39](39-universal-search.md)                   |

---

## 11. Docs to update when this lands

- [32-workspace-switching-breadcrumb.md](32-workspace-switching-breadcrumb.md) §2 — soften the "no
  Site model" statement to "no Site model _for the workspace axis_"; point here for the site axis.
- [34-platform-glossary.md](34-platform-glossary.md) — add **Site** as a first-class term ("a
  tenant has one _or more_ sites"); record the brand-override amendment.
- [05-data-model.md](05-data-model.md) — the `sites` table and the `site_id` scoping column.
- [02-architecture-overview.md](02-architecture-overview.md) / [04](04-domain-ssl-automation.md) /
  [24-domain-purchase-management.md](24-domain-purchase-management.md) — host→site resolution.
- [17-billing-subscriptions.md](17-billing-subscriptions.md) — per-site add-on.
- [00-README.md](00-README.md) — index entry (already stale; see note in §9 of doc 48 work).
