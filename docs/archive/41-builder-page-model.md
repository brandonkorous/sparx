# 41 — Builder: Page Model & Persistence

Version: 1.0
Author: Brandon Korous
Last Updated: 2026-06-02

> Implements the composition model ([40-sitebuilder-composition-model.md](../40-sitebuilder-composition-model.md))
> as a persisted, multi-page editor. Doc 40 is the _what_ (a website is a tree of
> nodes; binding cardinality drives single/scope/iterate; a typed schema is the
> keystone). This doc is the _how it's stored and saved_ — the first backend slice
> behind the UI-first `/builder` editor.

## 1. Scope of this slice

The `/builder` editor proved the composition model end-to-end in the browser, but
everything was in-memory and mock-backed: a refresh lost all work. This slice makes
the editor **dogfoodable** — pages persist, survive reload, and round-trip through a
real API — without yet taking on the heavier follow-on slices.

**In scope:** the page catalog (list / create / rename / delete / reorder), saving a
page's draft tree, and a minimal publish (snapshot draft → published).

**Explicitly deferred** (each its own later slice):

- **Real data + the schema keystone** — the binding picker still reads the mock
  `SAMPLE_DATA`; wiring real CMS/Commerce field schemas is doc 40 §5 work.
- **Rendering / routing** — there is no site consumer of `publishedTree` yet,
  and pages have no `slug`/route. Publish stores a snapshot; nothing reads it.
- **Version history** — a single `publishedTree` column, not an immutable
  `SiteVersion`-style snapshot table. History lands when rollback is needed.
- **Direct manipulation** — drag/reorder-on-canvas, inline edit.

## 2. The persisted unit — `BuilderPage`

One row per page a tenant has. A page template (doc 40) and a page instance are the
same row: sparx _ships_ a curated set as starting points, the tenant _edits_ them and
_creates_ more. There is no separate "template" entity.

| Column                    | Type         | Notes                                                                  |
| ------------------------- | ------------ | ---------------------------------------------------------------------- |
| `id`                      | uuid pk      | `gen_random_uuid()`                                                    |
| `tenantId`                | uuid         | FK → tenants, `onDelete: Cascade`                                      |
| `name`                    | varchar(255) |                                                                        |
| `kind`                    | varchar(20)  | `singleton` \| `collection`                                            |
| `recordType`              | varchar(63)? | collection only — the content type each record fills (e.g. `cms.post`) |
| `draftTree`               | jsonb        | the editable `BuilderNode` root                                        |
| `publishedTree`           | jsonb?       | last published snapshot; null until first publish                      |
| `publishedAt`             | timestamptz? |                                                                        |
| `position`                | int          | catalog ordering                                                       |
| `createdAt` / `updatedAt` | timestamptz  |                                                                        |

Tenant-scoped, **ENABLE + FORCE RLS** with the standard `tenant_isolation` policy on
`current_tenant_id()` (mirrors `sitebuilder_section_definitions`). The tree JSON is
validated by `@sparx/builder-schemas`, never by the DB.

`singleton` vs `collection` is the doc 40 page-type distinction: a singleton is one
specific page (Home, About) whose content is authored inline; a collection is one
template that renders every record of `recordType` — its nodes bind to that record's
fields and each record fills the same tree.

## 3. Package layout — mirrors the sitebuilder split

Two new packages, deliberately split the same way `@sparx/sitebuilder-schemas` and
`@sparx/sitebuilder` are. The split keeps Prisma out of the client bundle (the
editor's `'use client'` files can import the schemas package; they must never reach
the service package) and makes the eventual sitebuilder retirement a deletion rather
than a surgical extraction.

- **`@sparx/builder-schemas`** (dependency-light: `zod` only) — the canonical
  recursive `BuilderNode` Zod schema, box/layout/binding sub-schemas, the
  `CreatePageInput` / `UpdatePageInput` / `PublishPageInput` input schemas, DTO types,
  and the curated **starter page trees** (`STARTER_PAGES`). This is the single source
  of the serializable contract — the UI's `_builder/model.ts` re-uses its types so the
  shape can't drift between client and server.
- **`@sparx/builder`** (server; depends on `@sparx/db` + `@sparx/builder-schemas`) —
  `pageService` (`listOrSeed` / `get` / `create` / `update` / `remove` / `reorder` /
  `publish`), plus `errors` / `audit` / `events`, all on `withTenant()` RLS. One
  service, many transports (REST today; MCP + server actions later).

## 4. REST surface

Mounted under `/v1/builder/*`, following the sitebuilder route pattern exactly
(thin handlers; `requireRole` + a `requireBuilderModule` gate + `toBuilderContext`
bridge per request; `ok()` envelopes; a `builderErrorMapper` registered in `app.ts`).

```
GET    /v1/builder/pages          → list (auto-seeds the curated set on first call)
POST   /v1/builder/pages          → create (from a starter key or blank)
GET    /v1/builder/pages/:id      → one page
PATCH  /v1/builder/pages/:id      → rename and/or save the draft tree
DELETE /v1/builder/pages/:id      → remove
POST   /v1/builder/pages/reorder  → reorder the catalog
POST   /v1/builder/pages/:id/publish → snapshot draftTree → publishedTree
```

**Module gate:** `requireBuilderModule` gates on the existing `site` module flag.
Builder is the successor to Site Builder and shares its activation; a tenant with Site
Builder active is exactly the tenant who should reach the Builder API. This retires
together with the `site` → `builder` rename (doc 40 / `project_builder_ui_backbone`).

## 5. Seeding & the hydration win

On the first `list` for a tenant, the service seeds the curated starter set
(`STARTER_PAGES`) into `BuilderPage` rows inside one transaction — the lazy
materialization idiom already used by `getOrCreateConfig`. Idempotent: it only seeds
when the tenant has zero pages.

A useful side effect: node ids now come from the persisted trees (server → client as
props), so the editor no longer needs the module-load id-counter hack that kept SSR
and client ids aligned. The fetched data is identical on both sides by construction.

## 6. What this unblocks

With pages persisted, the next slices have somewhere to attach: the schema keystone
(real binding sources), the site render path (a consumer for `publishedTree` +
routing/slug), and version history (promote `publishedTree` to a snapshot table).
