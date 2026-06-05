# Tenant Blueprints — one-click templates that provision a whole tenant

**Version:** 0.1.0
**Author:** Brandon Korous
**Last Updated:** 2026-06-04

---

## 1. Purpose & relationship to other docs

A tenant should be able to browse a marketplace of **templates**, click **Install**, and end
up with a complete, consistently themed presence — site layout, pages, content types and
entries, product categories and products, email templates, and any custom components the
template ships — ready to **review, customize, and go live**.

Internally we call the unit a **Blueprint**: a single declarative manifest that describes
_everything to create for a tenant_, plus an **installer** that replays it through the
existing service layer. "Template" is the marketplace-facing word; "Blueprint" is the
artifact, chosen because **"template" is already overloaded** in this codebase — page
templates (`BuilderPage`), email templates (`EmailTemplate` / builder emails), content
templates (docs/51), and component definitions all exist. A Blueprint _bundles_ those.

This is **not** a new authoring substrate. Every artifact a Blueprint creates already has a
production write path; the Blueprint is an orchestration layer over them. Where this doc and
others disagree on the _installer/manifest_, this doc wins; where they describe the
_underlying artifact_ (a page, a product, an email), those docs win.

It builds on:

- [docs/15 — Merchant Onboarding](15-merchant-onboarding-prd.md): the "live in under 5
  minutes" goal and the onboarding theme step. Blueprints are the richer, opt-in version of
  the starter seeding onboarding already does.
- [docs/51 — Content Architecture](51-content-architecture.md): content types own their
  schema; entries are polymorphic rows validated against it. A Blueprint seeds both.
- [docs/52 — Email Builder](52-email-builder.md): an email is one self-contained node tree.
  A Blueprint ships these as builder emails.
- [docs/53 — Builder Tenant Components](53-builder-tenant-components.md): the closest
  existing analog. The "system component → **Copy** → tenant-owned versioned row" pattern,
  and publish-expansion of `custom:*` nodes, are reused directly for the "new components a
  template may include" requirement.
- [docs/40 — Composition model](40-sitebuilder-composition-model.md): pages, layouts,
  emails, and components are all node trees of the same shape.
