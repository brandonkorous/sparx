# Tenant Blueprints — one-click templates that provision a whole tenant

**Version:** 0.4.3
**Author:** Brandon Korous
**Last Updated:** 2026-06-17

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

- [docs/15 — Tenant Onboarding](15-merchant-onboarding-prd.md): the "live in under 5
  minutes" goal and the onboarding theme step. Blueprints are the richer, opt-in version of
  the starter seeding onboarding already does.
- [docs/51 — Content Architecture](51-content-architecture.md): content types own their
  schema; entries are polymorphic rows validated against it. A Blueprint seeds both.
- [docs/52 — Email Builder](archive/52-email-builder.md): an email is one self-contained node tree.
  A Blueprint ships these as builder emails.
- [docs/53 — Builder Tenant Components](53-builder-tenant-components.md): the closest
  existing analog. The "system component → **Copy** → tenant-owned versioned row" pattern,
  and publish-expansion of `custom:*` nodes, are reused directly for the "new components a
  template may include" requirement.
- [docs/40 — Composition model](40-sitebuilder-composition-model.md): pages, layouts,
  emails, and components are all node trees of the same shape.
- [docs/49 — Multi-site per tenant](archive/49-multi-site-per-tenant.md): pages and layouts are
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

| #   | Decision                  | Choice                                                                              | Rationale                                                                                                                                                                                                                                                                                                                                             |
| --- | ------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | First flagship vertical   | **General retail store + blog**                                                     | Exercises every module (catalog + variants + CMS content + marketing & transactional email) and is the most reusable marketplace flagship.                                                                                                                                                                                                            |
| D2  | Blueprint representation  | **Declarative manifest** (versioned data, no code execution)                        | Marketplace-distributable and safe on multi-tenant SSR; mirrors how tenant components already store declarative trees (docs/53).                                                                                                                                                                                                                      |
| D3  | Image strategy            | **Hot-link external URLs**                                                          | Fastest path to an end-to-end install. See §6 for the implications and the upgrade seam to tenant-owned media later.                                                                                                                                                                                                                                  |
| D4  | Post-install state        | **Draft — review then go live**                                                     | Matches starter pages + the legal seeder (everything seeds as draft). Nothing off-brand is public until the tenant publishes. Fits "activate or customize".                                                                                                                                                                                           |
| D5  | Theme                     | **Ship a NEW named theme** (a tenant `SiteTheme`)                                   | A blueprint includes its own theme, not just a pick of an existing preset: a named `SiteTheme` = base preset + presentation overlay + brand "look", created and applied on install. It's data (no code deploy) and stays fully editable.                                                                                                              |
| D6  | Install target            | **Always the tenant's _primary_ property**                                          | Templates provision a whole themed site; installing into a secondary is an edge case, and a public-marketplace signup only has a primary anyway. Supersedes the active-property resolution currently in the install route — `GET /v1/blueprints` and install both resolve the primary (§5). Install state is therefore effectively tenant-level (§9). |
| D7  | Module enabling & billing | **Non-blocking placeholder now; real entitlement gate with the public marketplace** | The installer enables required modules so installs work end-to-end (fine while admin-only); the install-what-you're-entitled-to + upsell gate is wired when billing (docs/17) and the public funnel (§15) land. A `TODO(billing)` seam marks the insertion point in `enableModules` now.                                                              |
| D8  | Idempotency               | **Install row written first as `running`; find-or-create per slice; resumable**     | Corrects the Phase-1 create-only + 409 approach (§5). Matches the async worker's `running \| installed \| failed` lifecycle and the `legal-seed-worker` pattern; enables Reset & reinstall and resume-after-failure.                                                                                                                                  |

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
    // The NEW theme the blueprint ships (D5) — created as a tenant SiteTheme and
    // applied on install. Reuses CreateSavedThemeInput + an `apply` flag.
    name: string; // e.g. 'Driftwood'
    basePresetKey: ThemeKey; // 'market' | 'apex' | 'drift' | 'industrial' | 'fleet' | 'drop'
    presentation?: object; // Token Model v2 overlay
    brand?: SavedThemeBrand; // the captured "look": colors, fonts, shape tokens
    apply?: boolean; // default true
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
3. Brand + theme                     TenantBrand upsert; savedThemeService.create (new SiteTheme)
                                      + apply (draft); apply its brand "look"
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

