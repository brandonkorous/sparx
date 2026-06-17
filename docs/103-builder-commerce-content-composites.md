# Builder v2 — Commerce & Content composites (the binding-spine payoff)

**Version:** 1.1
**Author:** Brandon Korous / WizeWorks
**Last Updated:** 2026-06-17

> **Purpose.** The binding spine (docs/98 Pillar 7) is finished end-to-end — a node can pin to a product / collection / category / CMS entry, repeat a collection, and carry an add-to-cart action — but **nothing in the component catalog uses it.** A designer who wants to sell or publish has to hand-assemble the buy-box, the repeater, and the article layout from raw atoms every single time. This doc scopes the **comprehensive composites that turn the spine into drop-in building blocks**, plus the modern marketing patterns and page scaffolds a working web designer expects to find in the palette and currently doesn't. It is the catalog-content half of docs/98 §8 acceptance, and it closes the "engine built, no car" gap.
>
> **Status (v1.1 — built; live acceptance pending):** Phases 0–4 are shipped and gate-green (builder-schemas + builder-render tests/typecheck; dashboard + site typecheck) across five commits. All **17 composites** across the three tiers are in the catalog (`commerce` + `content` are new palette categories), plus the `repeat`/`act` authoring helpers and the `counter` runtime behavior. The one remaining item is **Phase 5 — the live-browser acceptance pass** (§5), which also discharges the long-open docs/98 §8 / docs/102 §8 items; it boots three dev servers against the shared dev DB, so it is held for a deliberate run.

---

## 1. Why this doc exists

The catalog today is **~90 entries, but lopsided.** Marketing is richly stocked (heroes, logos, feature grids, testimonials ×3, pricing, comparison, FAQ, CTA, team, newsletter, stats, footers). **Commerce and content are nearly empty of composites** — the closest thing, the generic `card` ([data-display.ts](../packages/builder-schemas/src/catalog/data-display.ts)), binds `product.*` field paths to a **dead "View details" button**: no entity pin, no price, no add-to-cart action, no repeater. So the platform's defining identity — **content AND/OR commerce, both first-class** — does not show up in the Add palette. A publisher sees no "featured article"; a seller sees no shoppable card. That is the gap this doc closes.

The work is **catalog data + a thin slice of authoring/runtime foundation** — not new renderer architecture. Everything the composites need to _resolve_ (pins, sources, actions, scope, the buy-box provider) already ships and is unit/integration-verified. What is missing is (a) two authoring-kit helpers so a catalog tree can _express_ a source/action, (b) two palette categories so the blocks are discoverable, (c) one runtime behavior (an animated counter), and (d) the composites themselves.

## 2. What already exists (reuse, do not rebuild)

- **The binding spine** (`packages/builder-schemas/src/node.ts`, `runtime.ts`): `Binding` accepts `{path}` (field), `{entity,id,cmsType?}` (pin), `{source:{from,id?,limit?}}` (collection repeater), `{action,href?}` (trigger). `resolveBinding` reads `__pins`/`__sources`; `collectBindingRefs` returns all refs; `bindingIsProductScope` is true for a product pin or any source.
- **Scope + buy-box wiring** (`apps/site/components/builder-renderer.tsx`, `packages/builder-render/src/commerce.tsx`): the walker wraps any product-scoped subtree (a product pin, or **each repeated item** of a source) in `<ProductFormProvider>`, so a `Button` with `{action:'add-to-cart'}` placed anywhere inside resolves the right variant automatically. `AddToCart` outside a product scope renders inert (shows its label) — exactly the right unpinned-template behavior.
- **The authoring kit** (`packages/builder-schemas/src/catalog/_kit.ts`): `el` / `atom` / `bound` / `behave` / `part` / `entry`. `bound(node,'path')` writes a **field** binding only.
- **The behavior runtime** (`@sparx/builder-render` behaviors, Pillar 5): a closed set — `carousel` `disclosure` `tabs` `scrollspy` `marquee` `menu`, mirrored in `_kit.ts` `SX_BEHAVIOR_NAMES` and pinned by a cross-package drift test.
- **The catalog categories** (`_kit.ts` `CATALOG_CATEGORIES`): the 8 palette groupings — `layout navigation actions data-display data-input feedback marketing mockup`. `category` is a **validated string, not a DB enum** (docs/98 §5), so adding categories needs **no migration**.

