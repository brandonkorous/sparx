# 117 — apps/market: Amazon/Etsy-grade marketplace upgrade

Version: 1.0
Author: Brandon Korous
Last Updated: 2026-07-07

**Goal.** Turn `apps/market` from a _skeleton_ multi-vendor marketplace into a
genuine Amazon/Etsy-grade experience — depth, discovery, and social proof — while
**retiring every bespoke `mx-*` layout class in favor of silicaui-native
composition** (silicaui-react components + Tailwind utilities + small local React
layout components). The `mx-*` removal is NOT a separate chore: every surface here
gets rebuilt anyway, so each `mx-*` family dies as a byproduct of its slice. Doing
a standalone `mx-*` sweep first would pay for the same files twice.

This is the concrete build companion to the silicaui pilot
([silicaui-market-pilot-notes.md](silicaui-market-pilot-notes.md)) and the
marketplace channel strategy ([106-channel-marketplace-strategy.md](106-channel-marketplace-strategy.md)).

---

## 0. The central architectural finding

**The sparx backend is already far richer than the market surface exposes.**
Reviews, Q&A, wishlists, multi-image galleries, product collections, and Typesense
all have live models/endpoints. Market simply doesn't project or wire them. So this
is overwhelmingly a **surfacing + UI** effort, not a from-scratch backend build.

Two data paths exist, and the choice between them per feature is the key design
decision:

- **Global projection** (`market_listings` / `market_merchants`, cross-tenant
  SELECT): read straight onto grids with no tenant context. Powers browse/cards.
  Adding a field here = a **migration + projection-writer change** (in
  `packages/commerce/src/services/market/projection.ts`) — heavier, but the field
  is then free to filter/sort/facet across all tenants.
- **On-demand tenant resolve** (`getListingDetail` pattern): `withSystem` finds the
  listing → `withTenant({ tenantId })` reads the seller's private tables. **No
  migration, no projection.** Perfect for detail-page depth that never needs
  cross-tenant faceting (galleries, review lists, Q&A, related-in-category).

**Rule of thumb:** if it appears on a **card / facet / sort**, project it. If it
only appears on the **detail page**, resolve it on demand. This collapses most of
the work to zero-migration route additions.

### Backend readiness (from the survey)

| Capability                          | Backend                                                                                              | Path to surface                                                                                                                                                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Multi-image gallery                 | `VariantImage` / `Product.images[]` exist                                                            | **Resolve** — extend `getListingDetail` to return `images[]` (product images where `variantId=null`). No migration.                                                                                                 |
| Review list + write + helpful votes | `ProductReview`, `ReviewMedia`, `ReviewHelpfulVote` + `/v1/public/commerce/products/:handle/reviews` | **Resolve** — new market route resolves slug→{tenantId,handle}, reads reviews under tenant. No migration.                                                                                                           |
| Product Q&A                         | `ProductQuestion`, `ProductAnswer` + tenant endpoint                                                 | **Resolve** — same pattern as reviews. No migration.                                                                                                                                                                |
| Related / same-category             | `market_listings.category`                                                                           | **Projection query** — `browseListings({category, ≠self})`. No migration.                                                                                                                                           |
| Variants (swatches)                 | `ProductVariant` + options, already resolved                                                         | Already wired; UI upgrade only (dropdown → swatches).                                                                                                                                                               |
| Bestseller / low-stock badges       | `Product.bestSellerRank`, low-stock signal                                                           | **Projection** — add `best_seller_rank`, `low_stock` columns + project. 1 migration.                                                                                                                                |
| Seller rating / trust               | reviews aggregate per tenant                                                                         | **Projection** — add `rating`, `rating_count`, `created_at` age to `market_merchants`. Folds into the bestseller migration.                                                                                         |
| Facet counts                        | `market_listings`                                                                                    | **Projection query** — `GROUP BY category`, price buckets. No migration.                                                                                                                                            |
| Search autocomplete                 | `market_listings.search_text` / title                                                                | **New route** — `pg_trgm` prefix suggest on title/merchant. No new infra (Typesense stays a later upgrade; browse.ts's "no Typesense" note predates the live-Typesense deviation but trigram suffices for suggest). |
| Favorites / wishlist                | `Wishlist` is tenant+shopper-scoped; market is cross-tenant guest                                    | **Client-only** localStorage favorites (like the guest cart token) + a `/favorites` page. No backend.                                                                                                               |
| Discount codes                      | commerce discount engine, `appliedDiscountCodes` already on cart                                     | **Wire** — add a code-entry field + a market `cart/:id/discount` route calling the existing discount apply.                                                                                                         |
| Multi-seller cart                   | single-merchant by design (token per merchant)                                                       | **Capstone** (slice 7) — sparx is MoR on market, so one PaymentIntent across sellers with per-seller settlement splits is feasible but a major checkout change. Stretch.                                            |

---

## 1. The `mx-*` → silicaui-native replacement model

**Target: zero `.mx-*` rules in `globals.css`.** Replacements, in priority order:

1. **A silicaui-react component** where one exists (`Card`, `Button`, `Badge`,
   `Input`, `Alert`, `Text`, `Heading`, …). Controls are never re-skinned by hand.
2. **A local presentational React component** composed from Tailwind utilities, for
   marketplace primitives silicaui doesn't ship (`<ProductCard>`, `<PriceRange>`,
   `<RatingStars>`, `<FacetGroup>`, `<Gallery>`). These already exist as components
   — they just move from `className="mx-card"` to utility classes / silicaui `Card`.