**Idempotency & re-install (D8 — corrected).** The Phase-1 installer is **not** artifact-idempotent:
it makes straight `create` calls and relies solely on a route-level 409 (the install row, written
**last**) to block a double-install. A partial failure therefore orphans artifacts with _no_ install
row, and a retry collides on the unique handles. The target model:

1. Write the `tenant_blueprint_installs` row **first** as `status: 'running'`.
2. Make every slice **find-or-create by handle** (`Product.handle`, `Category.handle`,
   `ContentEntry.slug`, `BuilderComponent.key`, the `SiteTheme` name, …) so a re-run is never a
   duplicate (today only the home page is find-or-replace, and `savedThemeService.create` would
   mint a second theme on re-run).
3. Flip to `installed` on success; on failure persist `failed` + the completed slices so a retry
   **resumes** rather than restarts.
4. Offer an explicit **Reset & reinstall** (delete the row + its mapped artifacts, behind a
   confirm) — also the foundation for version upgrades (§9).

The installer already calls `pageService.create` directly (never `listOrSeed`), so the `STARTER_*`
empty-catalog seed never leaks — a tenant doesn't end up with both starter and template pages.

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

**Billing gate (D7 — placeholder now, real gate later):** enabling paid modules has subscription
implications. For now the installer enables the required modules **non-blocking** (no entitlement
check) so installs work end-to-end — acceptable while installs are admin-only. A
`// TODO(billing): entitlement gate` seam goes in `enableModules` now so the insertion point is
explicit. The real gate — install only what the tenant is **entitled** to and surface the rest as
upsell ("upgrade to add the shop") — is wired when billing ([docs/17](17-billing-subscriptions.md))
and the **public marketplace** (§15) land, since a public signup-then-install is exactly where
silent paid-module activation would bite.

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

> **Build state:** the "Review & go live" **checklist surface** (a list of everything created, each
> deep-linking into its editor, built from the install `result` id-map) is **specified but not yet
> built** — today the dashboard shows only a per-card "Go live" button. This surface is the home for
> the install-state / version-drift indicators (§9) and is Phase-2 work (§13).

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

