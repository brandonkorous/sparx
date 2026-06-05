# Handoff: "Switching sites shifts the entire context" (multi-site / docs/49)

Version: 1.0.0
Author: Brandon Korous
Last Updated: 2026-06-05

> Paste everything below to the multi-site agent. It is written as a task brief.

---

## Goal

When a user switches the active web **property/site** in the dashboard (the bookmarks-bar
site switcher), the **entire** dashboard + storefront context should shift to that site:
catalog, content, theme, navigation, settings — not just the Builder. Today only _part_ of
the context is property-scoped. Close the gap.

## Background you can rely on (verified 2026-06-05)

- Multi-property model = docs/49. One tenant → many `properties`; exactly one `is_primary`.
- Active property travels as the `x-sparx-property-id` request header, set by the dashboard
  from the `sparx_active_property` cookie (the site switcher). See
  `apps/dashboard/lib/api-rest-client.ts` (`ACTIVE_PROPERTY_COOKIE`, `activePropertyHeader`)
  and `apps/dashboard/lib/active-property.ts`.
- api-rest resolves it via `services/api-rest/src/lib/property.ts`:
  `resolvePropertyId(tenantId, requested)` (fail-closed to primary),
  `resolvePublicPropertyId`, `resolvePrimaryPropertyId`, and the Model-B `where` helpers
  `productSiteVisibilityWhere(propertyId)` / `contentSiteVisibilityWhere(propertyId)`.

## What ALREADY shifts per-property (don't redo)

- **Builder** — pages, site layout, components, brand. All `PropertyContext`-scoped
  (`packages/builder/src/services/page-service.ts`, `layout-service`, `component-service`).
  Public reads `/v1/public/builder/{page,collection,layout,home,styles}` all accept
  `?property=` (`services/api-rest/src/routes/v1/public/builder.ts`).
- **Storefront rendering** — home `/`, named pages, chrome, and brand identity now resolve
  per-property (see "Changed this session" below). `apps/site/lib/tenant.ts`
  (`resolveSiteRoute`/`resolveActivePropertySlug`) threads `?property=` into every
  per-property Builder read; dev fallback is `?tenant=&?property=` via `apps/site/proxy.ts`.

## What does NOT shift yet (your work)

1. **Dashboard catalog & content LISTS are tenant-wide.** `/commerce/products`, CMS content
   lists, etc. show every record regardless of active site, and "New X" defaults to global.
   Model-B per-site visibility EXISTS (junction tables; _empty = visible on all sites_) and
   there is per-item site-scope UI on the product/page/entry editors — but the list routes
   don't apply `productSiteVisibilityWhere`/`contentSiteVisibilityWhere`, so nothing filters.
   **This is the root of the "shared products bled into the other site" bug** (e.g. a Tesla
   `Model 3` product showing on a Driftwood site's featured rail).
   - Decide: should dashboard lists _filter_ to the active site, or _show all + badge scope_?
   - Make "New X" default-scope to the active site (with an explicit "all sites" opt-out).
2. **Full theme is tenant-wide.** Per-site `brand_override` only carries 4 identity fields —
   `businessName, colorPrimary, colorPrimaryForeground, colorAccent, logoMediaId`
   (`services/api-rest/src/lib/property-brand.ts`). The complete token set + fonts come from
   the tenant-wide saved theme / `sitebuilder_config` (keyed by `tenant_id`) and the legacy
   site snapshot. Make the full theme per-property.
3. **Legacy site snapshot is tenant-wide.** `GET /v1/public/storefront/site` takes NO
   `property` param; it drives `compiledTokens`/`themeKey`/`appearancePolicy`, the legacy
   home sections, and the chrome fallback. Read in `apps/site/lib/site.ts`
   (`getPublishedSite`) by `app/page.tsx`, `app/[...slug]/page.tsx`, and `app/layout.tsx`.
   Either make it property-scoped (publish per-property snapshots + `?property=`) or retire
   it in favor of the per-property BuilderPage system.
4. **Other modules** — CRM, Email, B2B, SEO, Settings — are entirely tenant-wide; switching
   sites changes nothing. Decide which are genuinely per-site (nav, storefront settings,
   redirects, SEO) vs. tenant-wide (CRM, billing), and scope accordingly.
5. **Billing/metering per site** (docs/49 remaining) — out of scope for the visible bug but
   on the multi-site roadmap.

## Two open design decisions to make first

- **First-class "home" page.** Today the storefront home = the published _slugless singleton_
  (lowest position) per property. The starter seed creates `Home — Landing` (slugless) AND
  `About` (also slugless — a smell). Consider an explicit `isHome` flag on `BuilderPage`
  instead of the slug-null convention, so a site's `/` is unambiguous.
- **Two parallel page/section systems.** The legacy sitebuilder snapshot (tenant-wide
  sections + theme) coexists with the newer per-property `BuilderPage` system. They overlap
  for the home and chrome. Decide whether to consolidate onto BuilderPages (per-property,
  cleaner) and migrate/retire the legacy snapshot.

## Changed THIS session (storefront per-property slice — already merged into working tree)

Coordinate with / build on these; don't revert them:

- `packages/builder/src/services/page-service.ts` — added `getPublishedHome(ctx)` /
  `getDraftHome(ctx)` (home = published slugless singleton, lowest position, per property).
- `services/api-rest/src/routes/v1/public/builder.ts` — added `GET /v1/public/builder/home`.
- `apps/site/lib/builder.ts` — added `getPublishedBuilderHome(tenantSlug)`.
- `apps/site/app/page.tsx` — renders the per-property BuilderPage home first (additive), then
  the legacy snapshot, then the composed-commerce fallback.
- `services/api-rest/src/lib/blueprint-installer.ts` — (a) a NON-primary install now writes
  `properties.brand_override` instead of clobbering the tenant brand; (b) the home page
  REPLACES the property's existing slugless singleton instead of adding a second home.
- **Media rendering (was entirely broken for by-id media):**
  - `services/api-rest/src/routes/v1/public/media.ts` — added the missing
    `GET /v1/public/media/:id?tenant=<slug>` redirect (asset id → `mediaPublicUrl(key)` → 302).
    Both `apps/site/lib/media.ts` and `services/api-rest/src/lib/email-data.ts` already built
    this URL but no route backed it; logos/favicons/og/any by-id `<img>` were 404ing.
  - `packages/commerce/src/index.ts` — re-export `mediaPublicUrl` (was relative-only).
  - `services/api-rest/src/routes/v1/public/commerce.ts` — the public product LIST now returns
    `primaryImageId` (hero thumbnail), mirroring `productService.list`; cards had no image.
  - `apps/site/lib/builder-data.ts` — iterated cms entries now resolve `featuredImage`
    (media-id string → `{url}`) so `item.featuredImage` renders (the list analogue of
    `postToBuilderRecord`).
  - REMAINING image gap is the same root as #1: shared/global records with no per-site scope
    (e.g. a Tesla product, old blog posts) still appear on every site, and ones without a
    featured image show a placeholder.

## Acceptance check

On one tenant with two sites (primary "Tesla", secondary "Driftwood"):
switching the dashboard site switcher to Driftwood should show only Driftwood's catalog,
content, theme, nav, and settings; the storefront for each property renders fully isolated
(verified today: primary `/`=Tesla, personal `/`=Driftwood). No record authored on one site
should appear on the other unless explicitly scoped to both.
