# Marketplace — the unified, categorized add-on surface

**Version:** 0.1.0
**Author:** Brandon Korous
**Last Updated:** 2026-06-06

---

## 1. Purpose & relationship to other docs

The **Marketplace** (`/marketplace`) is the one in-dashboard surface for everything a tenant can
_add_ to their workspace, organized by **category**. Blueprints are the first live category;
Themes, Integrations, and Components follow, with room for Apps/Workflows later. It is a
platform-level surface (not a module) — rail-pinned beside SEO and Settings, reachable even when
the Builder is off (installing a blueprint enables the Builder).

This doc owns the marketplace **shell** — its IA, the category registry, the browse/search/detail
mechanics, and the data contract. The individual catalogs live in their own docs:

- **Blueprints** — [docs/54](54-tenant-blueprints.md). The marketplace is the browse front-end;
  install/go-live/reset lifecycle stays in 54.
- **Components** — [docs/53](53-builder-tenant-components.md) (tenant components are declarative,
  versioned node-trees; the marketplace exposes the system/shared catalog).
- **Themes** — saved themes (`savedThemeService`, brand/theme model in
  [docs/45](45-builder-site-layout.md) / [docs/33](33-token-model-v2.md)).
- **Integrations** — the integration catalog + published-docs bridge
  ([docs/integration published docs] / payment/shipping/tax providers). UI is coming-soon until
  that catalog is exposed.
- **Search/facets** ride **Typesense** — [docs/22](22-typesense-search-spec.md) +
  [docs/39](39-universal-search.md).
- **Public top-of-funnel** (pre-auth browse → signup → install) is a _separate_ surface on
  `apps/web` — [docs/54 §15](54-tenant-blueprints.md). This doc is the **post-auth, in-dashboard**
  marketplace.

**Visual reference:** `mockups/marketplace.html` (home, category browse, detail — designed against
10,000 blueprints · 312 themes · 98 integrations · 1,240 components). Approved 2026-06-06.

---

## 2. The problem: scale changes the shape

The v1 marketplace rendered every catalog item as a card on one page. That is correct for six
blueprints and breaks completely at real scale. Designed as if the catalog holds **10k blueprints,
300+ themes, 100 integrations, 1,000+ components**, the marketplace is a **browse-and-search
product**, not a gallery:

- You never render the full catalog. Every category view is **search + facets + sort + pagination**.
- The landing is **curated** (featured/popular + category entry), not a dump.
- Items get **detail pages** (gallery, what's-included, requirements, install) — a card can't carry
  enough to decide on.
- Adding a category must be **data, not a rewrite** — a registry entry + a data source.

---

## 3. Information architecture — three route tiers

| Tier | Route | Job |
| ---- | ----- | --- |
| **Home** | `/marketplace` | Curated entry: global search, category tiles (with counts + coming-soon), a few featured strips per live category. Not a full listing. |
| **Category browse** | `/marketplace/[category]` | The scale workhorse: search-within + facet rail + sort + paginated grid + result count. This is where thousands of items live, behind query. |
| **Detail** | `/marketplace/[category]/[slug]` | One item: gallery/preview, full description, what's-included, requirements, version/author, install/enable CTA, related items. |

`[category]` and `[slug]` are dynamic segments resolved through the **category registry** (§4); the
same three page components serve every category, parameterized by registry config + a per-category
data adapter.

A category whose `status` is `coming-soon` renders an entry tile on the home and a teaser on its
browse route, but no live data — no rewrite needed when it goes live.

---

## 4. The category registry (extensibility model)

Categories are declared in a registry, mirroring the module-manifest pattern
([docs/24](24-dashboard-shell.md)). Adding Apps/Workflows/etc. is one entry.

```ts
interface MarketplaceCategory {
  id: 'blueprints' | 'themes' | 'integrations' | 'components' | string;
  label: string; // "Blueprints"
  singular: string; // "blueprint"
  icon: LucideIcon;
  accent: string; // CSS var / token — the category's color stripe
  tagline: string; // one line for the home tile + browse header
  status: 'live' | 'coming-soon';
  facets: FacetSpec[]; // the filter dimensions for THIS category (§5)
  sorts: SortSpec[]; // e.g. popular | newest | name | price
  // data adapter (server): list(query) → {items, total, facetCounts, nextCursor}
  //                         get(slug)   → DetailItem
  // card renderer (client): how this category's item shows in a grid
}
```

The registry is the single source of truth for: rail/home tiles, route resolution, the browse
header + facets, and which data adapter to call. **No category-specific branching in the page
components** — they read the registry.

---

## 5. Category browse page anatomy

The browse route is the part that has to survive scale. Anatomy (see mockup, view 2):

- **Top bar:** search-within input, sort `<select>`, result count ("Showing 1–24 of 9,842"),
  optional grid/list toggle. On mobile a **Filters** button opens the facet rail as a sheet.
- **Facet rail (left, sticky):** per-category filter groups with live counts; checkboxes
  (multi-select) and radios (single). Active filters surface as removable **chips** above the grid
  with a "Clear all".
- **Grid:** responsive `auto-fill` cards. **Load-more / cursor pagination** (preferred at this
  scale; numbered pages acceptable). Never render the whole set.
- **States:** zero-results (with "clear filters"), loading, and `coming-soon` placeholder.

**Facets per category (initial):**

| Category | Facets |
| -------- | ------ |
| Blueprints | Vertical (retail/services/b2b/content/…), Requires-module (commerce/cms/email/b2b/crm), Price (free/paid), Status (installed/not) |
| Themes | Style/mood, Color family, Layout density, Industry |
| Integrations | Type (payments/shipping/tax/accounting/marketing), Provider, Pricing |
| Components | Kind (section/block/widget), Source (system/shared), Module affinity |

---

## 6. Data & search contract

The API moves from "return everything" to a **paginated, faceted, searchable** contract, one shape
for every category:

```
GET /v1/marketplace/:category?q=&facet.<key>=<v>&sort=&cursor=&limit=
→ { items: Item[], total: number, facets: { <key>: { <value>: count } }, nextCursor: string|null }

GET /v1/marketplace/:category/:slug → DetailItem
```

- **Blueprints** evolve `GET /v1/blueprints` into this contract (or a `/v1/marketplace/blueprints`
  adapter over it). At today's scale the adapter slices the in-memory registry; the **contract is
  scale-ready** so swapping to a data/search backend is invisible to the UI.
- **Search + facet counts ride Typesense** ([docs/22](22-typesense-search-spec.md),
  [docs/39](39-universal-search.md)): a `marketplace` collection (or per-category collections) fed
  by projectors, queried for full-text + facet aggregations + pagination. This is exactly what
  Typesense is for — the marketplace does **not** invent its own filtering. Until the index exists,
  the adapter does in-memory filter/sort over the registry (correct results, just not at 10k).
- **Per-tenant install/enable state** is overlaid by the adapter (e.g. a blueprint's `install`
  row, a theme's "applied", an integration's "connected") — it is never part of the shared catalog
  index.

---

## 7. Detail pages

One detail component, registry-parameterized (see mockup, view 3):

- **Gallery** (preview screenshots) + long description / "what you get".
- **Action panel** (sticky): title, category badge, social proof (rating / install count) where we
  have it, price, **Install / Apply / Connect** CTA, "what's included" list, required-module chips,
  version, author.
- **Related items** strip (same category).

Blueprint install/go-live/reset stays exactly as [docs/54 §8](54-tenant-blueprints.md) — the detail
page's Install CTA drives the existing install action; the post-install "Review & go live" surface
is unchanged.

---

## 8. Placement in the dashboard shell

- **Rail pin:** "Marketplace" (Store icon) → `/marketplace`. Platform-level, bottom cluster beside
  SEO/Settings. Reachable when modules are off.
- **Builder → Blueprints sub-nav** (`/builder/blueprints`) is the **installed-only** view of this
  tenant's blueprints (manage/review/go-live), with a "Browse the marketplace" link back here. The
  marketplace is browse/acquire; the module surfaces are manage. The same split applies per category
  as they go live (e.g. Themes installed-state lives in Builder → Brand).

---

## 9. Responsive

Non-negotiable for platform UI ([docs/59](59-responsive-rendering.md) ethos). Browse collapses to a
single column; the facet rail becomes a **Filters** sheet behind a button; featured strips are
horizontal-scroll on every width; the detail two-column stacks. No desktop-only states.

---

## 10. Decisions (locked)

| # | Decision | Choice | Why |
| - | -------- | ------ | --- |
| M1 | One surface vs. per-type pages | **One categorized Marketplace** | One discovery model; scales by adding categories, not pages; lets a blueprint reference an integration. |
| M2 | Route shape | **Home → category → detail** (3 tiers) | Curated entry, scalable browse, decision-grade detail. |
| M3 | Extensibility | **Category registry** (data-driven) | Adding a category is one entry + an adapter, no shell rewrite. |
| M4 | Browse mechanics | **Search + facets + sort + cursor pagination** | The only thing that survives 10k items. |
| M5 | Search backend | **Typesense** (existing infra) | Don't reinvent filtering; facet counts + full-text + paging come free. In-memory adapter until indexed. |
| M6 | Catalog vs. tenant state | **Shared catalog index + per-tenant overlay** | The index is tenant-agnostic and cacheable; install/applied/connected is overlaid per request. |
| M7 | Coming-soon categories | **First-class registry entries** | Integrations/Apps show as real categories (teaser) before data lands — no rewrite at launch. |

---

## 11. Phasing / build plan

1. **Foundation + Blueprints category (real data).** Category registry; the three routes
   (`/marketplace` home, `/marketplace/blueprints` browse with facet rail + sort + load-more,
   `/marketplace/blueprints/[key]` detail); evolve `GET /v1/blueprints` into the §6 contract with an
   in-memory adapter. Themes/Integrations/Components appear as registry tiles (Integrations/Apps
   `coming-soon`, Themes/Components live-in-a-later-phase).
2. **Typesense-backed search + facets.** Index blueprints into a marketplace collection (projector);
   back browse search + facet counts + pagination with it; keep the in-memory adapter as the
   dev/no-index fallback.
3. **Other live categories.** Themes (saved themes), Components (system/shared component catalog),
   then Integrations when the provider catalog is exposed.
4. **Public funnel hand-off.** The public pre-auth gallery ([docs/54 §15](54-tenant-blueprints.md))
   reuses the same category adapters via a no-auth catalog read.

---

## 12. Open questions

1. **Pagination style** — cursor "Load more" vs. numbered pages vs. infinite scroll. Default:
   Load-more (cursor), least jarring at scale.
2. **Per-category collections vs. one `marketplace` Typesense collection** — one collection with a
   `category` facet is simpler; per-category gives independent schemas. Lean: one collection,
   `category` facet (matches docs/39's single-`entities`-collection precedent).
3. **Pricing model surfacing** — free/paid badges imply a billing tie-in ([docs/17](17-billing-subscriptions.md));
   blueprints are currently free. Show price only once paid catalog items exist.
4. **Ratings / install counts** — social proof in the mockup needs a data source; defer until there
   is install telemetry.