**Install-state indication (#1).** Because installs always target the primary (D6), install state
is effectively tenant-level: `GET /v1/blueprints` resolves the **primary** property (not the
switcher's active site) and stamps each catalog card `not installed | installed (draft) | live`,
plus a **version-drift** badge when the installed `blueprint_version` trails the registry's
`latest_version` ("v1.0 installed · v1.2 available"). That drift signal is what later drives the
"Update to vN" apply (deferred, §13). The card state already exists for the active property today;
Phase 2 re-points it at the primary and adds the drift badge.

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
lifecycle; `TenantBrand` + theme overlay; `savedThemeService.create`/`apply` (the new theme,
D5); tenant-component storage + publish-expansion; the Pub/Sub worker pattern; module-enable +
bootstrap endpoints; per-property scoping.

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

- **Brand/theme:** the **Driftwood** brand (olive/amber palette, Fraunces/Inter) plus its own
  shipped **Driftwood** theme (a `SiteTheme` over the `market` preset, D5), logo hot-linked.
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
visibly consistent across site preview _and_ email preview → tenant publishes → site
renders the themed home/PDP/blog and the product add-to-cart works.

---

## 13. Phasing & deferred

**Build order (each shippable):**

1. ✅ **BUILT (2026-06-04)** — `@sparx/blueprints` manifest type + integrity validator + the
   `retail-store-blog` flagship (ships the Driftwood theme). Typecheck + lint + 15 tests green.
   (`packages/blueprints/`).
2. ✅ **BUILT (2026-06-05)** — the installer (`services/api-rest/src/lib/blueprint-installer.ts`):
   `installBlueprint` (all slices: modules → assets → brand → theme → content → commerce →
   components → layout → pages → emails, draft) + `goLiveInstall` (publish all). Synchronous,
   called from the route; structured to lift into the async worker later. Reuses every existing
   service; the only DB write helpers it owns are the install row + external MediaAsset rows.
3. ✅ **BUILT (2026-06-05)** — events (`template.installed` / `template.install_failed`) +
   `mediaPublicUrl` absolute-URL pass-through + `tenant_blueprint_installs` table (migration
   `20260703000000`, RLS, applied locally, no drift).
4. ✅ **BUILT (2026-06-05)** — REST: `GET /v1/blueprints`, `GET /v1/blueprints/:key`,
   `POST /v1/blueprints/:key/install`, `GET /v1/blueprints/installs[/:id]`,
   `POST /v1/blueprints/installs/:id/go-live` (install/go-live admin-only, install into the
   ACTIVE property). `@sparx/blueprints` wired into api-rest (dep + Dockerfile COPY).
5. ✅ **BUILT (2026-06-05)** — dashboard **Templates** marketplace (`/templates`): browse cards
   with contents breakdown, confirm-gated **Install**, draft → **Go live**, rail-nav entry.

> **Verified end-to-end (2026-06-05):** a throwaway-tenant harness ran `installBlueprint` +
> `goLiveInstall` through the real service layer + RLS against the local DB — 28/28 assertions
> passed (every artifact created; go-live published pages, activated the layout, set products
> active, published content, status → live). Backend fully exercised; UI typecheck-clean.
> The async `template-installer` Cloud Run worker (+ `template.install` topic in TF) remains the
> production target — the synchronous installer is structured to lift into it unchanged.

**Phase 2 — agreed next work (2026-06-05).** In sequence:

1. **Idempotency + install-state/version-drift (#1, #2)** — the load-bearing slice, in two parts:
   - ✅ **1a BUILT + VERIFIED (2026-06-06, synchronous, no migration):** catalog + install + reset
     resolve the **primary** (D6); the install row is written **first** as `running` and finalized to
     `installed` / `failed` (partial `result` + `error` persisted on failure — `status` is a free
     column); **Reset & reinstall** deletes the id-mapped artifacts + row behind a confirm; the
     version-drift badge ships (§9). Commerce reinstall-after-reset is **clean, not suffixed** —
     install step 6·0 purges the exact soft-deleted handle/SKU tombstones before recreating — and
     reset **deactivates a live layout** before removing it so a live install tears down fully (both
     pulled forward from the original 1b plan). Browser-verified end-to-end: install → installed·draft
     → go-live/reset, failed → reset & retry, drift badge, and `resetInstall` deletes only blueprint
     artifacts (the tenant's own themes/content are untouched).
   - **1b (async worker) — remaining:** lift the synchronous installer into the `template-installer`
     Cloud Run worker on `template.install` (the worker the doc always targeted, §5/§10). The install
     row's `(tenant, property, blueprint)` unique constraint is the idempotency key, so an at-least-once
     redelivery can't double-install (the second row create fails fast); the worker just acks an
     already-present row and leaves a stuck `running`/`failed` one for reset. Optional polish:
     find-or-create _resume_ for the non-commerce slices (pages via `getDraftBySlug`; layouts/emails by
     direct query — `listOrSeed` must never run during install). Primarily a prerequisite for the
     public funnel (§15), where a signup-then-install must not block the request.
2. **`/builder` overview + "Start from a template" (#3).** `/builder` redirects to `/builder/page`
   today; build the overview/empty-state and surface the template catalog there **in-context**,
   rather than relocating the platform surface into the module sub-nav — Templates is cross-module
   and must survive the `builder` module being disabled, so it stays platform-pinned (the rail
   entry) and gains an in-builder entry point, not a move.
3. ✅ **BUILT + VERIFIED (2026-06-06) — "Review & go live" checklist surface (§8).** The marketplace
   card now leads to `/templates/installs/[id]` (installed → "Review & go live", live → "View"); that
   page lists everything the install created, grouped by type from the id-map (new `artifacts` on
   `GET /v1/blueprints/installs/:id`), each deep-linking into its editor (products → product detail,
   content → entry editor, pages → `/builder/page?page=`, collections → collection detail, etc.), and
   owns the **Go live** + **Reset** actions. Browser-verified: review → go-live → live → reset.
4. **Public marketplace + onboarding thread (§15, #4)** — including the **real billing gate** (D7)
   and **tenant-owned media** (D3 seam, §6), both of which become load-bearing once installs run
   for self-serve public signups.
5. **Version _upgrades_ ("Update to vN")** — deferred; the genuinely hard part (a 3-way merge
   against a tenant's customizations, per docs/53), built on the drift signal from step 1.

**Deferred (build on it later):**

- Blueprint **update/upgrade** for already-installed tenants — Phase-2 step 5 above (echo docs/53
  "Update to vN").
- Multiple verticals — 6 manifests ship today (retail, tattoo, salon/spa, antiques, auto-parts,
  wellness clinic); more (B2B/fleet, content publisher, services) as needed.
- Per-property installs beyond primary — **explicitly a non-goal under D6** (always primary); revisit
  only if a real multi-site install need surfaces (docs/49 Phase 2).
- Third-party / tenant-_authored_ blueprints (`sparx.market`, docs/00) — a separate seller-platform
  direction, distinct from the public browse-our-blueprints marketplace in §15.
- AI-generated blueprints (the manifest is a clean generation target for the MCP layer, docs/07) —
  natural follow-on once the public funnel (§15) exists.

---

## 14. Open questions

1. ✅ **Resolved (D7) — Billing gate (§7):** non-blocking placeholder now (a `TODO(billing)` seam
   in `enableModules`); the real install-what-you're-entitled-to + upsell gate lands with the public
   marketplace (§15) and billing (docs/17).
2. ✅ **Resolved — Starter-seed coexistence (§5):** the installer calls `pageService.create`
   directly (never `listOrSeed`), so no starters leak — the verify run created exactly 5 pages.
3. ✅ **Resolved — Re-install semantics**, _superseded by D8_: Phase-1 blocks a second install for
   the same (tenant, property, blueprint) with a 409 (`findInstall` guard + unique index). Phase 2
   adds **Reset & reinstall** + resume-after-failure, so "blocked" is no longer the final word — a
   deliberate reset/reinstall and a clean resume are both supported.
4. ✅ **Resolved (D6) — Default property:** always the tenant's **primary**. The install route +
   `GET /v1/blueprints` resolve the primary (not the switcher's active site), making install state
   tenant-level (§9). The current active-property resolution is re-pointed to primary in Phase 2.

---

## 15. Public marketplace & top-of-funnel (#4)

Phase-1's marketplace is dashboard-only (post-auth, admin-gated). The high-leverage next step is a
**public** template gallery on the marketing site (`apps/web`, pre-auth) that turns "browse a
template" into "start a tenant" — aligned with the onboarding "live in under 5 minutes" goal
([docs/15](15-merchant-onboarding-prd.md)) and the "AI builds it, sparx keeps it" permanence
positioning ([docs/01](01-platform-vision.md) §7).

Funnel:

```
public gallery (apps/web) ─▶ "Start with this template" ─▶ sign up
  ─▶ tenant created ─▶ blueprint auto-installed (async, draft) ─▶ Review & go live (§8)
```

Net-new for this slice:

- **A public, unauthenticated catalog read.** `GET /v1/blueprints` requires `viewer` today; the
  gallery needs a no-auth catalog endpoint (metadata + preview images only — no per-tenant install
  state).
- **Thread `blueprintKey` through onboarding** (docs/15) into provisioning, so signup → install is
  one continuous motion. A new tenant has only a primary (D6), so the target is unambiguous.
- **Async install (§5/§10).** A public signup-then-install must fire `template.install` and let the
  worker provision in the background so the signup request stays snappy — the same worker Phase-2
  step 1 builds.
- **The real billing gate becomes load-bearing here (D7).** This is exactly where silent paid-module
  activation would bite, so the entitlement gate + upsell lands with this slice.
- **Tenant-owned media (D3 upgrade seam, §6).** Before installs scale publicly, switch hero/product
  images from hot-link to copy-into-tenant-bucket so a public install isn't a permanence liability
  (the manifest shape doesn't change — only §5 step 2).
- **Per-blueprint marketing/OG pages** for shareable links (we already capture preview screenshots).

**Out of scope here:** third-party / tenant-_authored_ blueprints (`sparx.market`, §13) — that's a
separate, later seller-platform direction. This slice is "publicly browse **our** curated
blueprints." AI-generated blueprints (§13) are a natural follow-on once this funnel exists.