**The three real gaps:** no kit helper writes a `source` or `action`; there is no `commerce` or `content` category; and there is no count-up behavior for animated stats. Foundation (Phase 0) fills exactly those, nothing more.

## 3. Foundation decisions (load-bearing)

### 3.1 Two new catalog categories — `commerce` and `content`

A content-and-commerce platform must speak that identity in the palette. Add two `CatalogCategory` values — `commerce` (Orange, the commerce module color) and `content` (Teal, the CMS module color) — with labels "Commerce" and "Content". Palette order becomes: `layout · navigation · actions · data-display · data-input · content · commerce · feedback · marketing · mockup` (content + commerce sit together, above the generic feedback/marketing/mockup blocks, because they are the highest-intent sections for this platform's users).

This touches only: `CATALOG_CATEGORIES` + `CATALOG_CATEGORY_LABELS` (`_kit.ts`), any exhaustive `Record<CatalogCategory, …>` (the labels map; the palette already iterates the array, so new sections appear automatically), and `catalog.test.ts`. **Verified:** `PlatformComponent.category` is `String @db.VarChar(32)` (not a Prisma enum) and the Zod `PlatformComponentCategory` derives from `CATALOG_CATEGORIES`, so **no migration** — adding the slug to the constant is the whole change.

**Sequencing note:** `catalog.test.ts` requires every `CATALOG_CATEGORIES` value to have ≥1 entry, so each new category slug lands in the **same commit as its first entries** — `commerce` in Phase 1, `content` in Phase 2 — never empty in Phase 0.

### 3.2 Two new authoring-kit helpers — `repeat()` and `act()`

`_kit.ts` gains two helpers mirroring the `Binding` schema exactly, so a catalog tree can express the spine the same ergonomic way `bound()` expresses a field path:

```ts
/** Mark a container a COLLECTION REPEATER — its children render once per product
 *  in the source (`all` | a specific collection/category by id). Each item scopes
 *  its subtree to a product (buy-box context). */
export function repeat(node, source /* {from, id?, limit?} */) {
  node.binding = { source };
  return node;
}

/** Attach an ACTION to a trigger element (add-to-cart / buy-now / link / submit).
 *  An add-to-cart/buy-now button resolves the product an ancestor scope establishes. */
export function act(node, action, href?) {
  node.binding = { action, ...(href ? { href } : {}) };
  return node;
}
```

No `pin()` helper: a catalog **template never carries a concrete entity id** (the tenant picks the record after dropping). Templates are authored with `item.*` bindings + rich static placeholders (§3.3). The CONTRACT.md authoring guide gains a "Binding the spine" section documenting both helpers + the template pattern.

### 3.3 How a template expresses "pin me later"

A shoppable/record composite ships **inert-but-rich**: its leaves carry `bound(atom(…,{text:'real placeholder copy'}), 'item.title')` — the renderer shows the resolved value when a record is in scope, else the static `props.text`. So on the canvas, an unpinned product card shows believable placeholder content and an inert "Add to cart"; the moment the tenant pins it (Data panel → "A record" → a product) or drops it inside a repeater, the same tree renders the real product with a live buy-box. **No id is ever baked into catalog data.** The two ways a template gets its scope:

- **Standalone, tenant-pinned:** the composite's **root container** is the pin target. The tenant selects it and pins a product / collection / category / CMS entry; `bindingIsProductScope` (for a product) wraps it in the buy-box provider.
- **Inside a repeater:** the composite is the child of a `repeat(...)` container; each item scopes it. For CMS arrays (which the commerce `source` schema does not cover — it is `all|collection|category`), the repeater uses the **legacy `cms.<type>` array field-binding** (`bound(container,'cms.blog_post')`), which the walker already iterates with `item.*` scope (no product provider, since it is not a product source).

### 3.4 One new runtime behavior — `counter` (animated stats)

Animated count-up stats need JS the closed behavior set does not have. Add `counter` to the runtime (`@sparx/builder-render` behaviors) and mirror it into `_kit.ts` `SX_BEHAVIOR_NAMES` + the drift test (`behaviors.test.ts`). Spec: a root `behave(node,{type:'counter'})` over N `part(node,'item')` value elements; on first scroll into view (IntersectionObserver, `threshold` param) each item counts from 0 to the integer in its text over ~1.2s, then stops. Canvas previews the final value (no animation), matching the carousel/marquee canvas-suppression convention. This is the **only** runtime extension in this doc; everything else rides existing behaviors. It lands in **Phase 3** alongside its sole consumer (`stats_counter`), not in the Phase 0 foundation.

### 3.5 Explicitly deferred (noted, not silently dropped)

- **Image lightbox** (click a gallery image → full-screen overlay with prev/next). A true lightbox needs a new overlay behavior the closed set lacks; the Tier-2 gallery ships as a **masonry grid** (CSS columns, no JS) and lightbox is a future behavior addition.
- **True-`fixed` cookie/consent bar.** Raw `fixed` is denied in catalog data (only the FAB/Toast/Dialog islands emit sanctioned fixed). The Tier-3 consent banner ships as a **`sticky bottom-0`** bar the tenant places at page end — visually equivalent for the catalog medium.
- **Maintenance page** — folded into `coming_soon` (same scaffold, different copy), not a separate entry.

## 4. The composites (17 catalog entries across three tiers)

Vertical examples are deliberately **varied** (a coffee roaster, an indie bookshop, a ceramics studio, a design newsletter, a boutique studio, an analytics SaaS, a landscape photographer) — the platform is industry-agnostic; no single vertical is the lens. All are `surfaces: ['page','site']` unless noted. Keys are unique across the whole catalog.

### Tier 1a — Commerce (new file `catalog/commerce.ts`, category `commerce`)

| key                 | name                   | kind          | spine used                                                                                |
| ------------------- | ---------------------- | ------------- | ----------------------------------------------------------------------------------------- |
| `product_card`      | Shoppable product card | comprehensive | pinnable root; `item.image/title/price` + `act(Button,'add-to-cart')`                     |
| `product_grid`      | Product grid           | comprehensive | `repeat({from:'all',limit:6})` of the product-card template                               |
| `product_spotlight` | Featured product       | comprehensive | pinnable hero: gallery + buy-box (`item.price`, variant chips, qty, add-to-cart, buy-now) |

`product_card` is the keystone — the buy-box version of today's content `card`. `product_grid` is the repeater that proves the source half ("a real store grid, not 6 static tiles like `card_grid`"). `product_spotlight` is a single-product hero and is exactly docs/98 §8's "pin a featured card to a specific product whose Add to cart adds the right variant."

### Tier 1b — Content (new file `catalog/content.ts`, category `content`)

| key                | name             | kind          | spine used                                                                                     |
| ------------------ | ---------------- | ------------- | ---------------------------------------------------------------------------------------------- |
| `featured_article` | Featured article | comprehensive | CMS record pin; `item.featuredImage/title/publishedAt/excerpt` + read-more `act(_,'link')`     |
| `article_body`     | Article body     | comprehensive | CMS pin; `item.title` + byline + Prose bound `item.body`; optional in-page TOC via `scrollspy` |
| `post_grid`        | Post grid        | comprehensive | legacy `cms.blog_post` array repeater of post cards (tenant re-points the type)                |

The content twins of the commerce trio: a publisher pins a content entry and the section renders its real title/body/hero. `article_body`'s TOC is the best real use of the existing `scrollspy` behavior.

### Tier 2 — Marketing patterns designers expect (extend `marketing.ts` / `interactive.ts`)

| key               | name                | kind          | mechanism                                                       |
| ----------------- | ------------------- | ------------- | --------------------------------------------------------------- |
| `bento_grid`      | Bento grid          | comprehensive | asymmetric feature mosaic (CSS grid spans), atoms inside        |
| `stats_counter`   | Animated stats      | comprehensive | `counter` behavior (§3.4) over `Stat` items                     |
| `pricing_toggle`  | Pricing with toggle | comprehensive | `tabs` behavior switching monthly/annual price sets             |
| `gallery_masonry` | Masonry gallery     | common        | CSS multi-column image grid (lightbox deferred, §3.5)           |
| `video_hero`      | Video hero          | common        | wraps the existing `EmbedFrame`/poster atom + a play affordance |
| `process_steps`   | How it works        | common        | horizontal numbered step row, responsive collapse               |

### Tier 3 — Page scaffolds & utility (extend `layout.ts` / `feedback.ts` / `marketing.ts`)

| key                  | name            | kind          | category  | notes                                                                         |
| -------------------- | --------------- | ------------- | --------- | ----------------------------------------------------------------------------- |
| `coming_soon`        | Coming soon     | comprehensive | layout    | full-bleed centered hero + newsletter capture (also the maintenance scaffold) |
| `error_404`          | 404 page        | common        | layout    | centered not-found with a home action                                         |
| `cookie_consent`     | Consent banner  | comprehensive | feedback  | `sticky bottom-0` accept/decline bar (§3.5)                                   |
| `contact_section`    | Contact section | comprehensive | marketing | heading + the existing `contact_form` + an `EmbedFrame` map                   |
| `sale_countdown_bar` | Sale countdown  | comprehensive | marketing | slim announcement strip wrapping the existing `Countdown` atom                |

## 5. Phasing (deploy-early; each phase its own commit/PR, gate-green)

- **Phase 0 — Foundation.** `repeat()`/`act()` in `_kit.ts` + CONTRACT.md doc + a helper unit test. Nothing tenant-visible; unblocks every commerce/content composite. Ships independently.
- **Phase 1 — Commerce composites.** Add the `commerce` category (+ label) AND `catalog/commerce.ts` (3 entries) in one commit (the category can't be empty) → register in `catalog/index.ts`, catalog tests, deploy. The first phase a tenant sees a shoppable card.
- **Phase 2 — Content composites.** Add the `content` category (+ label) AND `catalog/content.ts` (3 entries) → register, tests, commit.
- **Phase 3 — Marketing patterns** (6 entries across `marketing.ts`/`interactive.ts`) → tests, commit. **Includes the `counter` runtime behavior** (§3.4) for `stats_counter`: add to the runtime registry + the `_kit.ts` `SX_BEHAVIOR_NAMES` mirror + the `behaviors.test.ts` drift test, then the composite.
- **Phase 4 — Page scaffolds & utility** (5 entries across `layout.ts`/`feedback.ts`/`marketing.ts`) → tests, commit.
- **Phase 5 — Live acceptance.** Boot api-rest + dashboard + site against seeded data; in the editor: drop `product_grid` (repeats real products), pin `product_spotlight` to a product and confirm Add-to-cart adds the right variant on the published page; pin `featured_article` to a real post; drop `stats_counter` and confirm count-up live but static on canvas; confirm canvas == published for each. This **discharges docs/98 §8 and docs/102 §8** (the long-open live-browser items) in the same pass. Then revert the test page.

Phases 1–4 are independent given Phase 0 and can land in any order; each is a self-contained catalog batch behind no flag (published catalog data is identical for every tenant).

## 6. Verification

- **Per entry:** `catalog.test.ts` validates every `tree` against `BuilderNodeSchema` at module load (a malformed binding/tag fails the build, not the stamp). Add assertions: each new category is known; each commerce composite carries exactly one product-scope root or `repeat`; each `act('add-to-cart')` sits inside a product scope.
- **Foundation:** unit tests for `repeat()`/`act()` (shape matches `Binding`); the `counter` behavior drift test (`behaviors.test.ts` mirror) + a render test (canvas shows final value, live counts up).
- **Gates:** `pnpm format && pnpm lint && pnpm typecheck` across `builder-schemas → builder-render → site → dashboard`; the pre-push RLS audit. Catalog files are data-as-code (line-limit-exempt); the kit/behavior changes respect the ≤250/≤50 cohesion budget.
- **Live (Phase 5):** the browser acceptance above.

## 7. Out of scope (noted, not dropped)

Image lightbox + true-`fixed` overlays (§3.5); a separate maintenance entry (folded into `coming_soon`); the DB-backed `PlatformComponent` admin UI (the API already ships — these entries seed straight in via the existing data-as-code pipeline); reproducing more than 2–3 reference mockups (docs/98 §8 stretch); re-skinning the one flagged `comparison_table` onto `st-table` (docs/102 follow-up, unrelated).

## 8. Risks / footguns

- **New category compile surface:** any `Record<CatalogCategory, …>` must gain the two keys or TypeScript fails — find them all (the labels map is the known one).
- **`counter` drift test:** the runtime is the source of truth; the `_kit.ts` mirror + `behaviors.test.ts` assertion must move together, or the cross-package test fails.
- **Repeater item-template semantics:** confirm at build time that a `source`-bound container repeats **all** its children per item (the intended product-card template) vs. only the first — author to whatever the walker actually does.
- **CMS type keys vary per tenant:** `post_grid` ships defaulting to `cms.blog_post`; document in its description that the tenant re-points the source if their type differs (the pinnable content entries carry no type, so they are unaffected).
- **Shared checkout / parallel agents:** a separate inventory agent has dirty files in this working tree — stage only this work's paths, never `git add -A`; the pre-push guard runs the whole tree, so coordinate the push.
