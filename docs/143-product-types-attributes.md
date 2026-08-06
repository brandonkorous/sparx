# 143 — Product Types & Typed Attributes

Version: 0.2 (plan / not yet built)
Author: Brandon Korous
Last Updated: 2026-08-06

> **Status: PROPOSED.** This is the implementation plan for giving products a typed
> attribute system — the commerce mirror of CMS content types. Nothing here is built yet.

---

## 1. Why this exists

The reference-driven site templates (`marketplace-catalog/_gen/gen-template-*.ts`) ship a
bespoke product-detail page (PDP) whose "Performance & fit", "Fabric & construction", "Care",
and "Shipping & returns" sections are **hardcoded static strings** — byte-identical on a cotton
cap and a waterproof shell. A cap that reads "compressive Italian fabric, bonded hems, laser-cut
leg grippers" is nonsense. `pdpDetail(label, body)` in each generator bakes product-specific copy
into the node tree, and the storefront exposes no per-product field to bind it to instead
(`BuilderProduct` / `productToSilicaRecord` carry only `title`, `price`, `image`, `description`,
`compareAtPrice`, `variantId`, `url`).

Hardcoding **anything product-specific** is wrong, full stop. But the deeper reason it's wrong is
structural: **there is no universal set of product detail fields.** A donut shop needs
ingredients and allergens; a diesel-parts distributor needs fitment and torque specs; an apparel
brand needs fabric and care; a coffee roaster needs origin and roast. sparx is industry-agnostic
by design (root `CLAUDE.md` — "selling is one capability, never the assumption; a CMS-only
publisher, a CRM-only team, and a B2B distributor are all equally first-class"). A fixed product
detail schema contradicts that as surely as a fixed content schema would.

The CMS already solved this exact problem for content. **Products should solve it the same way.**

## 2. The model — mirror content types, but only the attribute layer

### 2.1 The parallel

CMS content works because a **type declares a field schema** and every **entry fills it +
validates against it**:

| CMS (today)                                                                                | Product (this plan)                                                                   |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `ContentType.schemaJson` — the field schema (`11-cms-content.prisma:22`)                   | `ProductType.attributeSchema`                                                         |
| `ContentType.isBuiltIn` + fork-on-edit + platform-tenant seed                              | same                                                                                  |
| `ContentEntry.typeKey` (string key, not FK; `resolveType` lookup)                          | `Product.productTypeKey`                                                              |
| `ContentEntry.body` — validated JSON bag (`11-cms-content.prisma:52`)                      | `Product.attributes`                                                                  |
| silica binds `item.<fieldKey>` by spreading `body` (`toSilicaEntry`, `silica-data.ts:214`) | silica binds `item.attributes.<fieldKey>` by spreading `attributes`                   |
| builder picker surfaces the type's fields via `mapCmsContentType` (`binding.ts:153`)       | `mapProductType` emits the type's attribute fields into the same catalog              |
| a CMS collection template targets ONE type (`recordType` = the type)                       | a product page can target `commerce.product` **filtered by `productTypeKey`** (§6.10) |
| free-text `type_key`                                                                       | existing free-text `productType` stays (merchandising label/facet)                    |

### 2.2 The one distinction that governs the whole design

**A content entry _is_ its type's fields.** A blog post is basically title + body + excerpt +
featuredImage — its schema is the whole record.

**A product is not.** A product already carries a large **fixed commerce spine** — variants,
options, prices, inventory, images, shipping defaults, SEO, reviews, fitments
(`30-commerce-products.prisma:14-108`). That spine must **not** become type-defined. So the model
is:

> Keep the fixed product spine exactly as it is. Add a **typed attribute layer** on top, governed
> by the product's type. The type owns only the variable descriptive attributes; the commerce
> mechanics are untouched.

This is the Shopify "metafield definitions / product taxonomy" shape, and it is the correct
long-term foundation: attributes become consistent within a type, bindable on the PDP, and
(future) filterable as facets.

### 2.3 Non-goals

- Products do **not** become content-typed documents. `title`, `description`, `handle`, pricing,
  variants, images, SEO stay first-class columns — never attributes.
- No change to variants / options / inventory / fitments / reviews.
- This plan does **not** add attribute-based faceted search (a natural follow-up; the data model
  leaves room for it).

## 3. The field-schema engine — reuse, don't rebuild

`@sparx/cms-schemas` `src/types.ts` + `src/validate.ts` are **product-agnostic**: the 15 field
kinds (`text`, `long_text`, `rich_text`, `slug`, `number`, `boolean`, `date`, `datetime`, `enum`,
`url`, `email`, `reference`, `asset`, `object`, `repeater`) and `bodyValidatorFor(schema)` just
validate "does this JSON bag match this field list." Zero CMS coupling.

**Decision — extract to a neutral package `@sparx/field-schema`.** Move `FieldDef`,
`FieldSchema` (today's `ContentTypeSchema` = `{ fields: FieldDef[] }`), `bodyValidatorFor`, and
`validateBody` into `@sparx/field-schema`. `@sparx/cms-schemas` re-exports them unchanged
(`export { FieldSchema as ContentTypeSchema, ... }`) so **no CMS code changes behaviorally**.
`@sparx/commerce-schemas` consumes the same engine for `ProductTypeSchema`. One engine, two
domains — the "single point of change" rule (root `CLAUDE.md` RULE #1) applied to the field
system itself.

_Fallback if extraction proves risky:_ `commerce-schemas` imports the vocabulary directly from
`cms-schemas` (acyclic today). Correct-but-slightly-mislocated; the extraction is preferred.

## 4. Data-model changes

### 4.1 New model — `ProductType` (mirrors `ContentType`)

`packages/db/prisma/schema/30-commerce-products.prisma`:

```prisma
model ProductType {
  id         String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId   String  @map("tenant_id") @db.Uuid
  propertyId String? @map("property_id") @db.Uuid   // null = available to every site

  key             String  @db.VarChar(63)           // e.g. "apparel", "coffee"
  name            String  @db.VarChar(127)          // "Apparel"
  pluralName      String? @map("plural_name") @db.VarChar(127)
  description     String? @db.Text
  attributeSchema Json    @map("attribute_schema")  // FieldSchema { fields: FieldDef[] }
  icon            String? @db.VarChar(63)
  isBuiltIn       Boolean @default(false) @map("is_built_in")

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz

  tenant   Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  property Property? @relation(fields: [propertyId], references: [id], onDelete: Cascade)

  @@unique([tenantId, key], map: "product_types_tenant_key_unique")
  @@index([tenantId])
  @@map("commerce_product_types")
}
```

### 4.2 Product columns

Add to `model Product`:

```prisma
  productTypeKey String? @map("product_type_key") @db.VarChar(63)  // → ProductType.key (resolveType)
  attributes     Json    @default("{}")                            // validated against the type's schema
```

- `productType` (existing free-text) is **kept** as the merchandising label / collection-rule
  facet. `productTypeKey` is the new typed-schema link. They may converge later; keeping them
  separate now is backward-compatible (faceting, `collection-rules.ts` `product_type` predicate,
  Google-Shopping adapter all keep working untouched).
- `metadata` (existing untyped JSON) is **unchanged** — it stays the raw escape hatch;
  `attributes` is the typed, validated, schema-backed bag.

### 4.3 Migration `20270206000000_product_types_attributes`

Monotonic after the current newest `20270205000000_stored_credential_chain` (packages/db
`CLAUDE.md` — names are the sort key; must sort after the max). Contents:

1. `CREATE TABLE commerce_product_types (...)` + indexes.
2. `ALTER TABLE commerce_products ADD COLUMN product_type_key varchar(63), ADD COLUMN attributes jsonb NOT NULL DEFAULT '{}'`.
3. **RLS** (hand-edited, not Prisma-generated — packages/db `CLAUDE.md`): `ENABLE` + `FORCE ROW
LEVEL SECURITY` + `tenant_isolation` policy on `commerce_product_types` using
   `current_tenant_id()`. Built-ins live under the platform sentinel tenant and are RLS-visible
   to all tenants (same mechanism as content types — visible via the policy, forked on edit).
   `commerce_products` already has RLS; the two new columns need no backfill (defaults cover
   every existing row, so no FORCE-RLS per-tenant loop — the footgun in packages/db `CLAUDE.md`
   §RLS doesn't apply here).
4. **Seed built-in product types** (§5) via `INSERT ... ON CONFLICT DO UPDATE`, mirroring
   `20260528100100_seed_builtin_content_types/migration.sql`.

### 4.4 `builder_pages` targeting column (per-type product pages)

A product PAGE (a `commerce.product` collection template) can target a specific product type.
Add to the builder page model (`packages/db/prisma/schema/*builder*` — `builder_pages`):

```prisma
  recordSubtype String? @map("record_subtype") @db.VarChar(63)  // e.g. product type key "apparel"
```

- On a `recordType = 'commerce.product'` page, `recordSubtype = 'apparel'` makes it the **Apparel
  product page**; `recordSubtype = null` is the **default** product page (renders any product with
  no more-specific page). The existing `isDefault` still marks the fallback per record type.
- Nullable, backward compatible: every existing PDP is `recordSubtype = null` (the default), so
  nothing changes until a tenant authors a type-specific page. Included in migration
  `20270206000000` (same migration adds this column).

## 5. Built-in product types (the starter set)

Defined as `ProductTypeDefinition`s in `packages/commerce-schemas/src/product-types/builtins/`
(one file each), exported as `BUILT_IN_PRODUCT_TYPES`, seeded under the platform sentinel tenant
(reuse `PLATFORM_TENANT_ID = '00000000-…-0000'`). Every attribute below is a real `FieldDef`.

| key             | name                   | attributes (field kinds)                                                                                                                | covers templates                                                            |
| --------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `apparel`       | Apparel                | `fabric` (long_text), `care` (long_text), `fit` (long_text), `materials` (repeater: name/percent), `origin` (text)                      | bold-athletic, catalog-dense, couture-serif, natural-clean, playful-mission |
| `cosmetics`     | Beauty & Personal Care | `keyIngredients` (long_text), `fullIngredients` (long_text, INCI), `howToUse` (long_text), `skinType` (enum, multiple), `volume` (text) | beauty-counter, luxe-minimal                                                |
| `food_beverage` | Food & Beverage        | `ingredients` (long_text), `allergens` (enum, multiple), `netWeight` (text), `storage` (long_text), `nutrition` (repeater: label/value) | warm-subscription                                                           |
| `home_goods`    | Home & Objects         | `materials` (long_text), `dimensions` (text), `care` (long_text), `origin` (text)                                                       | editorial-grid                                                              |
| `electronics`   | Electronics            | `specs` (repeater: label/value), `inTheBox` (long_text), `connectivity` (long_text), `warranty` (long_text)                             | tech-cinematic                                                              |
| `general`       | General                | `details` (repeater: label/body) — the flexible fallback                                                                                | any                                                                         |

`auto_part` (Fitment / Specs / Warranty) ships too, for the Gillett/diesel vertical, though no
current template uses it. Tenants add their own via the field-builder (§8) — this set is the
starting vocabulary, not a ceiling.

## 6. Layer-by-layer changes

### 6.1 `@sparx/field-schema` (new)

Move `FieldDef` / `FieldSchema` / `bodyValidatorFor` / `validateBody` out of `cms-schemas`.
`cms-schemas` re-exports for back-compat. (§3.)

### 6.2 `@sparx/commerce-schemas`

- `src/product-types/schema.ts` — `ProductTypeSchema` = `FieldSchema`; `ProductTypeDefinition`
  (key/name/pluralName/description/attributeSchema/icon).
- `src/product-types/builtins/*` + `index.ts` (`BUILT_IN_PRODUCT_TYPES`).
- `src/products.ts` — add `productTypeKey?: string` + `attributes?: Record<string, unknown>` to
  the product create/update inputs (`products.ts:224,280`). Attribute validation happens in the
  service against the resolved type schema (not statically here).

### 6.3 `@sparx/commerce` — product-types service

- `src/services/product-types-service.ts` — mirror `packages/cms/src/content-types-service.ts`:
  `list` (dedupe by key, tenant shadows built-in), `get`, `create`, `replaceSchema` (fork-on-edit
  of a built-in → tenant-owned copy), `delete` (custom only). Plus the trio from
  `content-types.ts`: `resolveType(tx, key)`, `parseProductTypeSchema(row)`,
  `validateAndNormalizeAttributes(schema, attributes)` (reusing `@sparx/field-schema`
  `bodyValidatorFor`).
- `src/services/product-service.ts` `create` / `update` — when `productTypeKey` is set, resolve
  the type and `validateAndNormalizeAttributes` before persisting `attributes` (422 on mismatch,
  exactly like `entries-service.ts`).

### 6.4 `services/api-rest`

- `routes/v1/commerce/product-types.ts` (new) — `GET /v1/commerce/product-types`,
  `GET :key`, `POST` (role `editor`), `PUT :key/schema` (fork-on-edit), `DELETE :key`. Mirrors
  `routes/v1/content/types.ts`.
- `routes/v1/commerce/products.ts` — accept `productTypeKey` + `attributes` on write.
- `routes/v1/public/commerce.ts` — `fullProductSelect` (`:1170`) add `productTypeKey`,
  `attributes`; `mapFullProduct` (`:1256`) pass them through. The public payload also needs the
  **resolved attribute schema** so the storefront can render each attribute with its human label
  and kind — either (a) resolve the type per product in the route and attach
  the resolved attributes, or (b) resolve client-side. **Decision: (a)** — the route resolves the
  type once and attaches BOTH shapes (a `repeat` needs an array, an individual `attributes.<key>`
  bind needs a keyed object — the same key can't be both, §7):
  - `attributes: Record<fieldKey, string>` — resolved display value per field, for **individual
    binding** (`commerce.product.attributes.fabric`).
  - `attributeSections: { key, label, value }[]` — ordered by the type's field order, for the
    **auto-render repeat**.
    Both derive from the resolved type schema + the product's `attributes` bag; the storefront never
    needs the schema separately.

### 6.5 Storefront projection

- `apps/site/lib/commerce.ts` — `PublicProduct` gains `attributes: Record<string, string>` +
  `attributeSections: { key; label; value }[]` (§6.4).
- `apps/site/lib/silica-data.ts` `productToSilicaRecord` (`:147`) — add both `attributes` (keyed)
  and `attributeSections` (ordered) to the returned record so the PDP binds individual fields AND
  the auto-render repeat resolves (this is the single in-scope `product` record the silica PDP
  resolves against). List cards (`toSilicaProduct`, `:108`) don't need them.
- `apps/site/lib/builder-commerce-data.ts` `productToBuilderRecord` (`:36`) +
  `packages/builder-render/src/commerce-types.ts` `BuilderProduct` — add `attributes` for the
  legacy builder-render path (parity so the editor canvas resolves the same keys).

### 6.6 Silica PDP kit — `marketplace-catalog/_gen/template-sites/pdp.ts`

- `pdpAttributes(opts)` — **new**. Repeats over the in-scope `attributeSections` array
  (`repeat(section, 'attributeSections')` + `bind(label,'label')` / `bind(body,'value')`), so each
  template renders its product's real typed attributes as labeled sections, styled by the
  template's own classes. Replaces every hardcoded `pdpDetail(label, body)` call. `visibleWhen` so
  an empty section list renders nothing. (This is the auto-render floor; per-type pages bind
  individual `attributes.<key>` — §6.10.)
- `pdpPolicyLinks(opts)` — **new**. A short trust line linking to the store's real
  `/shipping-policy` + `/returns-policy` legal pages (`packages/legal-templates` `LegalKind`
  `shipping` / `returns`; slugs `shipping-policy` / `returns-policy`). No fabricated policy copy.
- `pdpStockBadge(opts)` — **new**. A real low-stock signal bound to inventory
  (`variants[].inStock` / `available`; add `lowStock` to the product read cols exposed — §6.4),
  shown only when genuinely low. Replaces the fake "Selling fast" + countdown
  (`gen-template-catalog-dense.ts` `pdpDeliveryUrgency` / `saleCountdown` are **deleted**).

### 6.7 Workbench

- `apps/workbench/surfaces/commerce/product-type-detail.tsx` (new) + `product-types-list.tsx` +
  `product-types-data.ts` — the **field-builder editor**, adapted (rebuilt, per workbench
  `CLAUDE.md` "build it, don't port it") from `cms/content-type-detail.tsx` + its
  `content-types-data.ts` draft/wire mirror. Built-ins render view-only; editing forks.
- `apps/workbench/surfaces/commerce/product-detail.tsx` — add a **product-type picker** and a
  **schema-driven attribute form** (adapted from `cms/schema-form.tsx`) that renders one control
  per attribute field. Registry + nav wiring for the new surfaces.
- `apps/workbench/surfaces/builder/studio/page-settings.tsx` — add the **product-type target** on
  a `commerce.product` page (sets `recordSubtype`, narrows the field picker to that type). The
  binding-catalog wiring that feeds the picker (`mapProductType` → `dataSources()`) and the canvas
  preview data (`preview-data.ts`) are §6.10.

### 6.8 Blueprint plumbing

- `packages/blueprints/src/manifest.ts` — the product decl gains `productTypeKey?` + `attributes?`;
  a new top-level `productTypes?: ProductTypeDecl[]` (a blueprint can ship its own product
  type(s) with an attribute schema, exactly as it ships content).
- `services/api-rest/src/lib/blueprint-installer.ts` — install `productTypes` (upsert by
  `(tenant, key)`) before products; on each product, set `productTypeKey` and
  `validateAndNormalizeAttributes` before persisting `attributes`.
- `services/api-rest/src/lib/blueprint-updater.ts` — `productType` KindHandler (create/update on
  the three-way merge), so a blueprint update can add/adjust a type + attributes non-destructively.

### 6.9 The 10 templates

Each `gen-template-<slug>.ts`:

1. Declare the template's product type(s) in the spec (`productTypes: [...]`) — usually one
   built-in key reused, or a bespoke type with the attribute schema the vertical needs.
2. Every product in `COMMERCE.products` sets `productTypeKey` and fills real `attributes`
   (per-product fabric/care/fit, ingredients/allergens, specs, …). This is genuine content
   authoring — a cap's care ≠ a jacket's care.
3. The PDP swaps its `pdpDetail(...)` stack for `pdpAttributes(...)` + `pdpPolicyLinks(...)`
   (+ `pdpStockBadge` where a scarcity block existed). Shipping/returns is no longer reprinted;
   it links the real policy pages.
4. Remove `pdpDeliveryUrgency` / `saleCountdown` from catalog-dense.

Templates → types (§5): bold-athletic/catalog-dense/couture-serif/natural-clean/playful-mission
→ `apparel`; beauty-counter/luxe-minimal → `cosmetics`; warm-subscription → `food_beverage`;
editorial-grid → `home_goods`; tech-cinematic → `electronics`.

### 6.10 Per-type product pages & builder binding — the authoring capability

This is the half that makes typed attributes usable by a **tenant in the builder**, not just by
the first-party templates. Without it, `pdpAttributes` only auto-renders every attribute in a
fixed stack; the tenant cannot place _this product's Fabric here, its Care there_ on their own
layout. The mechanism already exists for content and is copied for products.

**The asymmetry to resolve.** The builder's field picker is driven by ONE catalog
(`BindingCatalog.sources` → `toSilicaDataSources`, `silica-data-sources.ts`). Today the CMS
sources are **dynamic** — `mapCmsContentType(ct)` (`binding.ts:153`) turns each tenant content
type's schema into a `DataSource` whose `fields` are the type's fields, so a `blog_post` page's
picker shows `cms.blog_post.excerpt` etc. The commerce product source is **static** — one
`PRODUCT_FIELDS` const (`binding.ts:179`) reused across every product source, no attributes. A
CMS template also targets exactly ONE type, so its field set is unambiguous; a `commerce.product`
PDP serves EVERY product across many types. Option B resolves both: **a product page is scoped to
a product type, exactly like a CMS template is scoped to a content type.**

**(a) `mapProductType` — dynamic fields in the picker.** New in `binding.ts`, mirroring
`mapCmsContentType`: given a `ProductType`, emit a `DataSource` for `commerce.product` scoped to
that type whose `fields` = `PRODUCT_FIELDS` **plus** an `attributes` group whose nested fields are
the type's attribute schema (`attributes.fabric`, `attributes.care`, …). Built per tenant from
their product types (the same place the catalog already calls `mapCmsContentType`). The picker,
`scopeAt`, and the resolver all agree on `commerce.product.attributes.<key>` — the exact ref
`productToSilicaRecord` now resolves (§6.5), so picker → engine → storefront share one vocabulary,
same as content.

**(b) Per-type page routing.** A product page carries `recordSubtype = <productTypeKey>` (§4.4).
Resolution, most-specific-wins:

- Storefront PDP (`apps/site/app/products/[handle]/page.tsx:101`) already passes the product id to
  `getPublishedSilicaCollection(site, 'commerce.product', product.id)`. That resolver
  (`silica.ts:290`) + its api-rest endpoint (`/v1/public/builder/silica/collection`) gain the
  product's `productTypeKey` and pick the published page `WHERE recordType='commerce.product' AND
(recordSubtype = <type> OR recordSubtype IS NULL) ORDER BY (recordSubtype IS NOT NULL) DESC` —
  the type-specific page if the tenant made one, else the default PDP. No change for tenants who
  never make a per-type page.
- The builder studio (`apps/workbench/surfaces/builder/studio/page-settings.tsx`) gains a
  **product-type target** on a `commerce.product` page ("this page designs: All products / Apparel
  / Beauty …"). Choosing a type sets `recordSubtype` AND narrows the field picker to that type's
  attributes (via the `mapProductType` source for that type). Preview data (`preview-data.ts`
  `buildRecord`) shapes a placeholder product of that type so every offered `attributes.<key>`
  resolves on the canvas.

**(c) The default page still auto-renders.** The seeded default PDP (`recordSubtype = null`) uses
`pdpAttributes` (repeat over `attributeSections`) so ANY product — any type, or none — renders its
attributes with zero authoring. A tenant who wants bespoke control adds a per-type
page and binds individual `attributes.<key>` fields wherever they want. Auto-render is the floor;
per-type binding is the ceiling.

## 7. Binding contract

The PDP's in-scope `product` record gains `attributeSections: [{ key, label, value }]` (ordered by
the type's field order) AND `attributes: { <key>: value }` (keyed). A template auto-renders with:

```
repeat(section, 'attributeSections')     // one section per attribute
  bind(labelEl, 'label')                 // "Fabric & construction"
  bind(bodyEl, 'value')                  // this product's real value
```

`value` is the resolved display value (string for text/long_text/rich_text; joined for
enum-multiple; a nested list for repeater — rendered by a sub-repeat). Missing/empty attributes
render nothing (`visibleWhen`). No field keys are hardcoded in the template — the template renders
whatever the product's type defines, which is the entire point.

**Two binding modes, both real (§6.10):**

- **Auto-render (the default page):** `repeat(section, 'attributes')` above — renders every
  attribute the product has, no field keys named. Works for any product of any type.
- **Individual binding (a per-type page):** the picker offers `commerce.product.attributes.<key>`
  for the page's targeted type, so a tenant binds a specific field to a specific element —
  `bind(fabricPanel, 'attributes.fabric')` placed wherever the layout wants it. The record also
  carries the flat `attributes.<key>` values (not only the ordered list) so a single-field bind
  resolves. Both modes read the same `attributes` on the in-scope product record; the difference
  is repeat-all vs. name-one.

## 8. Backward compatibility & rollout

- Existing products (no `productTypeKey`) → no attributes → PDP renders none. Fully backward
  compatible; nothing breaks.
- `productType` (free-text) untouched → faceting / collection rules / channel adapters unchanged.
- Built-in types seed idempotently on migrate; api-rest already self-registers marketplace
  content on boot — the blueprint product types install per-tenant at install time.
- No prod data backfill required.

## 9. Testing & validation

- Unit: `@sparx/field-schema` validator round-trips (reuse existing cms-schemas validate tests as
  the template); `validateAndNormalizeAttributes` 422s on a bad bag.
- `safeParseBlueprint` + `blueprint-sweep.test.ts` green for all 10 regenerated bundles.
- Storefront smoke: a product of type `apparel` renders its own fabric/care/fit; a different
  product renders different values; a product with no type renders no attribute block; the
  shipping/returns line links `/shipping-policy` + `/returns-policy`; the low-stock badge appears
  only when inventory is genuinely low.
- `pnpm typecheck` + `pnpm lint` clean across touched packages **after the user regenerates the
  Prisma client** (new `ProductType` model + product columns don't typecheck until
  `prisma generate` runs — that is the user's step; packages/db `CLAUDE.md` + the
  wait-for-DB-impact rule. New-model code not compiling until then is expected).

## 10. Build order (dependency-ordered phases)

1. **Field-schema extraction** — `@sparx/field-schema`; cms-schemas re-exports. Verify CMS still
   builds.
2. **Schema + migration** — `ProductType` model, product columns, migration (RLS + built-in
   seed). _User regenerates Prisma._
3. **commerce-schemas** — `ProductTypeSchema`, built-in `ProductTypeDefinition`s.
4. **commerce service** — product-types-service + product create/update attribute validation.
5. **api-rest** — product-type routes + product write + public exposure (resolved `attributes`
   list).
6. **Storefront projection** — `PublicProduct.attributes` → `productToSilicaRecord` (+ builder
   parity).
7. **Silica PDP kit** — `pdpAttributes` (repeat `attributeSections`) / `pdpPolicyLinks` /
   `pdpStockBadge`; delete the fake scarcity helpers.
8. **Binding catalog + per-type routing (Option B)** — `mapProductType` in `binding.ts` (dynamic
   fields in the picker); `recordSubtype` targeting on `builder_pages`; the collection resolver
   (`getPublishedSilicaCollection` + its api-rest endpoint) picks the product's type page /
   default; builder studio `page-settings.tsx` product-type target + `preview-data.ts` placeholder.
9. **Workbench editors** — product-type field-builder editor + product attribute form.
10. **Blueprint plumbing** — decl + installer + updater.
11. **10 templates** — types + per-product attributes + PDP rewrite; regen + validate + sweep.

Phases 1–8 are the load-bearing spine (built in order; 8 depends on 5–7). Phase 9 (workbench
editors) is independent of 10–11 and can proceed in parallel. Phase 11 fans out across the 10
templates once phase 7 lands.

## 11. Decisions already made

- Full typed Product-Type system, **including** the tenant field-builder editor (user, 2026-08-06).
- **Per-type product pages (Option B)** — a product page targets a product type (`recordSubtype`);
  the router picks the product's type page, else the default; the builder field picker surfaces
  that type's attributes via `mapProductType`. This is what gives tenants real per-type control of
  product-page design, and it mirrors CMS per-type templates (user, 2026-08-06). Rejected: a
  single PDP with a flat union of all types' attributes (picker mixes every type's fields, off-type
  binds resolve empty).
- Shipping/returns on the PDP → **link the store's real legal pages**, no fabricated copy
  (user, 2026-08-06).
- Fake "Selling fast" + countdown → **removed**; replaced with a **real inventory** low-stock
  badge.
- Field-schema engine → **extracted to `@sparx/field-schema`**, reused by both content and
  product types.
- `productType` (free-text) kept; `productTypeKey` added as the typed link; `attributes` added as
  the validated bag; `metadata` untouched.

## 12. Open questions

1. **Repeater attribute rendering on the PDP** — a `repeater` attribute (materials list, spec
   rows) needs a nested sub-repeat in `pdpAttributes`. Confirm the silica resolver supports a
   nested array bind under `attributes[i].value` (the runtime resolver does — `runtime.ts`
   bracket indexing + array iteration; needs the projection to hand repeater values as arrays).
2. **Attribute localization** — deferred, consistent with `ProductTranslation` being en-US Phase 1.
   The `attributes` bag is not yet localized; a parallel translation row is the future path.
3. **Faceted search on attributes** — out of scope here; the model supports it later (index
   selected attribute keys into the search projection).