- [docs/49 — Multi-site per tenant](49-multi-site-per-tenant.md): pages and layouts are
  per-**property**. A Blueprint installs into one property (the tenant's primary by default).

---

## 2. Why this is mostly assembly, not invention

Three existing properties of the platform carry the feature:

1. **Uniform idempotent create paths under `withTenant()`.** Every artifact is created by a
   service function that already validates input, writes an audit row, and publishes an
   event. The installer calls these — it owns no write logic of its own:

   | Artifact                    | Reused create path                                                                                                                                                       |
   | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
   | Brand identity              | `TenantBrand` upsert / `/v1/brand`                                                                                                                                       |
   | Theme + presentation        | `themeService.selectTheme` + `themeService.updateSettings` ([packages/sitebuilder/src/services/theme-service.ts](../packages/sitebuilder/src/services/theme-service.ts)) |
   | Content types               | `POST /v1/content/types` handler ([content/types.ts](../services/api-rest/src/routes/v1/content/types.ts))                                                               |
   | Content entries             | `tx.contentEntry.create` + `recordRevision` + `syncReferences` ([packages/api-core/src/entries.ts](../packages/api-core/src/entries.ts))                                 |
   | Categories                  | `categoryService.create` ([category-service.ts](../packages/commerce/src/services/category-service.ts))                                                                  |
   | Products                    | `productService.create` ([product-service.ts](../packages/commerce/src/services/product-service.ts))                                                                     |
   | Variants / options / images | `variantService.setOptions` / `create` / `addImage` / `setPrimaryImage` ([variant-service.ts](../packages/commerce/src/services/variant-service.ts))                     |
   | Site layout                 | `layoutService.create` + `setActive` ([layout-service.ts](../packages/builder/src/services/layout-service.ts))                                                           |
   | Pages + defaults            | `pageService.create` + `setDefault` ([page-service.ts](../packages/builder/src/services/page-service.ts))                                                                |
   | Email templates             | `emailService.create` + `publish` ([email-service.ts](../packages/builder/src/services/email-service.ts))                                                                |
   | Custom components           | `componentService.create` ([component-service.ts](../packages/builder/src/services/component-service.ts))                                                                |

2. **Theming is centralized.** Every surface — site chrome, pages, **and** emails — reads
   brand identity _live_ from `TenantBrand` and overlays it at publish/render
   (`overlayBrand` in sitebuilder; `resolveEmailBrand` in
   [packages/email-platform/src/services/brand-service.ts](../packages/email-platform/src/services/brand-service.ts)).
   So "consistently themed" is achieved by setting brand + `themeKey` **once**; nothing is
   baked per-artifact. This is the single most important enabler — it is why one Blueprint
   can theme the whole stack without per-page color decisions.

3. **The cross-module seeding pattern already exists.** [legal-seed-worker](../services/legal-seed-worker/src/seed.ts)
   consumes `tenant.created` and seeds draft pages across modules, idempotently, inside
   `withTenant()`. A `template.install` event → `template-installer` worker is the same
   shape, scaled to more artifacts.

---

## 3. Locked decisions

| #   | Decision                 | Choice                                                       | Rationale                                                                                                                                                   |
| --- | ------------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | First flagship vertical  | **General retail store + blog**                              | Exercises every module (catalog + variants + CMS content + marketing & transactional email) and is the most reusable marketplace flagship.                  |
| D2  | Blueprint representation | **Declarative manifest** (versioned data, no code execution) | Marketplace-distributable and safe on multi-tenant SSR; mirrors how tenant components already store declarative trees (docs/53).                            |
| D3  | Image strategy           | **Hot-link external URLs**                                   | Fastest path to an end-to-end install. See §6 for the implications and the upgrade seam to tenant-owned media later.                                        |
| D4  | Post-install state       | **Draft — review then go live**                              | Matches starter pages + the legal seeder (everything seeds as draft). Nothing off-brand is public until the tenant publishes. Fits "activate or customize". |

> D3 note: hot-linking is deliberately the weak link for a permanence-positioned product
> (see [docs/01](01-platform-vision.md) §7). The manifest's asset section is designed so a
> later phase can switch to **copy-into-tenant-media** without changing how pages/products
> reference images. Tracked as a deferred item in §13.

---

## 4. The manifest — the keystone

A Blueprint is one versioned document. Authoring it in-repo as typed TS (compiled/validated
to JSON) gives type-safety now; the marketplace later stores the JSON form (§9). Shape:

```ts
interface Blueprint {
  key: string; // 'retail-store-blog'
  version: string; // semver; bumped on edit
  name: string; // marketplace display
  summary: string;
  vertical: 'retail' | 'b2b' | 'content' | 'services';
  requiresModules: ModuleSlug[]; // ['builder','commerce','cms','email']

  brand: {
    businessName: string;
    tagline?: string;
    colors: { primary; primaryForeground; accent; secondary /* ... */ };
    fonts: { heading: string; body: string };
    logo?: AssetRef; // resolves via §6
  };
  theme: {
    themeKey: string; // code-first preset, e.g. 'apex'
    presentation?: object; // Token Model v2 overlay (draftSettings)
  };

  assets: AssetDecl[]; // id -> external URL (+ alt, dimensions) — §6

  contentTypes?: ContentTypeDecl[]; // custom types; most blueprints lean on built-ins
  content: ContentEntryDecl[]; // entries keyed by typeKey (blog posts, pages)

  commerce?: {
    categories: CategoryDecl[]; // ordered parent-first; handle-referenced
    collections?: CollectionDecl[];
    products: ProductDecl[]; // options, variants, image refs, category handles
  };

  components?: ComponentDecl[]; // tenant components (tree + propSpec) — "new components"
  layout: LayoutDecl; // site chrome node tree (becomes the active layout)
  pages: PageDecl[]; // singleton + collection templates; `isDefault` per recordType
  emails: EmailDecl[]; // builder-email node trees
}
```

**Reference-by-handle, not by id.** The manifest cannot know runtime UUIDs, so it links
artifacts by stable handles/keys: a `ProductDecl` lists `categoryHandles: string[]`; a
`PageDecl` collection template carries `recordType: 'commerce.product'`; an image ref is an
`assets[].id`. The installer maintains an **id map** (handle → created UUID) as it goes and
resolves references in dependency order. This is the only "new" logic in the installer and
it is mechanical.

**Trees are authored, not generated.** `layout`, `pages[].tree`, `emails[].tree`, and
`components[].tree` are real `@sparx/builder-schemas` node trees — the same JSON the visual
editor produces. The fastest way to author the flagship is to build it in `/builder` against
a scratch tenant, then export the published trees into the manifest. The trees reference
brand via tokens (never hardcoded colors), so they re-theme automatically per installing
tenant.

---

## 5. The installer

A `template-installer` Cloud Run worker (mirroring `legal-seed-worker`) subscribed to a new
`template.install` event. It runs the manifest in **dependency order**, each step inside
`withTenant()`, each step idempotent (find-or-create by handle):

```
1. Enable requiresModules            (§7)
2. Resolve assets                    -> MediaAsset rows for product images; URLs inline for tree images (§6)
3. Brand + theme                     TenantBrand upsert; selectTheme + updateSettings (draft)
4. Content types                     create custom types (skip built-ins); then
   Content entries                   create entries (DRAFT), recordRevision, syncReferences
5. Commerce  categories (parent-first) -> collections -> products -> options -> variants -> images
6. Components                        componentService.create (tenant components)
7. Pages + layout                    pageService.create (+ setDefault per recordType);
                                      layoutService.create (+ setActive only if no active layout)
8. Emails                            emailService.create  (left as DRAFT — not published)
9. Emit template.installed           dashboard surfaces "Review & go live"
```

**Ordering constraints that matter:**

- Content **types** before **entries** (entries validate against the type schema).
- Categories **parent-first** (materialized `path` is computed from the parent's path).
- Products before their variants/images; `isDefault` variant set during variant creation.
- Content + products before **pages**, because collection templates bind to a `recordType`
  and `setDefault` needs the type/source to validate via `assertValidRecordType`.
- Brand/theme can run anytime (no fk deps) — done early so any preview during install is themed.

**Idempotency & re-install.** Every create path keys on a per-tenant unique handle
(`Product.handle`, `Category.handle`, `ContentEntry.slug`, `BuilderComponent.key`, …), so a
re-run is find-or-create, never duplicate. The installer must therefore _create at least one
page before any page list happens_, because `pageService.listOrSeed` only seeds `STARTER_*`
when the catalog is empty — installing pages first naturally suppresses the starter seed so a
tenant doesn't end up with both. (Verify this empty-catalog guard during build; if absent,
add an explicit "already provisioned" sentinel.)

**Draft everywhere (D4).** Pages/layouts/emails are created but **not published**; content
entries and products are created with `status: 'draft'`. The active layout is set only if the
property has none (so we don't silently swap a live shell). Going live is the tenant's
explicit action post-review.

**Sync vs async.** Async via Pub/Sub (matches `legal-seed-worker`): keeps the install
request snappy and the work retryable. The dashboard fires the event and polls
`template.installed` / an install-status row. (A synchronous path is acceptable for the very
first internal test but the worker is the target.)

---

## 6. Media / assets (D3: hot-link)

Two different consumers, two handling rules:

- **Tree images** (page heroes, email images, component images): the builder/email `image`
  node already accepts a **URL string** directly (the email renderer resolves "URL string,
  `{ url }` asset, or images array"). So these embed the external URL straight into the
  authored tree — no `MediaAsset` row needed.
- **Product images**: structurally bound through `VariantImage.mediaAssetId → MediaAsset`.
  There is no raw-URL path here. The installer creates a lightweight `MediaAsset` row
  (`status: 'ready'`) whose `key` holds the **absolute external URL**, and we make
  `mediaPublicUrl()` ([packages/commerce/src/media-url.ts](../packages/commerce/src/media-url.ts))
  **pass through absolute `http(s)://` keys** instead of prefixing the CDN base. That is the
  only code change media requires for this phase (~a few lines + a test).

`AssetDecl` therefore carries `{ id, url, alt?, width?, height? }`. The id map records
`assets[].id → MediaAsset.id` for product image refs, and `assets[].id → url` for tree refs.

**Upgrade seam (deferred).** Switching to tenant-owned media later means: on install, POST
each asset URL through the existing media ingestion (media-worker) to copy bytes into the
tenant bucket, then point refs at the resulting `MediaAsset`. The manifest shape doesn't
change — only the resolve step in §5 step 2. Tracked in §13.

---

## 7. Module enabling

A full Blueprint needs `builder`, `commerce`, `cms`, and `email`. Modules are flags in
`tenants.settings.modules.<slug>.enabled` (toggled via `PATCH /v1/tenant/modules/:slug`).
The installer enables each module in `requiresModules` and invokes that module's existing
idempotent bootstrap where one exists (`POST /v1/crm/bootstrap`, `POST /v1/email/bootstrap`).

**Billing gate (decision for build):** enabling paid modules has subscription implications.
Default stance — the installer enables only modules the tenant is **entitled** to; for
un-entitled modules it either (a) skips that slice and flags it in the install result
("upgrade to add the shop"), or (b) is blocked at the marketplace "Install" button by an
entitlement check. Recommend (a): install what they can use, surface the rest as upsell. Lock
this against [docs/17 — Billing](17-billing-subscriptions.md) before building §7.

---

## 8. Install lifecycle & UX

```
Browse marketplace ─▶ Install (fires template.install) ─▶ [worker provisions, draft]
        ─▶ template.installed ─▶ "Review & go live" surface ─▶ tenant edits ─▶ Publish/Activate
```

- **Install** is a single action; progress is shown while the worker runs.
- **Review** lands the tenant on a checklist of what was created (pages, products, content,
  emails), each linking into its editor — everything already in draft.
- **Go live** is the tenant publishing pages, activating the layout, and setting
  products/content to active — using the _existing_ publish/activate controls. The Blueprint
  adds no new publish path.
- **Customize** is just normal editing. Once installed, the artifacts are ordinary tenant
  rows with no special status.

---

## 9. Marketplace catalog & data model

The marketplace is a **platform-level** catalog of Blueprint manifests, versioned, browsable.
The first template is simply the first entry, authored in-repo; the catalog generalizes it.

```
blueprints            (platform-owned, not tenant-scoped)
  id, key (unique), name, summary, vertical, status (draft|published|archived),
  latest_version, hero_image_url, created_at, updated_at
blueprint_versions
  id, blueprint_id, version, manifest (JSONB), changelog, created_at
  unique (blueprint_id, version)
tenant_blueprint_installs   (tenant-scoped, RLS)
  id, tenant_id, blueprint_id, version, property_id, status (running|installed|failed),
  result (JSONB: id map + per-slice outcomes + upsell flags), installed_at
```

`tenant_blueprint_installs` gives idempotency keys (don't double-install the same blueprint
into the same property), an audit trail, the id map for support/debugging, and the seam for
future **update/upgrade** ("blueprint v2 available") echoing the component "Update to vN"
pattern (docs/53 §6).

Authoring blueprints in-repo first, then promoting the JSON into `blueprint_versions`, means
**no deploy is needed to publish a new template** once the format is stable — same principle
as docs/53/38's no-deploy goal.

---

## 10. Events

Add to [packages/events/src/types.ts](../packages/events/src/types.ts):

- `template.install` — `{ tenantId, blueprintKey, version, propertyId, actorId }` — published
  by the marketplace Install action, consumed by `template-installer`.
- `template.installed` — `{ tenantId, blueprintKey, installId, summary }` — published by the
  worker on success; the dashboard listens (or polls the install row) to flip to "Review".
- `template.install_failed` — `{ tenantId, installId, error, completedSlices }` — partial
  progress is fine because every slice is idempotent; a retry resumes cleanly.

---

## 11. What to reuse vs. what is net-new

**Reuse as-is (no changes):** all the service create paths in §2 table 1; the draft→publish
lifecycle; `TenantBrand` + theme overlay; tenant-component storage + publish-expansion; the
Pub/Sub worker pattern; module-enable + bootstrap endpoints; per-property scoping.

**Net-new:**

1. `Blueprint` manifest type + validator (`@sparx/blueprints`, a new package).
2. `template-installer` service (`services/template-installer/`) — orchestration + id map.
3. The three events (§10).
4. `mediaPublicUrl` absolute-URL pass-through + a `MediaAsset` "external" creation helper (§6).
5. Catalog tables + RLS (§9) and a migration (hand-edit RLS per the project pattern).
6. Marketplace browse + Install UI + post-install "Review & go live" surface (dashboard).
7. The first manifest itself: **retail-store-blog**.

---

## 12. The first blueprint — `retail-store-blog`

Concrete contents that prove every slice end-to-end:

- **Brand/theme:** a neutral retail palette + heading/body font pair + `themeKey`, logo
  hot-linked.
- **Content (built-in types):** an **About** page, a **Contact** page, and ~3 **blog posts**
  (`blog_post`) with rich bodies + SEO. No custom content types in v1 (lean on built-ins).
- **Commerce:** ~3 categories (parent + 2 children), ~8 products spanning simple and
  variant-bearing (e.g. a Size×Color product to exercise options/variants/swatch images),
  one **collection** ("Featured"). All images hot-linked.
- **Components:** 1–2 tenant components to satisfy "may include new components" — e.g. a
  branded "Feature trio" and a "Promo banner" with `propSpec` slots — referenced from the
  home page.
- **Layout:** header (logo + primary nav) · Outlet · footer (nav + social), bound to
  `site.identity` / `site.primaryNav` / `site.footerNav`.
- **Pages:** Home (singleton, hero + featured collection + latest posts + newsletter),
  Blog index + a `blog_post` collection template (`isDefault`), a `commerce.product`
  collection template (`isDefault`), About, Contact.
- **Emails:** a marketing **Welcome/Newsletter** builder email + a customized **transactional**
  (welcome) — both draft.

Acceptance: install into a fresh tenant → all artifacts present and draft → brand/theme
visibly consistent across site preview _and_ email preview → tenant publishes → storefront
renders the themed home/PDP/blog and the product add-to-cart works.

---

## 13. Phasing & deferred

**Build order (each shippable):**

1. `@sparx/blueprints` manifest type + validator; author `retail-store-blog` (no installer yet
   — just a typed, validated document).
2. `template-installer` worker + `template.install` event; install **commerce + content +
   brand/theme** slices first (the data-heavy ones), draft. Verify in a scratch tenant.
3. Add **pages + layout + emails + components** slices; verify themed previews.
4. Catalog tables + a single seeded blueprint row; minimal **Install** button (no browse UI).
5. Marketplace **browse** + **Review & go live** surface.

**Deferred (build on it later, per the user's framing):**

- Tenant-owned media (copy-into-bucket) replacing hot-link (D3 upgrade seam, §6).
- Blueprint **update/upgrade** for already-installed tenants (echo docs/53 "Update to vN").
- Multiple verticals (B2B/fleet, content publisher, services) as additional manifests.
- Per-property installs beyond primary (docs/49 Phase 2).
- Third-party / tenant-authored blueprints in the marketplace (`sparx.market`, docs/00).
- Entitlement/billing enforcement detail (§7) once docs/17 specifics are locked.
- AI-generated blueprints (manifest is a clean generation target for the MCP layer, docs/07).

---

## 14. Open questions

1. **Billing gate (§7):** install-what-you-can + upsell, or block at the button? (Recommend
   the former; needs a docs/17 cross-check.)
2. **Starter-seed coexistence (§5):** confirm `listOrSeed` only seeds on an empty catalog so
   installer pages suppress starters; otherwise add an explicit provisioned sentinel.
3. **Re-install semantics:** is re-installing the same blueprint a no-op merge, or blocked
   once `tenant_blueprint_installs` has a row? (Recommend blocked-by-default with an explicit
   "reset & reinstall".)
4. **Default property:** always install into primary, or let the marketplace choose a property
   when multi-site is on?
