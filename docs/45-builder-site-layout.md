# 45 — Builder: The Site Layout Editor

Version: 1.4
Author: Brandon Korous
Last Updated: 2026-08-02

> **SUPERSEDED for the storefront render path (2026-08-02).** The chrome a visitor sees is the
> **silica frame** (`builder_layouts.silica_published_tree`), read by `apps/site/app/layout.tsx`.
> The sparx-Builder chrome renderer described below was deleted with `<SiteHeader>`/`<SiteFooter>`,
> so the `draft_tree` / `published_tree` columns this doc specifies no longer reach a page. The MCP
> tools that wrote them (`list` / `get` / `create` / `update` / `publish_builder_layout`,
> `set_active_layout`, `delete_builder_layout`) are **removed** — they returned `published: true`
> and changed nothing on the live site. Author chrome with `set_silica_frame` → `publish_silica_site`
> (contract: `describe_silica_authoring`). What survives here and is still current: the **catalog +
> active-layout model** (one live layout per site, `builder_layouts.is_active`, per-page `frame_id`),
> which the silica frame reuses row-for-row. The tree format and the editing workflow do not.

> The Builder ([40](40-sitebuilder-composition-model.md)) models a website as a
> **tree of nested layouts**: a layout owns **zones**, one of which — the content
> outlet — swaps per route, while the rest (header / footer / sidebar) are
> **chrome** that persists across navigation. The page editor
> ([41](archive/41-builder-page-model.md), [44](archive/44-builder-site-render.md)) edits
> the content outlet's tree. This doc covers the OTHER half: the **site layout**
> — the chrome that wraps every page — edited with the same editor, and rendered
> around every published page on the site.

## 1. The problem

The page editor composes what fills the content outlet for one route. Nothing yet
lets a tenant compose the **shell** around it: the header (logo + nav + cart), the
footer (links + social + legal), and where the page content sits. Today the
site renders `SiteHeader`/`SiteFooter` from the **legacy** site-builder
snapshot (`SiteLayoutBlock` + `NavigationMenu` + `TenantBrand`). We want the new
Builder to own that chrome too — with the same single-screen editor — without
rebuilding the navigation and brand data that already exists.

We need:

1. **A site-layout tree** — the chrome as a `BuilderNode` tree with one special
   node marking where the routed page goes.
2. **The same editor** — `/builder/site` runs the same canvas / inspector /
   layers / palette as `/builder/page`.
3. **Real site data to bind to** — nav, brand identity, social — sourced from the
   data that already exists, not a parallel store.
4. **Site render** — every published page renders **inside** the published
   site layout, with the page dropped at the outlet.

## 2. Decisions

