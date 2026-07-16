# 122 — Editable Storefront & Configurable Commerce Components

Version: 0.8.0
Author: Brandon Korous
Last Updated: 2026-07-15

## Purpose

Two converging goals, one plan:

1. **Configurable commerce components** — a tenant composes a product listing anywhere and chooses its **source** (Featured / New / Related / Category) and **layout** (grid / rail) from the inspector, instead of the platform hardcoding "all products." Fixes the reported bug: the PDP "Featured" rail loaded the **entire catalog** because the composite bound the whole-catalog `commerce.product` source.
2. **Every page editable by the tenant, across every module** — content, commerce templates, and every module's **functional** pages are authored in the silica `/builder/studio`. This is platform-wide, not commerce-only: commerce (cart / checkout / account / order-status / search), **scheduling** (booking / availability), **B2B** (wholesale portal / quote request / net-terms), **invoicing** (invoice view / pay), **quotes** (quote view / accept), and any other module surface. Functional pages are editable **shells** with a **pinned functional core** (Outlet-style — restyle and reposition, never delete or break).

The governing model for #2: **every page is a free canvas; functional pieces are pinned.** A tenant can restyle and move the checkout form but cannot delete it, exactly as the site layout's `Outlet` is `pinned` today.

This builds directly on the silica cutover ([118](118-builder-silicaui-html-migration.md)) and the customization rebuild ([98](98-builder-customization-rebuild.md)); the commerce composites live in `@sparx/silica-catalog`, not silicaui.

## Key facts established (source of truth)

- **Render path**: a stored silica page BODY → `renderSilicaBody` (`@sparx/silica-catalog`) → vendored `toHtml` → raw HTML; the FRAME is walked to React. The PDP renders from a **published stored template** (`getPublishedSilicaCollection`), so a composite code change alone does NOT change a live page — the stored tree must be re-authored too.
- **Data-need collection**: `collectSilicaSourceNeeds` (`@sparx/builder-schemas/silica-data-needs.ts`) walks a tree and reports which sources to fetch. Now reports **which** product sources are bound (`products: {catalog, featured, fresh, related, categories[]}`), not just a boolean.
- **Host resolution**: `buildSilicaHost` (`apps/site/lib/silica-data.ts`) fetches per-source and fills the resolver root. Bounded rails are capped (`FEATURED_LIMIT = 8`) and exclude the in-scope PDP product.
- **Sources**: `commerce.product` (whole catalog), `commerce.featured`, `commerce.new`, `commerce.related`, `commerce.category.<collectionHandle>`. Registered in `COMMERCE_SOURCES` (`@sparx/builder-schemas/binding.ts`) so the inspector's binding picker offers them.
- **Data realities**:
  - Products have **no** storefront `featured` flag (only `ProductCollection.featured` and a marketplace-only `marketFeatured`). "Featured" is therefore defined as **products tagged `featured`** (existing `tags` field), newest-few fallback. Promotable to a real product-level flag later (Phase 4).
  - Products do not expose collection membership publicly, so **"Related" falls back to newest-excluding-current** until the public product API surfaces membership (Phase 4).
  - `commerce.category.<handle>` uses the collection **handle** (`listCollectionProducts(handle)`); handles are kebab-case (no dots), safe in a dotted binding path.
- **Editor palette**: `COMMERCE_CATALOG` (`@sparx/silica-catalog/catalog.ts`) is merged into silica's Insert palette; inserting a block **stamps its node tree** (forked, editable) — so card/PDP layout is already hand-editable.
- **Resolved (Phase 1)**: "prop-driven" is delivered through the **native silica binding picker**, not a bespoke prop panel. The studio's `<Builder>` engine renders its own binding picker fed by `dataSources` (`toSilicaDataSources(catalog.sources)`); selecting a Products repeat and choosing a **source** in that picker is the "which products" control, and swapping the container classes (grid vs. rail) is the layout control. So the block needs **no** custom inspector React — every bounded source (`commerce.featured` / `.new` / `.related`) rides the existing picker once it is in the served catalog, and the **category** control is the tenant's real collections **enumerated as sources** (`commerce.category.<handle>`, labeled "Category: <name>") by `bindingService.getSchema`. The legacy `def.props`/`Segmented` control system is the legacy builder's; the silica studio does not use it.

## Phases

### Phase 0 — Foundation ✅ (this session)