3. **Inline Tailwind utilities** for one-off layout (grid, flex, spacing, section
   rhythm) — sanctioned per root CLAUDE.md ("layout/positioning utilities are fine
   in feature code").

`layers.css` loses `mx-base`/`mx-components` once empty; `sparx-theme.css` (the
named silicaui theme + palette) stays. When the last slice lands, `globals.css` is
just the reset + `html,body` paint + the theme import.

**`mx-*` retirement schedule** (each family dies in exactly one slice):

| Slice            | Retires                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| S1 Shell         | `mx-frame` `mx-main` `mx-skip-link` `mx-container` `mx-header*` `mx-nav*` `mx-catbar*` `mx-footer*` `mx-sell*`      |
| S2 PDP           | `mx-pdp*` `mx-seller*` `mx-rating*`                                                                                 |
| S3 PLP+search    | `mx-plp` `mx-facets` `mx-facet*` `mx-toolbar*` `mx-pager*` `mx-grid` `mx-card*`                                     |
| S4 Home          | `mx-hero*` `mx-section*` `mx-cat-grid` `mx-cat-tile*` `mx-page-title` `mx-page-lead`                                |
| S5 Seller        | `mx-banner*` `mx-profile-head*` `mx-social`                                                                         |
| S6 Cart/checkout | `mx-checkout` `mx-summary` `mx-line*` `mx-totals*` `mx-form` `mx-field*` `mx-addr` `mx-rates` `mx-rate` `mx-empty*` |

---

## 2. Build slices (each = full vertical: backend → api → lib → UI → mx- removal)

Ordered by conversion impact and dependency. Each slice is independently shippable.

### S1 — App shell + marketplace chrome

The frame every page wears; sets the silicaui-native visual language.

- **Header:** prominent always-visible **search bar** (the marketplace signature),
  category mega-nav, cart, favorites indicator, "Sell" CTA.
- **Footer + section/container/hero primitives** as reusable local components.
- No backend. Retire the shell `mx-*` families.

### S2 — Product detail page (PDP) — _highest impact_

- **Backend (no migration):** extend `getListingDetail` → `images[]`; add
  `getListingReviews(slug, {page,sort})` and `getListingQuestions(slug)` (resolve
  slug→tenant→read); add `getRelatedListings(slug)` (same-category browse).
- **API:** `GET /products/:slug/reviews`, `POST /products/:slug/reviews`,
  `GET /products/:slug/questions`, `POST /products/:slug/questions`,
  `GET /products/:slug/related`.
- **UI:** image **gallery** (thumbs + main + zoom), variant **swatches**, sticky
  buy-box, **rating breakdown + review list** with helpful votes + write-review,
  **Q&A**, **related products**, **seller trust card**. Retire `mx-pdp/seller/rating`.

### S3 — Listing page (PLP) + search

- **Backend:** facet counts (`GROUP BY category`, price buckets, in-stock),
  seller + rating facets; `GET /products/suggest?q=` (pg_trgm autocomplete);
  **migration**: `best_seller_rank`, `low_stock` on `market_listings` + project.
- **UI:** faceted sidebar **with counts**, active-filter chips, numbered
  pagination, card **badges** (bestseller/low-stock/sold-out/featured), header
  **autocomplete**. Retire `mx-plp/facets/toolbar/pager/grid/card`.

### S4 — Discovery home

- **Backend:** trending (by `best_seller_rank`), new arrivals, per-category
  features — all `market_listings` queries.
- **UI:** hero, category tiles, **trending carousel**, new-arrivals, **featured
  sellers**, deals band. Retire `mx-hero/section/cat-*/page-title/page-lead`.

### S5 — Seller storefronts + trust

- **Backend (migration, folded w/ S3's):** `rating`, `rating_count`, member-since
  on `market_merchants` + project; in-store search/sort/paginate over a seller's
  catalog.
- **UI:** banner, **trust badges** (rating, verified, N sales, member since),
  policies, in-store search/sort. Retire `mx-banner/profile-head/social`.

### S6 — Cart + checkout + favorites

- **Favorites:** localStorage store + heart affordance on every card + `/favorites`.
- **Discount codes:** entry field + `POST /cart/:id/discount` (+ remove) wiring the
  existing discount engine.
- **Cart depth:** save-for-later, cart recommendations, secure-checkout cues.
- Retire the cart/checkout/form `mx-*` families.

### S7 — Order tracking, account, missing pages _(stretch)_

- Order **timeline** + tracking on `/orders/[id]`.
- The dead links: `/sell`, `/about`, `/how-it-works`, `/help`, `/contact`,
  `/legal/*`.
- **Multi-seller cart** (the capstone) — one bag across sellers, one payment, split
  settlement. Design-first; large checkout change.

---

## 3. Constraints & guardrails (binding)

- **Migrations are files-only here.** Author the migration SQL + Prisma model +
  projection change as files; DO NOT run `prisma migrate/generate/db push` (shared
  docker + the running stack). New-model code not typechecking until the user
  regenerates is expected. The DB Migrate workflow applies on `main`
  ([packages/db/CLAUDE.md](../packages/db/CLAUDE.md)). Only **S3** needs a migration
  — keep the rest migration-free by design.
- **Dockerfiles:** no new workspace package is planned; market already deps
  `@sparx/commerce-schemas`. If a slice adds one, wire every consumer Dockerfile
  COPY (new-workspace-package skill).
- **Cross-tenant safety:** every on-demand resolve goes `withSystem` (find listing,
  read the projection's `tenantId`) → `withTenant({ tenantId })`. Never expose one
  tenant's private data to another; reviews/Q&A/related read only the resolved
  seller. RLS is the backstop.
- **Service boundaries:** market reads stay in `@sparx/commerce` market service +
  the `api-rest` public market route. No new service.
- **silicaui-native only:** no new `mx-*`. Controls via silicaui-react; layout via
  utilities/local components. Base font ≥16px; status via `statusTone()` +
  `<Badge>`; no gradients; full-palette, not monotone.
- **Responsive:** every surface works on mobile (facets collapse to a sheet, PDP
  gallery stacks, two-column checkout stacks to one).
- **User owns dev/commit/install lifecycle:** build files + typecheck/lint/prettier
  my files; report changed files; the user commits, installs, and restarts dev.

---

## 4. Definition of done

- Zero `.mx-*` rules remain; `globals.css` is reset + theme only.
- PDP has gallery + variants + review list + Q&A + related + seller trust.
- PLP has faceted filtering **with counts**, badges, autocomplete, numbered pages.
- Home is a real discovery surface; seller pages carry trust signals.
- Favorites + discount codes work; dead links resolve.
- `pnpm --filter @sparx/market typecheck && lint && build` green (modulo the one
  S3 migration awaiting the pipeline).