**2.1 The site layout is a `BuilderNode` tree with one `Outlet` leaf.**
A site layout is the same recursive node model the page editor already produces.
The one new idea is an **`Outlet`** node — a non-bindable leaf marking the content
outlet. In the editor it renders a labeled "Page content" placeholder; on the
site it renders the routed page. **At most one Outlet per layout** (a tree
with zero outlets can't host pages; two is ambiguous). Everything above/around the
Outlet is chrome.

```
Layout (root container, stack)
├── Header   (container — Logo, NavMenu, cart)
├── Outlet   (leaf — the routed page renders here)
└── Footer   (container — NavMenu, SocialLinks, legal)
```

**2.2 Same editor, shared brain.** The selection / scope / tree-mutation /
autosave orchestration is extracted from `BuilderApp` into a `useBuilderEditor`
hook; `/builder/page` and `/builder/site` each render a thin shell around it. The
pure pieces (`Canvas`, `Inspector`, `LayersPanel`, `AddPalette`, `model.ts`) are
already shared and unchanged. The site shell differs only in chrome: no slug field,
no page kind, no "compose data from modules" context bar — instead a site context
bar, and the site-scope catalog.

**2.3 A `BuilderLayout` entity — a per-tenant catalog, exactly one ACTIVE.**
A sibling of `BuilderPage` with the same draft/publish lifecycle
(`draftTree` / `publishedTree` / `publishedAt`) and the same catalog shape: a
tenant keeps **many** layouts. The starter header · outlet · footer is seeded as
the first (active) layout on first load. Two columns extend `BuilderPage`'s shape:

- **`isActive`** — exactly one layout per tenant is the **live** chrome the
  site serves. Enforced at the DB by a **partial unique index** on
  `(tenant_id) WHERE is_active` (the canonical race-safe Postgres idiom; Prisma
  can't express the predicate, so it lives in the migration SQL alongside the RLS
  policies). `setActive(id)` clears the prior active and sets the new one inside
  one transaction.
- **`position`** — catalog ordering, like `BuilderPage.position`.

**Publish and activate are separate**: publishing a layout snapshots its
draft → published — a layout can be **published-but-idle**. A distinct _make
active_ flips which **published** layout is live (activating an unpublished draft
is refused — the site serves the active layout's _published_ tree). Deleting
the live layout is refused; make another active first.

This is the **named layouts** capability the v1 doc deferred
([40](40-sitebuilder-composition-model.md) §13). **Per-page layout assignment**
(a layout picker on the page, target-based defaults) remains deferred — every page
still renders inside the single active layout.

**2.4 Bind real site data; never rebuild it.** A published Builder layout's chrome
binds to a NEW `site` source module, but that module **references the existing
platform data**:

| Site source       | Backed by (existing)                                                 |
| ----------------- | -------------------------------------------------------------------- |
| `site.identity`   | `Tenant.name` / `TenantBrand.businessName` · `…tagline` · logo media |
| `site.primaryNav` | `NavigationMenu(location: 'header')` → `NavigationItem[]`            |
| `site.footerNav`  | `NavigationMenu(location: 'footer')` → `NavigationItem[]`            |
| `site.social`     | `Tenant.socials` (a site setting, edited in `/settings/general`)     |

The Builder stores **no** parallel nav or brand. The catalog **sources** are
code-defined (a fixed shape — `SITE_SOURCES`); the **data** is fetched per tenant
at preview/render time via the readers that already exist
(`getNavigationMenu`, `resolveTenant`). Editing nav items / brand stays where it
lives today; the site editor only composes how they're **presented**.

**2.5 Chrome is Tier-2 components, not hand-wired primitives.** Four new
`site`-module leaves (docs/40 §4 — "tenants never hand-wire `<a>`; they say
'show me the nav, nicely'"):

- **`Outlet`** — the content outlet (non-bindable; one per layout).
- **`NavMenu`** — bound to a nav **array**; owns its own item iteration, rendering
  `label → url` links. (Iteration internal to the component, per docs/40 §6.5.)
- **`Logo`** — bound to `site.identity`; renders the logo (image) or the site name
  (fallback), linking to `/`.
- **`SocialLinks`** — bound to `site.social` array; renders a platform-icon row.

A `surfaces?: ('page' | 'site')[]` field on each registry entry scopes the palette:
`Outlet`/`NavMenu`/`Logo`/`SocialLinks` are `site`-only; per-record data leaves
(`PriceTag`, `Signup`) are `page`-only; the primitives are both. Default = both.

**2.6 Render: the ACTIVE published Builder layout wins (additive).** The site
root layout fetches the tenant's **active** Builder layout and renders its
**published** tree as the chrome — the routed page is dropped at the `Outlet` — and
the legacy `SiteHeader`/`SiteFooter` are skipped. If the active layout has no
published tree (or no layout is active), today's chrome renders unchanged. The
public read (`getPublished`) resolves `WHERE is_active` then returns
`publishedTree`, so swapping which layout is live is a single _make active_ away —
no page touches it. This mirrors the page render path's "Builder owns its slug,
else fall through" ([44](archive/44-builder-site-render.md) §2.5): the new system
takes over only what a tenant has actually published **and** activated.

## 3. The site-scope catalog (`SITE_SOURCES`)

A new `SourceModule = 'site'`. Code-defined, tenant-independent shape:

| key               | cardinality | fields                                          |
| ----------------- | ----------- | ----------------------------------------------- |
| `site.identity`   | object      | `name` (text), `tagline` (text), `logo` (image) |
| `site.primaryNav` | array       | `label` (text), `url` (text)                    |
| `site.footerNav`  | array       | `label` (text), `url` (text)                    |
| `site.social`     | array       | `platform` (text), `url` (text)                 |

`SITE_CATALOG = { sources: SITE_SOURCES }` is a constant — the site editor route
passes it directly (no fetch / no per-tenant query), unlike the page catalog which
must introspect the tenant's CMS content types. `buildPreviewData(SITE_SOURCES)`
gives the canvas placeholder nav/identity so chrome previews before publish.

## 4. Render data (`loadSiteData`)

The site's analogue of `loadBuilderData` for the chrome:

- `site.identity` ← `{ name, tagline, logo: { url } }` from the resolved tenant +
  brand (logo via `mediaUrl(logoMediaId)`).
- `site.primaryNav` / `site.footerNav` ← `getNavigationMenu(slug, 'header'|'footer')`
  flattened to `{ label, url }[]` (top level for v1; nested menus later).
- `site.social` ← `Tenant.socials` (a site-wide setting on the tenant, edited in
  `/settings/general` and carried in the public tenant payload) mapped to
  `{ platform, url }[]`. Theme-independent: switching themes never changes it.

A failed fetch degrades a source to empty (the chrome renders without it) rather
than 500-ing the whole site — same defensive posture as the page loader.

## 5. Slicing

- **S0 — foundation.** `Outlet` + chrome registry entries + palette surface
  filter; `SITE_SOURCES`/`SITE_CATALOG`/`'site'` module + starter layout tree;
  `BuilderLayout` table + migration + `layoutService` — REST
  (`/v1/builder/layouts*` catalog, `/v1/public/builder/layout`) + dashboard
  api/actions; extract `useBuilderEditor` and re-point the page editor through it
  (no behavior change — verified in the browser). _(S0 shipped one layout per
  tenant; §2.3 later lifted it to a catalog with one active.)_
- **S1 — the site editor.** `/builder/site` mounts the thin site shell on the one
  layout; canvas renders the `Outlet` placeholder + chrome components against the
  site catalog; autosave + publish.
- **S2 — render.** `loadSiteData` + a site-aware render that wraps the page at the
  `Outlet`; the site root layout prefers a published Builder layout over the
  legacy chrome; chrome leaves (`NavMenu`/`Logo`/`SocialLinks`) render real markup.

## 6. Relationship to the legacy site builder

The legacy `/sitebuilder` chrome (`SiteLayoutBlock` header/footer/announcement +
`SiteVersion` snapshot) stays the **fallback** until a tenant publishes a Builder
layout. Both read the same underlying `NavigationMenu`/`TenantBrand`, so switching
a tenant over is a presentation change, not a data migration. When `/sitebuilder`
is eventually retired (its module is `site`), its chrome rendering goes with
it and the Builder layout becomes the only path. No data is duplicated in the
interim.

## 7. Deferred (not in this doc's slices)

- **Per-page layout assignment** (a layout picker on the page, target-based
  defaults) — the docs/36 SiteLayout tier. The layout **catalog + active**
  half shipped (§2.3); per-page assignment is what remains — every page still
  renders inside the single active layout.
- **Sidebar / announcement / ad-rail zones** — only header/outlet/footer in v1.
- **Nested navigation** — `loadSiteData` flattens to the top level; child items
  later.
- **Editing nav items / brand inside the site editor** — v1 references them; the
  authoring surfaces stay where they are (CMS navigation, Brand).
- **Cart / account / search chrome components** — interactive header affordances;
  static-linked for now.