- Bumped `@wizeworks/silicaui*` catalog **0.19.0 → 0.21.0** (video/audio/embed/icons/rich-text now render; verified). Icon fix applied + verified on the Meridian Services cards.
- Bounded **`commerce.featured`** source: `featuredProducts()` binds it, not the whole catalog.
- Richer **source collector** (`products: {catalog, featured, fresh, related, categories[]}`) + host fetches for new/related/category (+ featured via `tags`), capped and current-product-excluded.
- **`COMMERCE_SOURCES`** entries for featured/new/related.
- MCP authoring guide (`silica-vocabulary.ts`) updated for the bounded rail + the 0.21 media capabilities.
- Tests green (`commerce.test.ts`, `silica-data-needs.test.ts`).

### Phase 1 — Configurable Products block + reusable card (Track A) ✅

- **A2 — Reusable Product Card** ✅: `productCard()` is the single card composite the grid/rail repeats; structured so a tenant can "Save as component" (silica symbol) and fork it. Single responsibility, allowlist-safe.
- **A3 — One prop-driven Products block** ✅: `productsBlock({ source, layout, heading })` — `source` (all / featured / new / related / `commerce.category.<handle>`) × `layout` (grid / rail). Replaces the separate "Featured products" and "Product grid" palette entries with one configurable block that composes the reusable card; `productGrid()`/`featuredProducts()` are now thin presets of it. Emits the right source ref + grid/rail classes. Tests in `commerce.test.ts`.
- **A4 — Studio integration** ✅: no bespoke inspector control needed (see "Resolved" above). The bounded sources reach the studio picker because `bindingService.getSchema` already returns `COMMERCE_SOURCES` (which now carry featured/new/related); the **category** control is `getSchema` enumerating the tenant's real product collections as `commerce.category.<handle>` sources via `commerceCategorySource`. The engine's native picker + `scopeAt` + `buildPreviewData` all consume these unchanged.
- **A5 — Live bug fixed** ✅: the reported "Featured shows the whole catalog" bug lived in the code composite `productDetailPage()` (the PDP falls back to it — no stored template binds the rail), whose rail now binds bounded `commerce.featured`. The composite change fixes it outright; no stored tree to re-author. (Meridian has < 8 products and the cap is 8, so it doesn't _look_ different there — the cap is proven by `commerce.test.ts`.)

### Phase 2 — Editability model for all page types (Track B foundation)

- **B-taxonomy** ✅ (audited): every `apps/site` route classified as **content** (home, `[...slug]` — stored silica body, free canvas), **commerce-template** (PDP, collection, blog — silica template + record scope, code composite fallback), or **functional** (**28 routes**: PLP, search, cart, checkout, `/book`, `/book/[serviceId]`, all `account/*` auth + `(authed)` dashboard, all B2B — hardcoded React, no silica today). The 28 functional routes are the Phase 3 build targets.

- **B2 — Pinned functional component** — delivered by **silicaui 0.22's native `HostNode`** (the `BuilderHost` gap the audit surfaced was the upstream ask; 0.22 shipped it). The primitive, end to end:
  - **Data**: `HostNode` (`kind: "host"`, `component: <allowlist key>`, `props`, `locked: "host"`) — a live, host-owned functional region. Authored via the kit's `host(component, cls?, props?)`. `toHtml` lowers it to an **empty mount point** `<div data-sui-host="<key>" data-sui-host-props='<json>' data-sui-id="…">`.
  - **Pinning**: `HostComponentDef.pinned: true` inserts the node `locked: "host"` — the engine's `remove`/`move` **refuse** a locked node and the author UI offers **no unlock** (only the host clears it). This is the real, engine-enforced "never deletable/movable-out," no always-render fallback needed. The author freely restyles the node's wrapper classes and repositions **everything around** it.
  - **Studio**: the sparx `BuilderHost` adds `hostComponents(): HostComponentDef[]` (one per functional core → the Insert palette, `pinned`) and `renderHostNode(node, ctx)` (a non-interactive **skeleton** preview on the canvas, `ctx.preview === true`).
  - **Storefront render-bridge**: a functional page body renders through a **React walk** (the generalization of `SilicaChrome`'s `walk`) that maps `kind: "host"` → the **real interactive React component** (SSR + hydrate) via a storefront **host registry** keyed by `component`. Content pages keep the fast HTML-string `SilicaBody`; a page carrying any host node takes the walk path.
  - **Single source of truth for the key vocabulary**: framework-free `@sparx/silica-catalog` owns the host-component **keys** + `HostComponentDef` metadata + the authoring composites (`host('commerce.checkout', …)`); the **dashboard** maps keys → canvas skeletons; the **site** maps keys → real functional components. No key is duplicated.

- Confirm all **content** and **commerce-template** pages open and edit in studio (they are stored pages/templates already).

**B2 status — the foundation + render bridges + the first vertical are built (silicaui 0.22):**

- `@sparx/silica-catalog/host-nodes.ts` — the React-free registry: `HOST_KEYS`, `HOST_COMPONENTS` (palette/inspector metadata), `hostCore(key)` (authors a `host()` node stamped `locked: "host"` so a **seeded** core is pinned, not just palette-inserted ones), and `functionalShell(key, {heading})` (the default editable shell). Tests in `host-nodes.test.ts`.
- **Studio bridge** (`apps/dashboard`): `buildSilicaHost` now returns `hostComponents()` (each `pinned: true`) and `renderHostNode` → `host-cores.tsx` draws a branded non-interactive **skeleton** per key on the canvas.
- **Storefront bridge** (`apps/site`): `SilicaChrome`'s node walk generalized to a shared `walk(node, key, ctx)` with a `host` case; new `SilicaFunctionalBody` renders a functional page body through that walk, mounting the real component at each host node via `silica-host-cores.tsx`'s `storefrontHostRenderer` (key → real component). Content pages keep the HTML-string `SilicaBody`.
- **First vertical — `commerce.cart`** ✅: `/cart` renders an editable shell wrapping the pinned live `<CartView>`; a **Cart page is seeded into the starter** (`starterPages`, commerce tenants) so it lists + edits in studio and `getPublishedSilicaPage('cart')` returns the shell. Gate-clean (silica-catalog types+42 tests+lint; site + dashboard types+lint). This is the **proven recipe** every remaining core follows.
- **Second vertical — `commerce.search`** ✅: the whole search experience extracted into a self-contained `<SearchExperience>` server component (`components/search/`); `/search` renders it in an editable shell via the pinned `commerce.search` core, and a **Search page is seeded into the starter**. This vertical established the **context pattern** for data-dependent cores: `HostCoreContext` carries the resolved `site` + optional `searchParams` (a host core can't read the URL/resolve the tenant, so the route passes what its cores need; each core reads only its slice). Gate-clean.

**The recipe (per remaining core):** ① register the key in `HOST_KEYS` + `HOST_COMPONENTS` (icon from the curated set); ② if the core isn't self-contained, extract its experience into one component taking route-supplied context; ③ add the case to `storefrontHostRenderer` (site) + a skeleton to `renderHostSkeleton` (dashboard); ④ convert the route to render the shell via `SilicaFunctionalBody`; ⑤ seed the page into `starterPages` and update the slug-assertion tests.

**Verticals landed so far (all gate-clean + runtime-verified on `wizeworks`):** singleton pages — `commerce.cart` · `commerce.search` · `commerce.plp` · `commerce.collections` · `commerce.categories` (index) · `scheduling.services` (booking index) · `commerce.auth` (login/register/forgot/reset, one core × 4 modes); per-record templates — `commerce.category` (detail) · `scheduling.service` (booking detail), joining the pre-existing `commerce.product`/`commerce.collection`. Starter commerce pages: Home, Shop, Cart, Search, Products, Collections, Categories, Login, Register, Forgot password, Reset password, About, Contact; a scheduling tenant additionally seeds a **Book** page (`/book`) + a Book nav/footer link.

**Second module — `scheduling.services`** ✅: proved the recipe generalizes past commerce. The `/book` bookable-services index extracted into a self-contained `<BookingServices>` core (`components/booking/`, resolves its own tenant so it needs no context), wrapped in an editable shell. It also established the **module-flag threading pattern** the plan flagged: a new `schedulingEnabled` flag runs the exact path `commerceEnabled` does — `SiteChromeOptions` (nav Book link + footer) → `starterPages` (seeds `/book`, gated) → `PublishedSilicaFrameDto.schedulingEnabled` (api-rest resolves `isModuleEnabled(tenant,'scheduling')`) → `silica.ts` `resolveModuleFlags` (fallback frame/page) → studio `page.tsx` (seed). **Key difference from commerce:** `schedulingEnabled` **defaults `false`** (opt-in — no legacy unconditional behavior to preserve, unlike Commerce's `true`), so a content/commerce-only tenant never gets an orphan Book page; and the `/book` route **404s when the module is off** (module gating via `resolveSchedulingEnabled`), where the commerce routes render unconditionally. Empty state (scheduling on, nothing bookable yet) renders in the core, not a 404. The service **detail** (`/book/[serviceId]`, the live time-picker) stays a per-record template — deferred with the other per-record work below.

**Auth-entry pages** ✅: the four PUBLIC `/account` entry pages (`login`, `register`, `forgot`, `reset`) are now editable shells around ONE pinned `commerce.auth` core, parameterized by a baked `mode` host prop (`signin`/`register`/`forgot`/`reset`) the route/composite sets (not author-tunable). This introduced the **host-props dimension** the earlier verticals didn't use: `hostCore`/`functionalShell` gained a `props?` arg (forwarded to the kit's `host(component, cls, props)`), the storefront walk already carries `node.props` to `renderHost`, and `<AccountAuth mode={toAuthMode(node.props?.mode)}>` switches to the right self-contained form (each Suspense-wrapped — the forms read their own URL params `redirect`/`token`). The inline forgot form was extracted to `<ForgotForm>`; login/register/reset reuse the existing `<AuthPanel>`/`<ResetForm>`. All four are seeded (commerce-gated — shopper accounts are a commerce concern, matching the footer's Account links) so the studio lists a real "Login"/"Register"/… page a tenant can brand. `authorize` (the MCP/OAuth consent screen) is deliberately EXCLUDED — it's an auth-flow with a signed-grant handoff, not a brandable entry page. The **authed** `/account/(authed)/*` cluster (orders/wishlist/profile/b2b) stays separate: it's `'use client'` with client-side auth and needs a studio mock-session preview path — a distinct sub-project, not covered here.

**Logo-on-wordmark** ✅ (B + scoped A): a tenant could not attach their logo to the header wordmark. Root cause was authoring-side, not data — `site.identity.logo` (`{url, alt}`) is fully wired at render, but (1) no logo-capable brand primitive existed and (2) `SITE_SOURCES` was excluded from the studio binding picker. Fixes: **B** — `brandWordmark()` in `site-chrome.ts`, an `<a href="/">` lockup of an `Image` **pre-bound to `site.identity.logo`** beside the name (`site.identity.name`), registered as a new **"Brand"** catalog group (`SITE_CATALOG`, wired into `host.catalog().extend`; auto-surfaces in the New-component picker via silicaui 0.23). Dropping it into the navbar shows the tenant's logo with zero binding work; delete either part for logo-only / text-only. Bound trees can't do logo-else-text, so both render and a neutral "Logo" placeholder stands in until a logo is set (locked by an engine-level test: logo → `<img src>`, name → text). **Scoped A** — the studio now adds `SITE_SOURCES` to the binding picker's `dataSources` (so an author can bind logo/name onto any frame node), kept OUT of the page-type picker (no bogus `site.social` record type) and the preview root. The clean logo-_or_-text single primitive with an inspector control (option C) remains a **silicaui ask** — bound trees can't express the conditional.

**Per-record functional TEMPLATES** ✅ (two of three): the per-record path — a template keyed by a record type, not a fixed slug — now covers `commerce.category` (category detail) and `scheduling.service` (booking-service detail), joining the existing `commerce.product` / `commerce.collection`. The storage/serve mechanism was already generic (`getPublishedByRecordType`: per-record override → type default → published fallback); what a new record type needs is: **(a)** an array + object binding **source** so the studio's page-settings recordType picker (data-driven from the catalog's `array` sources) offers it — added `commerce.category`/`category` to `COMMERCE_SOURCES` and a new `SCHEDULING_SOURCES` (`scheduling.service`/`service`), wired into `bindingService.getSchema`; **(b)** a code **composite** fallback (`categoryDetailPage()` in `commerce.ts`, `serviceDetailPage()` in the new `scheduling.ts`) registered in `silica.ts`'s `starterCollectionDto`, each just a `functionalShell(<detail core>)`; **(c)** a self-contained pinned **core** — `<CategoryDetail>` (header + subcategories + paginated product rollup, breadcrumbs included since it computes the lineage) and `<BookingServiceDetail>` (service header + the live `BookingWidget`/`ClassBookingWidget`) — registered in `storefrontHostRenderer` with a canvas skeleton in `renderHostSkeleton`; **(d)** the route (`/category/[handle]`, `/book/[serviceId]`) rewritten to `getPublishedSilicaCollection(recordType, recordId) ?? <composite>` → `SilicaFunctionalBody`, passing the record's `recordHandle`/`recordId` through the new `HostCoreContext` fields so the self-contained core resolves its own data. The route keeps the 404/redirect guard; the core owns the record-specific content. No new render primitive was needed — `SilicaFunctionalBody` already carries `host`+`scope`+`renderHost`.

**PDP-as-functional — deliberately DEFERRED (money-adjacent).** The PDP already renders through the per-record silica path (`getPublishedSilicaCollection('commerce.product')` → `productDetailPage()`), and its buy box is a **bind-based composite** made interactive by silica's client behavior runtime (`data-sui-action` on the add-to-cart form) under the HTML-string `SilicaBody` — it is editable today. "PDP-as-functional" would mean **pinning** the buy box as a `locked:"host"` core so a tenant can't delete it from the template, which requires converting the PDP from `SilicaBody` (string) to `SilicaFunctionalBody` (React walk) — a change to a working, money-touching add-to-cart flow. Per the "anything touching money last" sequencing, this waits for the dev server running to verify add-to-cart still fires end-to-end; it is not a typecheck-only change.

**silicaui 0.23 (lockstep):** the `componentStarters` hook shipped exactly to the Option-1 spec — a host's `catalog().extend` groups **auto-surface** in the New-component starter picker (key + label preserved), and the engine reads `host.catalog().extend` automatically. So our commerce composites (product card, products, buy box, collection header) now appear as a **"Commerce"** starter group with **zero** extra wiring. `hostComponents()` (locked cores) are correctly excluded. Optional `componentStarters?(): { extend?, hide? }` is available for future curation.

**Remaining functional routes (Phase 3 continues), each with its own wrinkle:**

- **PDP-as-functional** — pin the buy box (see the deferred note above). Money-adjacent; wants dev running.
- **Auth/money** — **checkout** (money), the `account/*` cluster (auth + 13 `(authed)` dashboard routes — introduce the shell once at the `(authed)` group boundary), the B2B portal (5). These want the **dev server running** to verify they still transact, not just typecheck.

### Phase 3 — Functional pages into silica (all modules)

Bring every module's functional pages into silica as editable shells, each wrapping its existing React functional core as a pinned component. The pinned core is the same tested component, just embedded — every functional guarantee (payment, auth, availability, pricing, order/quote/invoice lookup) is preserved. Sequence by risk (lowest first; anything touching money last):

- **Commerce**: search, account, order-status, cart, **checkout** (last).
- **Scheduling**: booking widget, availability/calendar, appointment confirmation.
- **B2B**: wholesale portal, quote-request, net-terms application, reorder.
- **Quotes**: quote view + accept/sign.
- **Invoicing**: invoice view + pay.
- Any other module surface as it lands.

Each module's functional core registers as a **pinned functional component** (Phase 2, B2) so the tenant can restyle and reposition the surrounding page without deleting or breaking the transaction.

### Phase 4 — Polish / hardening

- Promote **"Featured"** from a `tags` convention to a real product-level flag (schema + admin checkbox + public API field) if desired.
- **"Related"** via real product→collection membership (public product API addition), replacing the newest-fallback.
- **Category picker** UX in the inspector (collection list) + `count` prop wiring.
- **Save-as-custom-component** flows documented for the commerce blocks.
- `docs/help` authoring guidance for the configurable Products block and the page-type model.

## Verification

- Per-phase: typecheck + lint + the touched unit tests; then drive the real storefront (`localhost:3004 ?tenant=wizeworks`) and the studio editor for the affected pages.
- Phase 1 acceptance: the PDP rail shows a **bounded** set (not the whole catalog); switching a Products block's Source in the inspector changes what renders; the card is forkable to a custom component.
- Phase 3 acceptance: every functional page renders and **transacts** correctly with a restyled shell; the pinned core cannot be deleted in studio.

## Non-goals (for now)

- A parallel blueprint/marketplace capture of the finished pages ([118] Phase 3 remains deferred).
- Replacing silicaui's engine or generic blocks — commerce stays our domain layer in `@sparx/silica-catalog`.
