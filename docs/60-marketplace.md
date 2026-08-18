# Marketplace — the unified, categorized add-on surface

**Version:** 0.3.1
**Author:** Brandon Korous
**Last Updated:** 2026-06-11

---

## 1. Purpose & relationship to other docs

The **Marketplace** is the one categorized surface for everything that can be _added_ to a sparx
workspace — **Blueprints, Themes, Components, and Integrations** today, with room for Apps/Workflows
later. It exists on **two surfaces** (§3):

- **In-dashboard** (`apps/dashboard` → `/marketplace`) — the **authenticated** browse-and-acquire
  experience for a signed-in tenant, with per-tenant state (installed / applied / connected).
- **On the marketing site** (`sparx/apps/web` → `/marketplace`) — the **public**, pre-auth gallery: the
  top-of-funnel where a visitor browses the catalog, then signs up to install (docs/54 §15).

Both surfaces render the **same catalog** from the **same API**; the only difference is that the
authenticated surface overlays per-tenant state and the public one does not. That single fact drives
the whole architecture: the catalog cannot live as an in-code registry inside either app — it is
**data, served from `api-rest`**, that both apps read (§6).

The catalog is **data-driven and publisher-owned** (§6, §11). Listings are rows authored by a
**publisher** — sparx (first-party), a tenant, or a third-party partner. Code is reserved for the
parts that genuinely _are_ code (a component's render function, a payment provider's adapter); the
catalog _metadata_ is always data. Adding a theme, blueprint, or component is inserting a row, not
shipping a release.

This doc owns the marketplace **shell + catalog model**. The individual subsystems live in their own
docs:

- **Blueprints** — [docs/54](54-tenant-blueprints.md). The marketplace is the browse front-end;
  install / go-live / reset stays in 54.
- **Components** — [docs/53](53-builder-tenant-components.md) (tenant components) + the new
  `@sparx/components` package (§7) that holds the primitive registry the catalog seeds from.
- **Themes** — saved themes (brand/theme model in [docs/45](45-builder-site-layout.md) /
  [docs/33](33-token-model-v2.md)).
- **Integrations** — the provider registry + install flow (payment/shipping/tax providers). The full
  integration **taxonomy** (the `purpose` × `shape` model, the non-provider shapes — channels,
  connectors, data sources — and the prioritized build catalog) lives in
  [docs/88](88-integrations-catalog.md); this doc owns only the catalog shell + the provider-adapter
  install flow.
- **Search/facets** ride **Typesense** — [docs/22](22-typesense-search-spec.md) +
  [docs/39](39-universal-search.md).

**Visual reference:** `mockups/marketplace.html` (home, category browse, detail — designed against
10,000 blueprints · 312 themes · 98 integrations · 1,240 components). Approved 2026-06-06.

---

## 2. The problem: scale changes the shape

The v1 marketplace rendered every catalog item as a card on one page. That is correct for six
blueprints and breaks completely at real scale. Designed as if the catalog holds **10k blueprints,
300+ themes, 100 integrations, 1,000+ components — and a long tail of third-party listings**, the
marketplace is a **browse-and-search product**, not a gallery:

- You never render the full catalog. Every category view is **search + facets + sort + pagination**.
- The landing is **curated** (featured/popular + category entry), not a dump.
- Items get **detail pages** (gallery, what's-included, requirements, install) — a card can't carry
  enough to decide on.
- Adding a category must be **data, not a rewrite** — a registry entry + a data adapter.
- Adding a _listing_ must be **a row, not a release** — authored by any approved publisher (§11).

---

## 3. Two surfaces, one catalog

| Surface       | App              | Audience             | Routes                                                | Overlay                              |
| ------------- | ---------------- | -------------------- | ----------------------------------------------------- | ------------------------------------ |
| **Dashboard** | `apps/dashboard` | Authenticated tenant | `/marketplace`, `/marketplace/[category]`, `…/[slug]` | Per-tenant install/applied/connected |
| **Public**    | `sparx/apps/web` | Anonymous visitor    | `/marketplace`, `/marketplace/[category]`, `…/[slug]` | None — CTA is "Sign up to install"   |

Both call the catalog API (§6); the dashboard hits the authenticated endpoint (which joins per-tenant
state), `sparx/apps/web` hits the public endpoint (catalog only). The page components are **registry-driven
and shared in shape** across both apps (§4) so a listing looks the same browsing logged-out as it does
logged-in — only the action panel's CTA differs (Install vs. Sign up to install).

The public surface is the **top of the acquisition funnel**: browse → pick → sign up → land in the
dashboard with that item queued to install (docs/54 §15).

---

## 4. Information architecture — three route tiers, one shell

| Tier                | Route                            | Job                                                                                                                                          |
| ------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Home**            | `/marketplace`                   | Curated entry: global search, category tiles (with counts + coming-soon), a few featured strips per live category. Not a full listing.       |
| **Category browse** | `/marketplace/[category]`        | The scale workhorse: search-within + facet rail + sort + paginated grid + result count. This is where thousands of items live, behind query. |
| **Detail**          | `/marketplace/[category]/[slug]` | One item: gallery/preview, full description, what's-included, requirements, version/publisher, install/enable CTA, related items.            |

`[category]` and `[slug]` are dynamic segments resolved through the **category registry** (§5); the
**same three page components serve every category**, parameterized by registry config + a per-category
data adapter. There is **no category-specific page** — adding a category is a registry entry + an
adapter, not new routes (M3). A category whose `status` is `coming-soon` renders a home tile + a
browse teaser, no live data, no rewrite when it goes live.

> **Migration note:** today's `/marketplace/blueprints/*` pages are bespoke. v0.2 folds them onto the
> generic `[category]` shell as the first adapter, proving the model on the one category with a full
> end-to-end flow. The install / go-live / reset lifecycle (docs/54) is unchanged — only the browse
> and detail _pages_ become generic.

---

## 5. The category registry (extensibility model)

Categories are declared in a shared registry, mirroring the module-manifest pattern
([docs/24](24-dashboard-shell.md)). The registry is the single source of truth for: rail/home tiles,
route resolution, the browse header + facets, and which data adapter to call.

```ts
interface MarketplaceCategory {
  id: 'blueprints' | 'themes' | 'integrations' | 'components' | string;
  label: string; // "Blueprints"
  singular: string; // "blueprint"
  icon: LucideIcon;
  accent: string; // CSS var / token — the category's color stripe
  tagline: string; // one line for the home tile + browse header
  status: 'live' | 'coming-soon';
  facets: FacetSpec[]; // the filter dimensions for THIS category (§9)
  sorts: SortSpec[]; // e.g. popular | newest | name | price
  // data adapter (server): list(query) → {items, total, facetCounts, nextCursor}
  //                         get(slug)   → DetailItem
  // card renderer (client): how this category's item shows in a grid
}
```

The registry definition is shared so **both apps** resolve categories identically. (The category's
data _adapter_ is server-side and lives next to the API; the registry only declares config + which
adapter key to use.)

---

## 6. The data-driven catalog model

The catalog is the spine. Decision **D4**: **per-category tables behind a uniform adapter contract.**
Per-category storage gives clean typing, independent evolution, and fast indexed SQL at third-party
scale; the uniform adapter gives one consistent API + UI contract. Unification happens at the
_contract_ and (later) the single Typesense collection — never at the SQL table, where it would cost
read speed.

### 6.1 Per-category tables, a shared spine

Each category is one table — `Blueprint`, `Theme`, `MarketplaceComponent`, `MarketplaceIntegration` —
sharing a **common column spine** plus category-specific columns:

```
shared spine (every catalog table):
  id, slug (unique per category), name, tagline, description,
  media (JSON: gallery/screenshots), icon, accent,
  version, changelog,
  publisher_id, publisher_type ('sparx'|'tenant'|'partner'), publisher_tenant_id?,
  status ('draft'|'in_review'|'published'|'suspended'|'rejected'),
  visibility ('public'|'unlisted'),
  price_cents (0 = free), pricing_model ('free'|'one_time'|'subscription'),
  install_count, rating, rating_count,         -- social proof (telemetry-fed, later)
  sort_weight, created_at, updated_at, published_at

category-specific examples:
  Blueprint            → required_modules[], vertical, definition (node-trees + content seed)
  Theme                → mood, color_family, density, industry, tokens (JSON: {light,dark})
  MarketplaceComponent → group, kind, surfaces[], tree (BuilderNode JSON), prop_spec[]
  MarketplaceIntegration → provider_slug, kind (payment|shipping|tax|…), config_schema, scopes[]
```

### 6.2 Code vs. data — the boundary

The **catalog is data**; the **runtime that makes a thing _work_ is code**, linked by slug/key.

| Thing                                         | Data or code                   | Why                                           |
| --------------------------------------------- | ------------------------------ | --------------------------------------------- |
| Blueprint definition                          | **Data** (seeded core)         | Content + node-trees                          |
| Theme token set                               | **Data**                       | A theme _is_ a token map                      |
| Composed marketplace component (a tree)       | **Data** (`tree` JSON)         | Trees of primitives are data                  |
| Component **primitive** (Section/Text/Button) | **Code** (`@sparx/components`) | It has a render function — the substrate (§7) |
| Integration catalog entry                     | **Data** (keyed to a provider) | Metadata is data                              |
| Integration **adapter** (provider impl)       | **Code** (provider package)    | It executes logic                             |

The in-code registries (`@wizeworks/blueprints`, `@wizeworks/site-themes`, the `@sparx/components` primitives,
the provider registry) become **seeders** for the catalog tables — not the catalog itself. sparx-core
listings are seeded (idempotently) through the migration pipeline; everything else is authored as data.

### 6.3 Publisher ownership + RLS (the deliberate deviation)

Listings are **publisher-owned**, and the catalog is **cross-tenant**: a _published_ listing is
visible to **every** tenant, while a _draft / in-review_ listing is visible only to its publisher. So
these tables do **not** use the canonical tenant-isolation policy. Instead:

```sql
-- Reads: anyone sees published listings; a publisher also sees its own non-published rows.
CREATE POLICY marketplace_read ON "<catalog_table>"
  USING (status = 'published' OR publisher_tenant_id = current_tenant_id());

-- Writes: a publisher may only write its own rows. sparx-core rows are seeded out-of-band
-- (migration / system publisher) and carry a NULL publisher_tenant_id.
CREATE POLICY marketplace_write ON "<catalog_table>"
  USING (publisher_tenant_id = current_tenant_id())
  WITH CHECK (publisher_tenant_id = current_tenant_id());
```

> ⚠️ **Footgun guard.** This is intentionally **not** `tenant_id = current_tenant_id()`. These are a
> shared, publisher-owned catalog, not tenant-private data. Do not "normalize" this policy — doing so
> would make every tenant's catalog invisible to everyone else. The per-tenant **install / applied /
> connected** tables (`TenantBlueprintInstall`, `ProviderInstallation`, future
> `TenantThemeApplication`, copied `BuilderComponent`s) remain standard tenant-isolated.

### 6.4 The per-tenant overlay

The shared catalog is tenant-agnostic and cacheable. **Per-tenant state** — a blueprint's `install`
row, a theme's "applied", an integration's "connected" — is **overlaid by the authenticated adapter**
per request (M6). It is never part of the catalog index. The public adapter omits the overlay
entirely.

### 6.5 The adapter interface

```ts
interface CategoryAdapter {
  list(
    query: CatalogQuery,
    ctx: { tenantId?: string }
  ): Promise<{
    items: ListingDto[];
    total: number;
    facets: FacetCounts;
    nextCursor: string | null;
  }>;
  get(slug: string, ctx: { tenantId?: string }): Promise<DetailDto | null>;
}
```

One adapter per category normalizes its table rows into the shared `ListingDto`. `ctx.tenantId`
present → join the overlay (dashboard); absent → catalog only (public). Until Typesense is wired
(§9), the adapter does SQL filter/sort/paginate directly — correct results, just not yet 10k-scale
facet aggregation.

---

## 7. `@sparx/components` — extracting the registry

The component **primitive registry** (`PALETTE` — Section, Grid, Stack, Heading, Text, Image, Button,
the data-aware BuyBox/PriceTag/Signup/NavMenu, …) currently lives inside the dashboard
(`apps/dashboard/.../builder/_builder/registry.tsx`). Because the **web renderer and `api-rest` also
need it** (the public marketplace renders component previews; the catalog API seeds component listings
from it), it moves to a shared **`@sparx/components`** package with a deliberate split:

- **`@sparx/components`** (main) — the full registry, _including_ React render functions and
  `@sparx/site-ui` imports. For the **canvases**: the dashboard builder + the `sparx/apps/web` renderer.
- **`@sparx/components/catalog`** (server-safe subpath) — **metadata only**: type, label, group, kind,
  module, bindability, surfaces, descriptions. **No React.** For **`api-rest`** (seed the
  `MarketplaceComponent` table; serve the catalog) and any backend reader — keeping React out of the
  service path (the `@wizeworks/cms-editor/serialize` pattern; see [packages/.../CLAUDE.md] + the
  Dockerfile-wiring rule).

This extraction is the single largest slice and is sequenced on its own (§11). The dashboard
`/builder/components` surface keeps working — it just imports from the package instead of a local path.
The marketplace **Components** category exposes the system/shared catalog (primitives + seeded composed
components); the **manage** surface (edit/delete your own) stays in `/builder/components`.

---

## 8. Category browse page anatomy

The browse route is the part that has to survive scale. Anatomy (mockup, view 2):

- **Top bar:** search-within input, sort `<select>`, result count ("Showing 1–24 of 9,842"), optional
  grid/list toggle. On mobile a **Filters** button opens the facet rail as a sheet.
- **Facet rail (left, sticky):** per-category filter groups with live counts; checkboxes
  (multi-select) and radios (single). Active filters surface as removable **chips** with "Clear all".
- **Grid:** responsive `auto-fill` cards. **Load-more / cursor pagination**. Never render the whole set.
- **States:** zero-results (with "clear filters"), loading, and `coming-soon` placeholder.

**Facets per category (initial):**

| Category     | Facets                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------ |
| Blueprints   | Vertical, Requires-module (commerce/cms/email/b2b/crm), Price (free/paid), Publisher, Status (installed/not) |
| Themes       | Style/mood, Color family, Layout density, Industry, Price, Publisher                                         |
| Integrations | Type (payments/shipping/tax/accounting/marketing), Provider, Pricing                                         |
| Components   | Kind (section/block/widget), Source (system/shared/partner), Module affinity                                 |

---

## 9. Data & search contract

One shape for every category, on **both** surfaces:

```
# Authenticated (dashboard) — joins per-tenant overlay
GET /v1/marketplace/:category?q=&facet.<key>=<v>&sort=&cursor=&limit=
  → { items: Item[], total, facets: { <key>: { <value>: count } }, nextCursor: string|null }
GET /v1/marketplace/:category/:slug → DetailItem  (with install/applied/connected state)

# Public (sparx/apps/web) — catalog only, no overlay, published+public rows only
GET /v1/public/marketplace/:category?…    → same shape, no per-tenant fields
GET /v1/public/marketplace/:category/:slug → DetailItem (CTA = sign up to install)
```

- **Search + facet counts ride Typesense** ([docs/22], [docs/39]): a single `marketplace` collection
  with a `category` facet (matching docs/39's single-`entities`-collection precedent), fed by
  per-category projectors, queried for full-text + facet aggregation + pagination. **Until the index
  exists, the adapter does SQL filter/sort/paginate** — correct, just not 10k-scale (M5).
- **Per-tenant install/enable state** is overlaid by the authenticated adapter (§6.4), never part of
  the shared index.

---

## 10. Detail pages

One detail component, registry-parameterized (mockup, view 3):

- **Gallery** (preview screenshots) + long description / "what you get".
- **Action panel** (sticky): title, category badge, social proof (rating / install count) where we
  have it, price, **Install / Apply / Connect** CTA (or **Sign up to install** on the public surface),
  "what's included", required-module chips, version, **publisher**.
- **Related items** strip (same category).

Per-category acquire actions are unchanged: blueprint install/go-live/reset (docs/54 §8); theme
"Apply" sets the **active site's** `themeKey` (active-site-only — D11; a tenant-wide default + per-site
override is a possible later refinement, not now); component "Copy to my components" clones the tree
into a tenant `BuilderComponent`; integration "Connect" drives the provider install flow.

---

## 11. Publishing & the ecosystem

The catalog is **publisher-owned from row one** — sparx, tenants, and third-party partners all publish
(D5). This section establishes the model; the full authoring/review/payout workflow is **later-phase**
(§13), but the schema (§6) supports it now.

- **Publishers.** A publisher is modeled as its own **`MarketplacePublisher`** row (id, `type`:
  `sparx` | `tenant` | `partner`, display name, slug, `owner_tenant_id?`). sparx is the seeded
  first-party publisher; a `tenant` publisher links its tenant (e.g. it turns a polished saved theme
  or component into a public listing); a `partner` is a third-party developer org that **may not be a
  tenant** (`owner_tenant_id` null). Every listing references a `publisher_id`; the catalog tables
  also carry `publisher_tenant_id` (denormalized from the publisher for the §6.3 RLS check, null for
  sparx/partner-without-tenant).
- **Submission & review.** Tenant/partner listings move `draft → in_review → published`, gated by a
  curated review step (sparx-core skips review as trusted first-party). `suspended` / `rejected` are
  terminal-ish states a reviewer can set. Visibility (`public` | `unlisted`) is orthogonal to status.
- **Monetization (deferred).** `price_cents` + `pricing_model` live on the spine now; paid listings →
  revenue share → payouts ties into billing ([docs/17](17-billing-subscriptions.md)). The payout
  machinery (publisher accounts, statements, payouts) is its **own future doc + phase** — out of scope
  for the initial build, but the columns leave room so we don't migrate later.
- **Trust & safety.** Component/blueprint trees are declarative (no RCE — docs/53); integrations are
  the sharp edge (a partner adapter executes), so partner-published _integrations_ stay gated behind
  sparx review + a vetted provider SDK well beyond the first publishing phase.

---

## 12. Placement in the dashboard shell

- **Rail pin:** "Marketplace" (Store icon) → `/marketplace`. Platform-level, bottom cluster beside
  SEO/Settings. Reachable when modules are off (installing a blueprint enables the Builder).
- **Module surfaces stay "manage."** The marketplace is **browse/acquire**; each module keeps its
  installed-state view: Builder → Blueprints (this tenant's installs), Builder → Components
  (`/builder/components`, edit/delete your own), Builder → Brand (applied theme), Commerce → providers
  (connected integrations). "Browse the marketplace" links back from each.

---

## 13. Responsive

Non-negotiable for platform UI _and_ the public site ([docs/59](archive/59-responsive-rendering.md) ethos).
Browse collapses to a single column; the facet rail becomes a **Filters** sheet behind a button;
featured strips horizontal-scroll on every width; the detail two-column stacks. No desktop-only states,
on either surface.

---

## 14. Decisions (locked)

| #   | Decision                       | Choice                                                | Why                                                                                             |
| --- | ------------------------------ | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| M1  | One surface vs. per-type pages | **One categorized Marketplace**                       | One discovery model; scales by adding categories, not pages.                                    |
| M2  | Route shape                    | **Home → category → detail** (3 tiers)                | Curated entry, scalable browse, decision-grade detail.                                          |
| M3  | Extensibility                  | **Category registry** (data-driven, generic shell)    | Adding a category is one entry + an adapter, no page rewrite.                                   |
| M4  | Browse mechanics               | **Search + facets + sort + cursor pagination**        | The only thing that survives 10k items.                                                         |
| M5  | Search backend                 | **Typesense** (single `marketplace` collection)       | Don't reinvent filtering; SQL adapter is the fallback until indexed.                            |
| M6  | Catalog vs. tenant state       | **Shared catalog + per-tenant overlay**               | The catalog is tenant-agnostic + cacheable; install/applied/connected overlaid per request.     |
| M7  | Coming-soon categories         | **First-class registry entries**                      | Show as real categories (teaser) before data lands.                                             |
| D4  | Catalog storage                | **Per-category tables, uniform adapter contract**     | Clean typing + fast SQL + independent growth; consistency lives at the contract, not the table. |
| D5  | Authorship                     | **Publisher-owned: sparx + tenant + partner**         | A third-party ecosystem is a core long-term goal; catalog is data, not curation-only.           |
| D6  | Catalog RLS                    | **`status='published' OR own-draft`, not tenant-iso** | Published listings are cross-tenant; drafts are publisher-private. Deliberate deviation.        |
| D7  | Surfaces                       | **Dashboard (authed) + sparx/apps/web (public)**      | Same catalog/API; public surface is the acquisition funnel.                                     |
| D8  | Component registry home        | **`@sparx/components` + server-safe `/catalog`**      | Both apps + api-rest need it; keep React out of the backend path.                               |
| D9  | Publisher entity               | **`MarketplacePublisher` row (may link a tenant)**    | A partner needn't be a tenant; listings reference a publisher id, not a raw tenant.             |
| D10 | Pagination style               | **Cursor "Load more"**                                | Least jarring at scale; numbered pages acceptable later if needed.                              |
| D11 | Theme "Apply" scope            | **Active site only**                                  | Simplest correct model; tenant-wide default + per-site override is a possible later refinement. |

---

## 15. Phasing / build plan

> **Status (2026-06-10): phases 1–5 SHIPPED — all four categories (Blueprints, Themes, Integrations,
> Components) are live on the dashboard AND the public surface, seeded in prod.** Phase 6 (Typesense)
> is the only remaining build item and is scale-only (the SQL adapter is the documented fallback,
> M5). Phases 7–8 remain deferred by design.
>
> One deliberate deviation from the original plan: Themes/Integrations/Components went live via a
> **curated inline seed** in `wizeworks/packages/db/prisma/seed.ts` (each row's `slug` = the in-code key — theme
> preset key / provider slug / builder component `type` — with the heavy payload column NULL, resolved
> by slug), **not** via the `@sparx/components` package extraction (phase 3). The extraction (D8) is
> still worthwhile to unify the registry across apps, but the catalog did not need it to go live, and
> the inline seed avoided new `@wizeworks/db` dependencies. The public surface lives at **`/market`** (so
> the `sparx.market` vanity domain lands on it), not `/marketplace`.

1. **Catalog spine.** ✅ SHIPPED. Per-category tables + publisher columns + the §6.3 RLS; a catalog
   service + adapter interface; `GET /v1/marketplace/:category` (authed) + `GET /v1/public/marketplace/:category`;
   idempotent sparx-core seed via the migration pipeline.
2. **Generic `[category]` shell.** ✅ SHIPPED. The three shared pages (home, browse with facet rail +
   sort + load-more, detail) in the dashboard; blueprints folded onto it as the first adapter with a
   per-tenant install overlay; the bespoke handlers retired.
3. **Components category.** ✅ SHIPPED (via curated seed, not `@sparx/components` extraction — see the
   status note above). Fifteen marketplace-worthy system components; "Add to my components" hands off
   to `/builder/components/<type>` (the existing Copy-to-tenant flow, docs/53). The `@sparx/components`
   extraction + `/catalog` subpath remains a worthwhile refactor, but is no longer blocking.
4. **Themes + Integrations.** ✅ SHIPPED. Themes (six `@wizeworks/site-themes` presets; "Apply" → active
   site `themeKey` via `PUT /v1/sitebuilder/config/theme`, D11) and Integrations (six providers;
   "Connect" → `/commerce/providers`). _Follow-up: only Stripe + Shippo are registered in api-rest's
   provider bootstrap; PayPal/EasyPost/TaxJar/Avalara bundles exist but need activating before their
   Connect fully completes._
5. **Public marketplace on `sparx/apps/web`.** ✅ SHIPPED at `/market` over the public endpoints — the
   browse/detail gallery + the "sign up to install" funnel hand-off (docs/54 §15).
6. **Typesense** marketplace collection (projectors, facet aggregation) — **remaining; scale-only.**
   Swap behind the adapter; the SQL adapter remains the dev/no-index fallback (M5).
7. **Publishing workflow** (tenant/partner authoring → submit → review → publish) — **deferred; gets
   its own doc** when we build it. The catalog schema (§6) supports it now (publisher, status,
   visibility); the authoring + review _experience_ is not built in this round.
8. **Monetization / payouts** — **deferred; its own future doc + phase** (billing tie-in,
   [docs/17](17-billing-subscriptions.md)). The spine carries `price_cents` / `pricing_model` so paid
   listings don't require a migration later, but no payout machinery is built now.

---

## 16. Open & resolved questions

**Resolved (this round):**

- **Pagination** → cursor **"Load more"** (D10).
- **Partner identity** → a distinct **`MarketplacePublisher`** row that _may_ link a tenant, so a
  partner needn't be a tenant (D9, §11).
- **Theme "Apply" scope** → **active site only** (D11).

**Deferred (documented for a future callout — not built this round):**

- **Publishing workflow** (authoring → submit → review → publish) — own future doc (§15.7).
- **Monetization / payouts** — own future doc + phase (§15.8).
- **Review SLA + reviewer tooling** — who reviews tenant/partner submissions; part of the publishing
  phase.
- **Ratings / install counts** — social-proof data source; needs install telemetry first.
