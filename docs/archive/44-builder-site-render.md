# 44 — Builder: The Site Render Path

Version: 1.0
Author: Brandon Korous
Last Updated: 2026-06-02

> The Builder ([40](../40-sitebuilder-composition-model.md)) lets a tenant compose a
> page as a node tree; persistence ([41](41-builder-page-model.md)) stores it;
> the keystone ([43](43-builder-binding-schema.md)) tells the editor what it can
> bind to. This doc closes the loop: a **published** Builder page actually SERVES
> on the site at a URL, resolving its bindings against REAL records. Until
> now `published_tree` had no consumer ([41](41-builder-page-model.md) §1) — this
> is that consumer.

## 1. The problem

Publishing snapshots `draft_tree → published_tree` and emits `builder.page.published`,
but nothing renders it. We need:

1. **Addressing** — a URL a published page lives at. Builder pages have no slug.
2. **A public read** — the site fetches published trees without auth.
3. **A renderer** — walks the node tree → production markup (not editor chrome),
   in the tenant brand.
4. **Binding resolution** — bound nodes resolve against real CMS/Commerce/CRM
   records, iterating arrays per the composition model.

## 2. Decisions

**2.1 Addressing — a `slug` on `BuilderPage` (singletons only).**
A `singleton` page (Home, About) gets an optional `slug`; it serves at `/{slug}`.
A `collection` page (Product page, Blog post) has NO slug — it's a template that
renders PER RECORD at the record's own route (Slice B). `slug` is nullable +
unique-per-tenant (Postgres treats NULLs as distinct, so many slugless/collection
pages coexist). The Home page's takeover of the site root `/` is deferred
(Slice B) — the commerce homepage is sensitive; we don't risk it in slice one.

**2.2 Public endpoint — its own route, reading `builder_pages`.**
Builder pages live in their own table (not CMS `content_entries`), so they need
their own read:

```
GET /v1/public/builder/page  ?tenant=<tenantSlug>&slug=<pageSlug>
  → { name, slug, recordType, tree, publishedAt }   (published_tree, published only)
  → 404 when no published page has that slug
```

Mirrors `/v1/public/content/*`: no auth (`/v1/public/` is an auth-exempt prefix),
tenant resolved by slug (the only non-RLS table), then an RLS-scoped read via
`withTenant`. Preview-token (draft) access layers on later, like content.

**2.3 The renderer — site-owned, model + resolver shared.**
A site **server component** `BuilderRenderer` walks the tree → semantic
production markup. It is DISTINCT from the editor canvas: no selection chrome, no
fixed preview heights, real `<img>`/prices/text. What's shared with the editor:

- the node **model** — already in `@wizeworks/builder-schemas`.
- binding **resolution** — `resolvePath` / `cardinalityOf` are PROMOTED from the
  dashboard's `_builder/model.ts` into `@wizeworks/builder-schemas` (a `runtime.ts`),
  so editor and site resolve bindings through ONE implementation. No drift
  on the core semantic.

The box-base → CSS mapping is reimplemented for production (it maps to the live
`--st-*` tokens, where the editor maps to `--bxc-*`). When a second renderer
consumer appears (email), extract a `@wizeworks/builder-render` package; not yet.

**2.4 Theming — reuse the site's `--st-*` contract.**
The renderer emits the same surface / spacing / width / height semantics as the
editor canvas, mapped to the site's existing `--st-*` custom properties
(injected by the root layout's `buildThemeCss`). No new token injection — a
Builder page inherits the tenant theme exactly like every other site page.

**2.5 Routing — additive, Builder wins its own slug.**
In `/[...slug]`, look up a published Builder page FIRST. If one exists → render it
(it owns the slug). Otherwise → the existing Site-Builder-sections + CMS-page merge,
unchanged. Existing live pages have no Builder page at their slug, so they are
untouched; a new Builder page lights up its slug. Safe + reversible.

## 3. Slicing (deploy small)

- **A.1 — static render (this slice).** `slug` column + public endpoint +
  `BuilderRenderer` (containers + static leaves: Heading/Text/Image/Button/Divider
  rendering their props) + `/[...slug]` wiring + a slug field in the editor. Proof:
  publish **About** with slug `about` → `/about` serves it live, in the tenant
  brand. NO data fetching yet (the About starter is all static content).
- **A.2 — binding resolution.** For each source the tree binds to, fetch real
  records via the existing public endpoints (CMS entries, commerce products, CRM
  list), build the `root` data object (the real-data analogue of the editor's
  `buildPreviewData`), and resolve `item.*` / iteration through the shared
  resolver. Proof: a Home-style page renders real blog posts + products.
- **B — collection templates + root + polish.** `collection` pages rendering
  per-record at `/products/[handle]` and `/blog/[slug]` (merging with the existing
  commerce PDP / CMS routes); the Home page owning `/`; preview tokens; cache tags
  - revalidation on publish.

## 4. Where the code lives

- **`@wizeworks/builder-schemas`** — `slug` on `BuilderPageDto` + `Create`/`Update`
  inputs; a `PublishedPageDto`; `runtime.ts` (`resolvePath`/`cardinalityOf`).
- **`@wizeworks/builder`** — `pageService`: `slug` in `toDto`/`create`/`update`;
  `getPublishedBySlug(ctx, slug)`.
- **api-rest** — `routes/v1/public/builder.ts` → `GET /v1/public/builder/page`.
- **site** — `lib/builder.ts` (`getPublishedBuilderPage`) +
  `components/builder-renderer.tsx` + `/[...slug]/page.tsx` wiring.
- **dashboard editor** — page-settings (slug) in the inspector's no-selection
  state + a `setPageSlug` action.
