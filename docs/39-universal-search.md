# 39 — Universal Search

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-06-01

> Companion to [22-typesense-search-spec.md](22-typesense-search-spec.md). That doc
> specifies the three **rich** collections (products, customers, orders). This doc
> specifies the **universal** collection that makes _every_ user-facing entity in
> Sparx searchable, and the registry + event plumbing that keeps adding an entity
> cheap.

---

## 1. Problem

Typesense search today covers three entities: products, customers, orders. Each is a
full vertical slice — a typed collection schema, a projection, single + bulk
indexers, reindex enumeration, real-time event wiring, a Pub/Sub topic + subscription,
a typed query function, a REST route, and dashboard wiring (~7 files + Terraform per
entity). That was the right _first_ slice (highest-value commerce/CRM data, with
fitment/price/payment faceting that a generic index can't do), but it is the wrong
way to reach the ~25 other tenant-scoped, user-facing entities the platform already
stores:

- **CMS** — content entries, pages, taxonomy, navigation, media, redirects
- **Commerce** — collections, categories, bundles, pricing, discounts, gift cards,
  warehouses/inventory, lot·serial, subscriptions, reviews, returns
- **CRM** — B2B accounts, quotes, pipelines/deals, segments, tasks, activities
- **Email** — templates, broadcasts
- **Site Builder** — layouts, saved themes, navigation

Reproducing the bespoke pattern 25× means ~25 collections and ~25 Pub/Sub
topic+subscription pairs. That does not scale, and it produces no _global_ search —
the "find anything in Sparx" command an OS should have.

## 2. Goals / non-goals

**Goals**

- One **universal collection** that any entity can project into with a uniform shape.
- Adding an entity to search = **one projector + one line post-commit**. No new
  collection, no new topic, no new subscription, no Terraform.
- A real **global ⌘K** ("search everything across Sparx"), tenant-isolated and
  module/permission-gated.
- Per-module list pages can search their own entity type against the universal index.
- The three rich collections **keep** their faceted/ranked behaviour and site
  use — universal search _coexists_, it does not replace them.

**Non-goals (v1)**

- Replacing the rich collections. Products/orders/customers keep theirs for
  fitment/price/payment faceting and site instant-search.
- Per-record ACL beyond module + role gating (see §9).
- Cross-tenant / admin-console search.

## 3. Architecture overview

```
                         (post-commit, one line)
 module service ──────────────► search.entity.changed  ──┐
   indexEntity(type, id, op)        (single Pub/Sub topic) │
                                                           ▼
                                              commerce-indexer (Cloud Run)
                                                           │
                              projector registry lookup by entity_type
                                                           │
                                  project(ctx, id) → UniversalDoc | null
                                                           ▼
                                   Typesense `entities` collection (universal)
                                                           ▲
 staff ⌘K / list pages ──► api-rest GET /v1/search/all ───┘   (tenant + module filtered)
```

Two pieces do the heavy lifting:

1. **A projector registry** — each module contributes `EntityProjector`s. The indexer
   assembles them; reindex iterates them; the event router dispatches to them.
2. **A single `search.entity.changed` event** — instead of teeing 20+ domain topics to
   Pub/Sub (a subscription explosion), every service emits one generic indexing event
   post-commit. One topic, one subscription, uniform decode.

## 4. The universal collection

Collection name: **`entities`**. Document id: `` `${tenantId}:${entityType}:${recordId}` ``
(globally unique; lets one tenant's reindex/delete scope cleanly).

```ts
export interface UniversalSearchDocument {
  id: string; // `${tenant}:${type}:${recordId}`
  tenant_id: string; // hidden isolation guard — every query MUST filter on it
  entity_type: string; // 'cms_page' | 'warehouse' | 'b2b_account' | 'quote' | …
  module: string; // 'cms' | 'commerce' | 'crm' | 'email' | 'sitebuilder'
  record_id: string; // the owning module's stable id (drives the deep link)
  title: string; // primary label (page title, account name, discount code)
  subtitle?: string; // secondary line (status, owner, sku, email)
  body?: string; // searchable snippet (CMS body text, descriptions)
  keywords?: string[]; // extra match tokens (sku, code, slug, email, phone)
  status?: string; // draft/active/archived/etc. — faceted
  url: string; // deep-link path the ⌘K hit / row navigates to
  created_at: number; // epoch seconds — sort
  updated_at: number; // epoch seconds — sort + default_sorting_field
}
```

Typesense schema (mirrors the products-schema style):

```ts
fields: [
  { name: 'tenant_id',   type: 'string', index: true, facet: false },
  { name: 'entity_type', type: 'string', facet: true },
  { name: 'module',      type: 'string', facet: true },
  { name: 'record_id',   type: 'string', index: true, facet: false },
  { name: 'title',       type: 'string', sort: true, infix: true },
  { name: 'subtitle',    type: 'string', optional: true },
  { name: 'body',        type: 'string', optional: true },
  { name: 'keywords',    type: 'string[]', optional: true },
  { name: 'status',      type: 'string', facet: true, optional: true },
  { name: 'url',         type: 'string', index: false, optional: true },
  { name: 'created_at',  type: 'int64', sort: true },
  { name: 'updated_at',  type: 'int64', sort: true },
],
default_sorting_field: 'updated_at',
token_separators: ['-', '_', '/', '.'],
```

`query_by: title, keywords, subtitle, body` (in weight order). It joins `allSchemas()`
in [packages/search/src/schemas/index.ts](../packages/search/src/schemas/index.ts) and
`collectionStats()` so the existing ensure-on-boot + status plumbing covers it for free.

### 4.1 Do the rich entities also land here?

**Yes.** Products, customers, and orders ALSO project a lightweight universal doc, so
global ⌘K is a **single query** against `entities` rather than a fan-out across four
collections. The duplication is cheap (a universal doc is ~10 small fields) and keeps
global search trivial. Their rich collections stay the source for faceted list search +
site. The indexer already projects them on their events; it adds one universal
upsert alongside.

## 5. Projector registry

```ts
export interface EntityProjector<TId = string> {
  entityType: string; // 'cms_page'
  module: string; // 'cms'
  // Enumerate this tenant's ids for a full reindex.
  listIdsForTenant(ctx: Ctx): Promise<TId[]>;
  // Project one record → universal doc, or null if it should be removed.
  project(ctx: Ctx, id: TId): Promise<UniversalSearchDocument | null>;
}
```

Projectors live in their **module package** (they need that module's Prisma reader +
domain knowledge), exactly like `projectCustomer`/`projectOrder` live in
`@sparx/commerce`. The `EntityProjector` interface + `UniversalSearchDocument` type +
the registry assembler live in `@sparx/search`. The indexer imports each module's
projector bundle and registers them by `entityType`:

```ts
const REGISTRY = buildRegistry([
  ...commerceProjectors, // @sparx/commerce
  ...crmProjectors, // @sparx/crm (re-exported via @sparx/commerce today)
  ...cmsProjectors, // @sparx/cms-*  ← new dep edge (see §11)
  ...emailProjectors, // @sparx/email-platform
  ...sitebuilderProjectors, // @sparx/sitebuilder
]);
```

Adding an entity to search becomes: **write one `EntityProjector`, register it, emit
the change event from its service.** No schema, no topic, no Terraform.

> **Dependency note ([[feedback_dockerfile_package_wiring]]):** the indexer currently
> depends on `@sparx/commerce` (+ `@sparx/crm`, `@sparx/db`). Pulling projectors from
> `@sparx/cms-*`, `@sparx/email-platform`, and `@sparx/sitebuilder` adds dependency
> edges → **every consumer Dockerfile needs the matching COPY lines and the transitive
> closure**, or `tsc`/lint pass while the image build fails. Use server-safe subpaths so
> no React/editor deps leak into the worker. Audited per phase.

## 6. Indexing pipeline

### 6.1 Real-time — one generic event

Add a single event type **`search.entity.changed`** with payload
`{ entityType: string, recordId: string, op: 'upsert' | 'delete' }`. Every service emits
it **post-commit** via a one-line helper:

```ts
await indexEntity('cms_page', page.id, 'upsert'); // after the write commits
await indexEntity('discount', id, 'delete'); // after a hard delete
```

The indexer handler gains one case:

```ts
case 'search.entity.changed': {
  const proj = REGISTRY.get(event.data.entityType);
  if (!proj) return { outcome: 'skipped' };
  if (event.data.op === 'delete') { await deleteUniversal(tenantId, type, recordId); ... }
  const doc = await proj.project(ctx, event.data.recordId);
  doc ? await upsertUniversal(doc) : await deleteUniversal(...);
}
```

One topic (`search.entity.changed`) + one commerce-indexer subscription in Terraform —
versus 20+ topic/subscription pairs. New entities reuse it.

> Products/customers/orders keep their existing real-time path (already wired); they
> additionally get a universal upsert inside their existing handler branches. They do
> **not** need the generic event.

### 6.2 Backfill — registry-driven reindex

`runReindex` already iterates collections. It gains an `entities` pass that walks the
**registry**: for each projector, `listIdsForTenant` → `project` in 500-id chunks →
`bulkUpsertUniversal`. `dropStale` wipes the tenant's universal docs first. So a single
`POST /v1/search/reindex` repopulates everything.

### 6.3 The CMS gap

Commerce, CRM, email, and sitebuilder services **already publish domain events**, so
adding the `indexEntity()` call alongside is trivial. **CMS does not emit domain events
yet.** Two options, in order of preference:

1. Add `indexEntity()` calls at the CMS content/page/navigation write sites (small,
   localized — same as everywhere else). _Preferred._
2. Reindex-only for CMS in v1 (searchable but not live until a manual/scheduled
   reindex), with event wiring as a fast-follow.

## 7. Entity inventory & taxonomy

`entity_type` values (v1 target). Grouped by `module`; **R** = also has a rich
collection.

| module      | entity_type          | title / keywords       | url                           |
| ----------- | -------------------- | ---------------------- | ----------------------------- |
| commerce    | `product` **R**      | title / skus           | `/commerce/products/:id`      |
| commerce    | `collection`         | title / handle         | `/commerce/collections/:id`   |
| commerce    | `category`           | name                   | `/commerce/categories/:id`    |
| commerce    | `bundle`             | name / sku             | `/commerce/bundles/:id`       |
| commerce    | `discount`           | code / name            | `/commerce/discounts/:id`     |
| commerce    | `gift_card`          | code                   | `/commerce/gift-cards/:id`    |
| commerce    | `warehouse`          | name / code            | `/commerce/warehouses/:id`    |
| commerce    | `subscription`       | customer / plan        | `/commerce/subscriptions/:id` |
| commerce    | `review`             | title / product        | `/commerce/reviews/:id`       |
| commerce    | `return`             | rma # / order          | `/commerce/returns/:id`       |
| crm         | `customer` **R**     | name / email / company | `/crm/customers/:id`          |
| crm         | `order` **R**        | order # / customer     | `/crm/orders/:id`             |
| crm         | `b2b_account`        | account name / domain  | `/crm/b2b/:id`                |
| crm         | `quote`              | quote # / customer     | `/crm/quotes/:id`             |
| crm         | `pipeline` / `deal`  | name / customer        | `/crm/pipelines/:id`          |
| crm         | `segment`            | name                   | `/crm/segments/:id`           |
| crm         | `task`               | title / assignee       | `/crm/tasks/:id`              |
| cms         | `cms_page`           | title / slug           | `/cms/pages/:id`              |
| cms         | `cms_content`        | title / body           | `/cms/content/:id`            |
| cms         | `navigation`         | name                   | `/cms/navigation/:id`         |
| email       | `email_template`     | name / subject         | `/email/templates/:id`        |
| email       | `email_broadcast`    | name / subject         | `/email/broadcasts/:id`       |
| sitebuilder | `sitebuilder_layout` | name                   | `/sitebuilder/layouts/:id`    |
| sitebuilder | `sitebuilder_theme`  | name                   | `/sitebuilder/...`            |

Config-ish data (pricing rules, tax/shipping settings, raw cart rows) is **excluded** —
not something a human searches by name.

## 8. API surface

- `GET /v1/search/all?q=&modules=&types=&page=&per_page=` — universal search. `requireRole('viewer')`,
  tenant from auth ctx, **filtered to the tenant's enabled modules** (§9). Returns hits
  with `{entity_type, module, title, subtitle, url, status}` + facet counts by
  `module` / `entity_type`.
- `GET /v1/search` (palette / ⌘K) — re-pointed to query `entities` and group hits by
  module/type (replaces the current 3-collection fan-out; richer + uniform).
- `GET /v1/search/entities?type=<entityType>&q=` — per-list-page search of a single
  universal type (used by list pages whose entity has no rich collection).
- Existing `/v1/search/products|customers|orders` unchanged (rich, faceted).

## 9. Module + permission gating

A search hit must never leak across a boundary:

- **Module gating** — the route filters `filter_by: module:[<tenant's enabled modules>]`
  at query time (the route already knows the tenant's modules). Robust even if a stale
  doc lingers after a module is disabled. (Belt-and-suspenders: the `indexEntity`
  consumer can also gate, mirroring CRM's `gateHandler`.)
- **Role gating** — `requireRole('viewer')` on the route; the dashboard surfaces it only
  to staff. Per-record ACL is out of scope v1 (most dashboard entities are visible to any
  staff with the module).
- **Tenant isolation** — every query forces `tenant_id:=<t>` via the wrapper, identical
  to the rich collections. Never call the raw client from a route.

## 10. Dashboard integration

- **Global ⌘K** — `searchEntities()` ([apps/dashboard/.../\_components/search-action.ts](<../apps/dashboard/app/(dashboard)/_components/search-action.ts>))
  re-points to `/v1/search/all`, grouping hits by module with the doc's `url` as the
  href. "Find anything" across the platform.
- **List pages** — pages whose entity has a rich collection keep using it
  (products/customers/orders — already wired). Pages backed only by the universal index
  (warehouses, discounts, b2b, quotes, …) gain the same `if (q) → /v1/search/entities?type=…`
  branch as the orders showcase.

## 11. Phased rollout (deploy-early, one shippable slice each)

- **Phase 1 — foundation + first projectors.** Universal schema + registry + `UniversalSearchDocument`
  - `search.entity.changed` event + indexer dispatch + registry-driven reindex pass +
    `GET /v1/search/all` + global ⌘K re-point. Projectors for **warehouses, b2b_accounts,
    discounts, gift_cards, quotes** (commerce/crm — already emit events). Reindex → live.
- **Phase 2 — breadth.** Remaining commerce/crm projectors (collections, categories,
  bundles, subscriptions, reviews, returns, segments, pipelines/deals, tasks) + email
  (templates, broadcasts) + sitebuilder (layouts, themes) + their `indexEntity()` calls.
  Rich entities (product/customer/order) start writing universal docs too.
- **Phase 3 — CMS + list-page wiring.** CMS projectors + `indexEntity()` at CMS write
  sites (closes the §6.3 gap); per-list-page `?q=` wiring for universal-only entities.

Each phase: full-tree typecheck/lint/format/RLS green via the pre-push guard, deploy via
auto-tag → build → deploy-prod, then a per-tenant reindex to backfill new types.

## 12. Open decisions

1. **Generic event vs. tee** — this doc proposes the single `search.entity.changed`
   topic (§6.1). Confirm we do _not_ want per-domain topics teed (the rejected
   alternative: 20+ topic/subscription pairs).
2. **Rich entities duplicated into `entities`** (§4.1) — confirm yes (single global
   query) vs. fan-out across 4 collections at query time.
3. **CMS** — `indexEntity()` at write sites now (preferred) vs. reindex-only in v1.
4. **`body` indexing depth** — full CMS body text raises index size; cap snippet length
   (e.g. first ~2 KB) to keep the index lean. Proposed: cap.
5. **Naming** — collection `entities` and event `search.entity.changed`. Bikeshed-OK.
