# 118 — Builder → silicaui-html Migration Plan

**Version:** 1.1
**Author:** Brandon Korous
**Last Updated:** 2026-07-10

> **STATUS (2026-07-10) — engine adoption SHIPPED; storefront on silica for four routes; legacy deletion GATED.**
> The silica `<Builder>` engine is the studio (`/builder/silica`), and the storefront renders silica end-to-end for the **home, catch-all page, product detail (PDP), and blog** routes — each path being: silica-published-tree → shared host resolver → `renderSilicaBody`, winning over the sparx-builder + legacy-section fallbacks. Landed this pass:
>
> - **Render cutover (Stage 6).** All four routes resolve a published silica tree first. A silica `commerce.product` / `cms.blog_post` **collection template** renders per-record with the routed record injected as the object scope (a collection-of-one); the interactive buy box adds to cart through `hydrate() → onAction`. New seam: `siteService.getPublishedByRecordType` (silica) → `/v1/public/builder/silica/collection` → `getPublishedSilicaCollection` → the PDP/blog silica branches.
> - **Editor host completeness (Stage 10).** The studio host now carries a **media picker** (`pickAsset`, bridged to the asset library), a header **save/changed indicator** + **page-settings** surface (silicaui's v0.14 `toolbarSlot`, reading the active page via `useEditor()` since the slot renders inside `EditorProvider`), and page-level **SEO + record-type** authoring persisted to the `BuilderPage` row columns — silica's flat `Page` (`{id,name,slug,root}`) has no home for domain metadata, so it lives on the row, edited through the same page endpoints (the silica page id IS the row id). Setting a record type flips a page to a collection template (kind derived from recordType).
> - **Seed.** A published silica product-detail template ships in the DB seed so the demo storefront renders a real PDP without hand-authoring.
> - **Deferred (with reason):** the node-scoped **product-pin** inspector panel — it needs a product-picker data path that doesn't exist cleanly yet, and the grid/PDP/rail already cover commerce binding via scope + collection.
>
> **Still GATED — do NOT delete legacy yet.** The legacy render clusters (`@sparx/site-ui`, the sparx `BuilderRenderer` storefront half, `surface-compile`'s compile pipeline + `/styles`, the section renderer + `sections/*`) remain the FALLBACK beneath silica, and the **`collections/[handle]`** route has **no silica path at all** (its section renderer is the sole renderer, not a fallback). Deletion is safe only once silica covers home + page + PDP + blog + **collections** + frame for every tenant. `@sparx/builder-render` (dashboard editor canvas + serializer) and `surface-compile/allowlist.ts` (governance) are **retained**, not deleted. Full deletion map: brain builder node + [119](119-silicaui-builder-gap-questions.md).

> **Purpose.** This is the **sparx-side execution plan** for migrating the Builder and the storefront (`apps/site`) off sparx's bespoke render stack (`@sparx/site-ui` `st-*` classes + `surface-compile`'s `--st-*` theme) and onto the **silicaui design system + `@wizeworks/silicaui-html` document/component model** — while **keeping the sparx builder engine** (the two-zone studio, the binding/scope/iteration runtime, collections, publish, per-site scoping). It is the complement to [silicaui-site-ui-parity-spec.md](silicaui-site-ui-parity-spec.md) (what silicaui must do) and to the two silica-repo contracts ([`silicaui/docs/builder-contract.md`](../../silicaui/docs/builder-contract.md), [`silicaui/docs/blocks-contract.md`](../../silicaui/docs/blocks-contract.md)).
>
> **⚠️ DECISION SUPERSEDED (2026-07-09) — this plan now ADOPTS silica's engine.** The original thesis below ("keep sparx's builder, only retarget its rendering") was correct against silicaui-builder **0.8.0**. It no longer is. WizeWorks owns silicaui and is funding the engine to close its gaps (see [`silicaui/docs/builder-engine-roadmap.md`](../../silicaui/docs/builder-engine-roadmap.md), which answers [doc 119](119-silicaui-builder-gap-questions.md)'s load-bearing five). With no production tenants yet, the calculus flipped: **sparx adopts `<Builder host={…}>`, deletes its own editor chrome + canvas walker + inspector + `renderLeaf`, and becomes a thin host** over the silica engine. There is **no data backfill** — the only tenant data is regenerable seed, so it is a **re-seed**, not a migration. The **target state ([§1.0](#10-target-state-the-north-star--replace-do-not-bridge)) is unchanged and now lands harder**: the silica packages + one static app sheet + a per-tenant theme file, nothing bespoke.
>
> **What that changes in this doc.** The _document/theme/apps-site_ workstreams (WS-2/4/5/6/8) still stand — the document must go silica-native either way. But: **WS-3 (render) retargets to silica's shared `resolveTree` renderer, not sparx's `renderLeaf`** (build the render path once); **WS-7 (chrome re-skin) is DELETED, not held** — the chrome is removed, not re-skinned; **WS-9's backfill becomes a re-seed**; and the sparx side gains a **`BuilderHost` adapter** (catalog / dataSources / validateClass / inspectorPanels / pickAsset). The staged sequence lives in [§4](#4-sequencing) as revised. The silica-side engine work (F1 host seam + security floors, F2 the `resolveTree` data layer) is owned by the silicaui repo; sparx consumes it as it lands.
>
> **Read this first, one line (superseded thesis, kept for context).** ~~This is **not** the tool swap — we do **not** adopt silica's `<Builder/>` engine (it has no data-binding/collection renderer and cannot render a data-bound sparx site). We keep sparx's builder + its render-with-data runtime, and migrate three things: **(1)** the styling vocabulary + component output, **(2)** the persisted document's class strings, and **(3)** the editor chrome.~~ The document/render/apps-site migration is still required; only the _editor_ decision inverted (adopt, don't keep).

---

## 1. Decision & scope

### 1.0 Target state (the north star — replace, do not bridge)

The migration is done when a rendered tenant site is exactly this and **no more**:

> **the silica packages, included** (`@wizeworks/silicaui` plugin + `-react`/`-html`/`-behaviors`) **+ one static app stylesheet** (silica's plugin output, emitted **once** by `apps/site`'s own Tailwind build — silica ships as plugin _source_, no dist sheet) **+ a per-tenant theme file** (`--color-*` / `--radius-*` / `--font-*` token values). **No other complexity exists.**

Everything that is not one of those three things is **deleted, not translated**:

- **No `@sparx/surface-compile` per-tenant compiler.** Per-tenant CSS compilation is removed. The static app sheet already carries every component + safelisted utility any tenant can author; only _token values_ vary per tenant, and those are the theme file. (This rests on the builder's authorable class vocabulary being **bounded/safelistable** — the one hinge, verified before Phase B; if any inspector control emits freeform arbitrary values it is constrained to a fixed scale, not exempted.)
- **No `--st-*` namespace.** `site-themes/v2` emits silica-native `--color-*`/`--color-*-content`/`--radius-*`/`--font-*` **directly** (the WCAG `-content` derivation logic stays — it beats silica's auto fallback and overrides it — but under silica's names). The canonical `--st-*` block and its legacy aliases are removed.
- **No `st-*` recipe/component classes.** `@sparx/site-ui`'s stylesheet is **deleted**; silica's `@plugin` is the _sole_ emitter of all component CSS. render output speaks silica's flat vocabulary (`btn btn-primary btn-soft`, `card card-body`, …).
- **No hand-authored `@theme` remap, no allowlist-as-compile-gate.** The allowlist demotes to an **author-time hygiene validator** (a dangerous class like `fixed`/`z-[9999]`/`url(...)` simply has no CSS behind it in the safelisted sheet — security by omission).

This is the parity-spec §12 endgame ("sparx stops being a design-system author, becomes a consumer") taken to its conclusion. The WS-\* below are the mechanical path to it; wherever a workstream says "retarget," read it as "replace and delete the old thing" per this section.

### 1.1 What we are doing

- **Replace the render output** — delete every `@sparx/site-ui` (`st-*`) reference at the **one shared seam** both surfaces funnel through (`@sparx/builder-render`'s `renderLeaf`); emit silica component classes / silicaui-react instead.
- **Delete the per-tenant CSS compile.** Retire `@sparx/surface-compile`'s hand-authored `--st-*` `@theme` block; move to a **build-once** silica `@plugin "@wizeworks/silicaui"` app sheet + a bounded utility **safelist**. Per-tenant variation is a **theme file only** (§1.0).
- **Migrate `apps/site`** (the storefront) to render silica elements/styles — same document, same renderer, same result as the canvas.
- **Re-author the catalog** (`packages/builder-schemas/src/catalog/*`) and the seed factories against silica classes.
- **Re-skin the editor chrome** (`.bx-*` → silicaui-react components) — keeping the sparx engine intact. _(HELD, §1.4.)_
- **Backfill persisted tenant data** (draft/published trees, saved components, archetypes, themes) so stored `class` strings speak silica's vocabulary — a one-shot codemod, after which the `st-*` source vocabulary is gone.

### 1.2 What we are explicitly NOT doing (now — see §1.4 for the destination)

- **NOT adopting `@wizeworks/silicaui-builder`'s `<Builder/>` engine — yet.** Two reasons, both verified in the 0.8.0 source (2026-07-09):
  1. **The host seam is speced but not shipped.** [`builder-contract.md`](../../silicaui/docs/builder-contract.md) describes a `mountBuilder(el, { document, host })` with a `BuilderHost` adapter (`resolveBinding`/`resolveCollection`/`catalog`/`validateClass`/`inspectorPanels`/`pickAsset`). A grep of `packages/silicaui-builder/src` for every one of those symbols returns **zero** — the shipped `<Builder/>` takes only `document`/`studioTheme`/`onChange`/`onPublish`/`persistKey`. Adopting it today would strand **all** of sparx's domain integration (bindings, catalog, allowlist, domain inspector panels, collection templates) because there is nowhere to hand it back in.
  2. **The engine never removes the hard part anyway.** It ships **no data-binding, collection-repeat, or conditional renderer** for the _published_ site — `toHtml`/`renderSite` take no data; the engine's `repeat` drives only the editor-canvas preview; the only `resolve` consumer in `silicaui-behaviors` is form-field prefill. So the storefront keeps sparx's binding runtime **regardless** of who owns the editor.

  Keeping sparx's engine for now is not a preference — it is required until the seam ships (§1.4).

- **NOT changing the database schema.** Every builder tree is opaque `JSONB` (`draft_tree`, `published_tree`, component/archetype `tree`, `prop_spec`). No typed columns, no generated columns, no JSON-path indexes. The document-model change needs a **data backfill, not a `prisma migrate`**.
- **NOT rebuilding the binding runtime.** `runtime.ts` (`resolveBinding`/`resolvePath`/`cardinalityOf`, scope threading, `__pins`/`__sources`, array-iteration, product-context) is the platform's core value over a static projector. It is preserved verbatim.

### 1.3 The load-bearing invariants (preserve, do not touch)

| Invariant                                                             | Where                                                                                | Why it stays                                                                                           |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `BuilderNode` document shape (`id/type/props/binding/class/children`) | `packages/builder-schemas/src/node.ts`                                               | Already near-identical to silicaui-html's `Node`; stored data.                                         |
| The binding/scope/iteration runtime                                   | `builder-schemas/src/runtime.ts`, `apps/site/lib/builder-data.ts`, both host walkers | silicaui-html has **no** equivalent. This is what makes sparx a platform, not a static-site generator. |
| Layout↔page Outlet composition                                        | `Outlet` node (pinned), `BuilderSiteChrome`, `apps/site/app/layout.tsx`              | Maps 1:1 to silicaui-html's `Frame`/`Outlet`; keep the single-slot model.                              |
| Raw-element security boundary                                         | `builder-schemas/src/element.ts` (`RAW_ELEMENTS`, `safeElementAttrs`)                | Independent of styling; reusable as-is.                                                                |
| The utility allowlist choke point                                     | `surface-compile/src/allowlist.ts`                                                   | Retune the vocabulary, keep the gate.                                                                  |

### 1.4 The destination: adopting the engine later (Phase F, gated)

This plan is the **on-ramp to** adopting silica's builder engine, not an alternative to it. The parity-spec §12 endgame is "sparx becomes a host/consumer, not a design-system author," and the biggest maintenance prize is deleting the editor **chrome + canvas walker** (`builder.css` 4060 lines, `inspector.tsx` 5082, `canvas.tsx` 1620, the walkers) in favor of `mountBuilder(el, { document, host })` + a thin `BuilderHost` adapter.

Doing WS-3/WS-4 first makes that swap **small and safe**: once the canvas and storefront both speak silica, the eventual engine swap is isolated to chrome + canvas (the document, binding runtime, and storefront are already silica-native). So the destination is deferred, not abandoned — a gated **Phase F**, decided when **both**:

- silicaui-builder ships the `BuilderHost` seam at ~1.0 (host data resolution, catalog injection, `validateClass`, domain inspector panels), **and**
- sparx's deep, domain-fused features are proven to map onto that seam without loss: the two-zone layout+page studio, collection templates, the Fields panel, component versioning, per-site scoping, and the publish pipeline.

> **The gate questions are enumerated generically in [doc 119](119-silicaui-builder-gap-questions.md).** It frames every silicaui-builder gap as a host-reusable design question and identifies the **"load-bearing five" (Q1/Q2/Q3/Q10/Q19)** — the data-primitive layer, the host catalog, and _one shared data-capable renderer_ — as the seam that unlocks Phase F. If WizeWorks funds those (it owns silicaui), Phase F becomes the better approach and WS-7 is skipped; doc 119 §11 works through that re-evaluation.

**Concrete consequence for this plan:** because Phase F would delete the editor chrome, **WS-7 (re-skinning `.bx-*` → silicaui-react) is HELD pending the Phase-F decision** — do not polish ~1600 lines of chrome we may delete. If Phase F is confirmed as the near-term destination, skip WS-7 entirely and swap the engine instead; if the seam stays unshipped, do WS-7 so the current editor doesn't lag the rest of the platform on silica. Everything else in this plan (document model, render seam, apps/site, catalog, backfill) is required either way and is unaffected by that decision.

---

## 2. Why this is tractable (the grounded findings)

Four architecture sweeps (2026-07-09) establish the migration is **concentrated**, not sprawling:

1. **The node shapes were designed to converge.** silicaui-html's `Node` (`kind:"element" tag` | `kind:"component" component` | `outlet`, `class` as the sole styling surface, attrs/text/props on `props`, `children`) and the builder-contract's `BuilderNode` are sparx's `BuilderNode` shape. Deltas are minimal: silicaui drops `id` on templates (sparx mints on stamp — same invariant), and uses `slot`/`data` markers where sparx uses its `binding` union. The blocks-contract §10 documents the sparx adapter as an explicit **"rename-and-mint, near-identity"** table. sparx's four binding kinds (field/entity/collection/action) map onto silicaui-html's `data: {kind:"value"|"collection"|"action"}` + `slot`.

2. **One shared renderer feeds all three surfaces.** The editor canvas (`canvas.tsx`), the storefront (`apps/site/.../builder-renderer.tsx`), and the View-HTML serializer (`serialize-html.tsx`) all call **`@sparx/builder-render`'s `renderLeaf`** for leaf output. Retarget that one map (+ `renderSiteUiAtom`) and all three move together. The host _walkers_ (which own binding/iteration) stay; only the leaf _output_ changes.

3. **Storage is schema-agnostic.** Opaque `JSONB` everywhere → no DB migration. The API routes are pass-throughs (they don't import `@sparx/builder-schemas`); validation is one Zod choke point in `@sparx/builder`. Publish emits payload-only events with **no consumers** (no reindex, no cache bust, no compiled artifact — CSS is compiled lazily at read). So the blast radius of a document-shape change is: one schema, the DTOs that embed `tree`, and four shape-coupled tree-transforms.

4. **The chrome is already on silica color tokens.** `builder.css` (4060 lines / 396 `.bx-*` classes) already references `--color-base-*`. The re-skin swaps _component shapes_ (toolbar/tabs/splitter/cards/sliders → silicaui-react), not colors. ~1600 lines map to components; ~1100 lines (canvas frames, drag/align overlays, box-model & swatch pickers) stay bespoke by design.

### 2.1 The current pipeline (what we are re-pointing)

```
STORE   BuilderNode tree (JSONB: draft_tree / published_tree)
  │
COMPILE surface-compile: collectClasses → validateClasses(allowlist) → compileClasses(@theme→--st-*) → hash
  │       served at /v1/public/builder/styles ; canvas live-compiles via useSurfacePreview scoped to .bx-canvas
  │
LOAD    builder-data.ts: collectBindingRefs → fetch products/CMS/collections → park under root.__pins / root.__sources
  │
WALK    host walker (RenderNode in apps/site  ||  CanvasNode in dashboard):
  │       resolveBinding(scope, node.binding) → cardinality → iterate array | scope object | Outlet composes layout↔page
  │
RENDER  ── @sparx/builder-render renderLeaf(node, {mode, surface, leafClass}) ──►  @sparx/site-ui st-* components
LEAF        (ONE map; both walkers + serialize-html call it)
```

The migration re-points exactly **two boxes**: `COMPILE` (→ silica plugin tokens) and `RENDER LEAF` (→ silica classes/components). `STORE`, `LOAD`, `WALK` are preserved (with `STORE`'s _contents_ backfilled).

---

## 3. Workstreams

Nine workstreams. Dependencies noted; sequencing in §4.

### WS-1 — silicaui readiness gate (prerequisite, silica repo)

Per the parity-spec §13 gap list, close the additive gaps **before** cutover, or the cutover stalls discovering them. In `g:/code/@wizeworks/silicaui`:

- **Vocabulary parity (data contract):** ship `danger` in the default color list + TS union; add `glass` treatment; alias/rename `dash → dashed`.
- **Field treatments:** `filled` / `ghost` input variants composing like buttons.
- **Missing tokens:** themeable `shadow-sm|md|lg`, `--font-heading/body`, container-width, spacing-base reflow.
- **Structural primitives:** named `section` / `container` / `grid` (builder + email named-node surfaces).
- **Presets:** express the 6 packs (`apex/industrial/drift/market/fleet/drop`) as `@plugin "@wizeworks/silicaui/theme"` blocks; round-trip saved themes.
- **Behavior-runtime parity:** confirm the `behave()`/`part()` marker vocabulary matches silica's (both lower the same names to their own `data-*` prefix — sparx `data-sx-*`, silica `data-sui-*`).

**Exit:** the parity-spec §13 scorecard is all ✅ for the vocabulary + tokens sparx's catalog references.

### WS-2 — Class-vocabulary mapping table (the data contract)

Author the **canonical `st-* → silica` map** — this governs WS-3, WS-6, and the WS-9 backfill. It is a data schema (persisted tenant `class` strings), so it must be frozen before any backfill runs.

- Recipe classes: `st-btn st-c-<color> st-v-<treatment> st-btn--sz-<sz>` → `btn btn-<color> btn-<treatment> btn-<sz>` (mind `dashed`, `danger`, `glass`).
- Token utilities: `st-*`-compiled `bg-primary`/`text-base-content`/`rounded-box`/`gap-6` already ARE Tailwind-native token utilities in the authored string — they survive; only the **compile target** (`--st-*` → silica `--color-*`) changes (WS-4). Verify each against silica's emitted classes.
- Component-part classes: `navbar navbar-start/center/end`, `card card-body/card-actions`, etc. — confirm silica parity (parity-spec §3).
- Output: `packages/builder-schemas/src/migrations/st-to-silica.ts` (a pure, tested string→string mapper) reused by both the catalog rewrite and the DB backfill so they cannot drift.

### WS-3 — Retarget the leaf renderer (`@sparx/builder-render`)

The core swap seam. In `packages/builder-render/`:

- `render-leaf.tsx` (`renderLeaf`, ~905 lines): replace every `@sparx/site-ui` component reference (`<Heading>`, `<PriceTag>`, `<Logo>`, …) and every emitted `st-*` class with the silica equivalent — either a **silicaui-react** component (for React-rendered leaves) or **raw element + silica classes** (matching how silicaui-html's `expand()` lowers a component). Keep `mode`/`surface`/`leafClass` params and the `CLASS_ON_LEAF`/`leafWearsClass` predicate unchanged.
- `site-atoms.tsx` (`renderSiteUiAtom`, ~48 atoms): remap to silica atoms.
- Interactive islands (`commerce.tsx`, `carousel.tsx`, `contact-form.tsx`, `signup.tsx`, `account-menu.tsx`, `dialog.tsx`, `lightbox.tsx`) + `behaviors/` runtime: restyle to silica classes; keep the `data-sx-*` marker runtime (or converge to silica-behaviors — decide in WS-1).
- `serialize-html.tsx` (View-HTML): migrate in lockstep — it is the third consumer of the same output vocabulary.

**Risk:** this one file drives canvas + storefront + View-HTML. Snapshot-test the emitted markup per node type before/after (§5).

### WS-4 — Retarget the CSS compile (`@sparx/surface-compile`)

- `theme.ts`: replace the hand-authored `@theme{}` `--st-*` remap with silica's `@plugin "@wizeworks/silicaui" { colors: … , danger, module-* }` + `@plugin "@wizeworks/silicaui/theme"` (tenant tokens injected as `--color-*`). The `.navbar` `@layer components` rules become silica's navbar component classes (silica ships the verbatim-daisyUI navbar per parity-spec §3).
- Keep `collectClasses` (tree-shake authored literals), `contentHash`, and the dual output (`styles.css` global + `styles.canvas.css` `@scope(.bx-canvas)`), per parity-spec §5.
- `allowlist.ts`: retune to silica's utility surface (still deny `fixed`/`z-[…]`/`content-[…]`/`url()`); the gate stays.
- Tenant theme bridge: `packages/site-themes` v2 already derives WCAG `-content` and injects `:root` tokens — repoint its var names to silica's `--color-*`/`--color-*-content` (parity-spec §1: silica _consumes_ `-content`, sparx keeps deriving it).

**Dependency:** the tenant `--st-*` producer (`site-themes/tokens.ts`) already bridges to silica base tokens (per the token-convergence work) — verify and finish.

### WS-5 — Recipe seeds & box→class (`box-to-class.ts` + registry defaults)

- `box-to-class.ts`: the build-time `boxLayoutClass()` compiler and `seedNode()` factory emit token utilities (`bg-base-200`, `p-6 @3xl:p-10`, `grid-cols-1 @2xl:grid-cols-2`) — mostly silica-native already; audit each emitted token against silica.
- `registry.tsx` `makeNode()` `defaults.class` recipe seeds: rewrite `st-btn st-c-*` seeds → `btn btn-*` via the WS-2 mapper.
- `migrateNode`/`migrateTree` (legacy box-object → class): confirm they still run; extend if needed for the backfill.

### WS-6 — Re-author the catalog & seed chrome (`builder-schemas/src/catalog/*` + `site-chrome.ts`)

- Every `PlatformCatalogEntry.tree` (~12 category files) is a `BuilderNode` authored with `st-*`/token classes via `_kit.ts` (`el`/`atom`/`bound`/`repeat`/`act`/`behave`/`part`). Re-author against silica classes — a large but **mechanical** data rewrite (no renderer branches; the entries are stamped, forked into pages).
- **Opportunity (blocks-contract §10):** where a catalog entry maps to a silicaui-html **block** (navbar, hero, feature grid, pricing, footer, FAQ, CTA, testimonials — silica ships 18), replace the hand-authored tree with `adaptBlock(silicaBlock)` — a near-identity adapter (passthrough `type`/`class`/`props`/`children`, map `slot`→`binding`, rename `role` key, mint `id`). This shrinks the catalog from hand-authored trees to imported blocks + a thin adapter. Decide per-entry: adapt-a-block vs keep-hand-authored (commerce/CMS composites with deep bindings likely stay hand-authored).
- `site-chrome.ts` `navbar()` seed: emit silica `navbar navbar-start/center/end`.
- `CONTRACT.md`: update the authoring token allowlist to silica's vocabulary.

### WS-7 — Re-skin the editor chrome (`apps/dashboard/.../builder/_builder/` + `builder.css`) — HELD, see §1.4

> **Gate:** this workstream is **on hold pending the Phase-F decision (§1.4).** If sparx adopts silica's builder engine, this chrome is deleted, so re-skinning it is wasted work — skip WS-7 and do Phase F instead. Do WS-7 only if the engine swap is deferred long enough that the current editor visibly lags the platform on silica. The rest of the plan does not depend on WS-7.

Keep the engine (`use-studio-editor.ts`, `use-builder-editor.ts`, `class-controls.ts`, `registry.tsx`, `binding-catalog.ts`, `model.ts`, both walkers). Re-skin chrome, ordered by effort (from the chrome sweep):

1. **Toolbar controls** (`site-studio.tsx`): device toggle → `ToggleGroup`; save-state → `Badge color={statusTone}`. _(~1–2h)_
2. **Rail/pane nav** (`builder-workspace.tsx`): `.bx-rail__tab` + `.bx-paneswitch` → `Tabs`/`ToggleGroup`. _(low)_
3. **Layers/fields action buttons & rows**: `.bx-layers__act` → `Button variant="ghost"`; field rows → `Card`/`Badge`. _(low–med)_
4. **Rail/canvas splitter** → `@wizeworks/silicaui-panels` — **highest-coupling**: preserve the `--bx-rail-w`/`--bx-side-w` CSS-var width contract, the `useMediaQuery('(min-width:1024px)')` desktop gate, the collapse-to-`2.75rem` strip, and the mobile stack. _(med)_
5. **Inspector containers & simple controls** (`inspector.tsx`, 5082 lines / 199 `bx-` uses — the bulk): `.bx-card`/`.bx-grp`/`.bx-subgroup` → `Card`/`Accordion`; `.bx-seg` → `ToggleGroup`; `.bx-slider`/opacity → `Slider`/`Range`; `.bx-adv` → `Collapsible`; conflict warnings → `Alert`. Form inputs are already silica — this is container/section/segment/slider chrome. _(high, mechanical)_
6. **Modals/panels** (merge-tags, nav-menu, link-target, icon-picker, shortcuts): → `Dialog`/`DropdownMenu`/`Popover`/`Command`. _(med, partly done)_
7. **Keep bespoke (do NOT re-skin):** color swatches (`.bx-sw*`), preview tiles + position pad (`picker-fields`/`tile-demos`), box-model/quad widgets (`.bx-box`/`.bx-pospad`/`.bx-quad`), canvas frames (`.bx-browser`/`.bx-bezel`/`.bx-envelope`), node selection overlay, drag/align guides, zoom control, and the `styles.canvas.css` render path. ~1100 lines with no silica equivalent, geometry-critical.

**Caution:** the layer rows are dnd-kit sortable — re-skin visuals only, do not restructure the sortable DOM (the `makeId` global-uniqueness invariant).

### WS-8 — Migrate `apps/site` (the storefront consume-side)

The flip side of WS-3/WS-4 — same document, same renderer, so it largely _follows_ WS-3, but apps/site owns its own layout/head wiring:

- `app/layout.tsx`: the theme `<style>` + `<style data-surface-tenant>` (compiled CSS) injection repoints to WS-4's silica output; `BuilderSiteChrome` (Outlet composition) is unchanged logic.
- `components/builder-renderer.tsx` (`RenderNode` walker): **unchanged** (binding/iteration/Outlet) — it delegates leaves to WS-3's retargeted `renderLeaf`.
- `lib/builder-data.ts` + `builder-commerce-data.ts`: **unchanged** (data loading/`__pins`/`__sources`).
- Any hand-authored `apps/site` chrome using `@sparx/site-ui` React directly → swap to silicaui-react (Mode-1 consumption, blocks-contract §10) or silica blocks' generated React.
- Retire the `@sparx/site-ui` stylesheet import once WS-3 emits silica classes.

### WS-9 — Backend transforms + data backfill (`@sparx/builder-schemas`, `@sparx/builder`, DB)

- **Validation choke point:** update `BuilderNodeSchema` + input schemas (`CreatePageInput`/`UpdatePageInput`/component/archetype/email) in `@sparx/builder-schemas`. `type` stays a free string, so the schema barely changes; the change is the **class allowlist** the validator enforces (align to silica).
- **Port the 4 shape-coupled transforms** (all in `packages/builder/`): `expandTreeForPublish` (custom-component `$ref` expansion), `syncFormDefinitions` (ContactForm extraction), the `findNodeById`/`collectNodesByType` walkers, and `collectClasses` (reads `node.class`). The shape is preserved, so these are **light** — mainly verifying `node.class` semantics under the new vocabulary.
- **Data backfill (the real work):** transform every persisted tree's `class` strings via the WS-2 mapper — `BuilderPage.draft_tree`/`published_tree`, `BuilderLayout.*`, `BuilderEmail.*`, `BuilderComponentVersion.tree`, `BuilderArchetype.tree`, `PlatformComponent.tree`, plus saved themes. **No schema migration** (opaque JSONB) — this ships as a **seed-style backfill script run through the DB Migrate workflow** (`gh workflow run db-migrate.yml`), NOT a local run. Tenant-scoped `builder_*` tables are FORCE-RLS → the backfill must loop tenants with `set_config('app.tenant_id', …)` per tenant (`sparx_owner` is non-superuser in prod — the documented footgun).
- **Pre-launch reality:** there is no production tenant data yet, so the backfill target is **seed + demo data** — trivial, and it makes the parity-spec §11 "big-bang, not hybrid" decision safe. Still write the mapper + script properly (humans hand-edit seed data; it must round-trip).
- **Wire format:** DTOs embedding `tree` move lockstep; the MCP builder tools (`packages/builder/src/mcp/*`) and the public storefront reads consume the same shape — verify.

---

## 4. Sequencing

Two hard ordering rules: **(a)** never delete a source before its consumers move; **(b)** the render seam (WS-3) and the compile seam (WS-4) must land together, or the canvas/storefront render half-styled.

**Revised for engine adoption (2026-07-09).** The silica-side engine work (Stage 1/2) is owned by the **silicaui repo** and built by its own agents; sparx (Stage 3+) consumes it as it lands. The two sides converge at Stage 3.

```
── SILICA REPO (owned by silicaui agents; sparx consumes) ────────────────
Stage 1 — F1: host seam + security floors  (days; mechanisms already exist)
  element.ts (raw-tag/attr floor, enforced in to-html)   ⚠ see note below
  class-policy.ts (validateClass built-in floor + buildClassValidator)
  host.catalog() (Add-palette, merge semantics)
  host.inspectorPanels() (extension point on Inspector)
  host.pickAsset()
Stage 2 — F2: the data-resolution layer  (the keystone; port sparx runtime.ts)
  resolveTree(tree, host, scope)  — ONE sync walker: bind + repeat + action,
     DataScope {item,index}, Resolved.visible; toHtml(resolveTree(…)) for live
  canvas data-aware render path (feed resolveTree into the canvas React walk)
  host.dataSources() + engine-owned scopeAt() + generic binding picker
  Q13: engine inspector — responsive/context control + bounded controls
       (searchable class lookup replaces the free textarea; sliders replace
        free length inputs) so the authored vocabulary stays safelistable

── SPARX REPO (this doc's scope) ─────────────────────────────────────────
Stage 3 — Connect sparx → silica  (big-bang; the pieces are interlocked)
  site-themes/v2 → emit native --color-* (delete --st-* + legacy aliases)  [WS-4]
  surface-compile: retire per-tenant compile → silica @plugin app sheet +
     bounded utility safelist (§1.0); allowlist demoted to author-time hygiene
  BuilderHost adapter (catalog/dataSources/validateClass/inspectorPanels/
     pickAsset) wrapping sparx's binding-catalog + runtime.ts
  wire the studio route to <Builder host={sparxHost}>                      [WS-3/6/7 collapse here]
  apps/site renders toHtml(resolveTree(tree, sparxHost))                   [WS-8]
  re-author the catalog silica-native (adopt silica blocks where they fit) [WS-6]
  DELETE: @sparx/site-ui, the sparx editor chrome + canvas walker +
     inspector + renderLeaf + surface-compile per-tenant compile           [WS-7 deleted, not re-skinned]

Stage 4 — Re-seed (NOT a backfill)                                         [WS-9 → re-seed]
  seed regenerates silica-native trees; no stored-tree codemod, no RLS loop
  → GATE: canvas == storefront on the re-seeded pages (§5)

Stage 5 — Reconcile docs
  builder-contract.md deltas (owned silica-side); this doc → shipped;
  brain builder nodes + parity-spec status advanced
```

**Convergence risk.** Stage 3's theme/compile/render pieces are interlocked — they must land together (a half-migrated theme renders unstyled), and they depend on Stage 2's `resolveTree` + the host-seam props existing. So sparx's independent pre-work is: the theme-emission swap (native `--color-*`), the `BuilderHost` adapter shape (against the roadmap-frozen contract), and the catalog's silica-native class vocabulary — assembled behind the cutover, integrated when Stage 2 lands.

> **⚠ Note on `element.ts` (silica-side, flagged 2026-07-09).** The shipped `element.ts` uses a _closed positive attribute union_ and `to-html.ts` enforces it **unconditionally** in `renderNode` — which also runs on **component-expanded** output. silica components emit attributes outside the union (`aria-valuenow/min/max`, `aria-selected`, `data-value`, `data-role`, `data-cycle`), so those are stripped, breaking behavior wiring + a11y; the golden fixture covers no such component, so it passes anyway. Fix options: mark genuinely-authored raw elements and enforce only on them, or switch the attribute side to _deny-dangerous_ (drop `on*`/`style`/unsafe-URLs, allow the broad-safe rest). Raised for the silicaui agents.

---

## 5. Testing & acceptance

The migration's correctness bar is **"preview == production, and both == before"**:

- **Render snapshot parity (WS-3/WS-4/WS-8):** for each of the ~40 named types + 48 atoms + the raw-element set, snapshot `renderLeaf` output (markup + classes) and diff old-vs-new against the WS-2 map. A silica-class node must render byte-faithfully across canvas, storefront, and View-HTML.
- **Page-level pixel diff:** render a spread of seeded pages (a marketing home, a product collection template resolving a real product, a blog collection, a bound buy-box page) in the canvas and on `apps/site`; confirm they match each other and match a pre-migration baseline screenshot. (Ad-hoc Playwright per the no-CI-UI-tests rule — not committed specs.)
- **Binding integrity:** a collection template still iterates one-per-record (`value.map` scope threading), `__pins`/`__sources` resolve, product-context providers wrap correctly. This is regression-critical — the render swap must not touch the walker.
- **Security:** `validateClasses` still blocks `fixed`/`z-[…]`/`content-[…]`/`url()` on the silica vocabulary; `el:*` whitelist + `safeElementAttrs` unchanged.
- **Backfill round-trip (WS-9):** run the WS-2 mapper over seed data, re-render, diff. The mapper is pure + unit-tested; the same function powers the catalog rewrite and the DB backfill so they cannot drift.
- **Gate discipline:** `pnpm --filter <pkg> typecheck` per touched package; `pnpm --filter @sparx/dashboard typecheck` + `@sparx/site` after the render cutover; prettier at slice end. Do not run root `pnpm typecheck`.

---

## 6. Risks & mitigations

| Risk                                                                      | Severity | Mitigation                                                                                                                                                           |
| ------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Half-styled render if WS-3 lands without WS-4 (or vice versa)             | High     | Land Phase B as one coordinated change behind the §5 gate; never merge one seam alone.                                                                               |
| Stored `class` strings drift from the catalog rewrite                     | High     | One shared WS-2 mapper powers both the catalog rewrite and the DB backfill — single source of truth, unit-tested.                                                    |
| Binding/iteration regression during the render swap                       | High     | The walkers (`RenderNode`/`CanvasNode`) are **out of scope** for WS-3; only `renderLeaf` output changes. Binding-integrity tests gate.                               |
| Splitter re-skin breaks the shell width/collapse/mobile contract (WS-7.4) | Med      | Preserve the `--bx-rail-w`/`--bx-side-w` CSS-var contract + `useMediaQuery` gate explicitly; treat as its own reviewed slice.                                        |
| silicaui gaps discovered mid-cutover                                      | Med      | WS-1 closes the parity-spec §13 gap list **before** Phase B; a fast recon of exotic surfaces converts surprises into todos.                                          |
| FORCE-RLS backfill fails in prod (`23502`) but passes locally             | Med      | Per-tenant `set_config('app.tenant_id')` loop in the backfill; run via the DB Migrate workflow, never locally.                                                       |
| Two-repo dev loop friction (silica + sparx)                               | Low      | Workspace-link silica locally for dev; disciplined semver at the boundary (blocks-contract §11). Class vocab is a **major**-version data contract.                   |
| Email surface divergence                                                  | Low      | `renderLeaf` `surface:'email'` path + `@sparx/email` consume the neutral tree (Mode-3); keep the email-degradable subset (blocks-contract §12). No `toEmail()` owed. |

---

## 7. Effort shape (rough, not a commitment)

- **Phase A (WS-1, WS-2):** silica gap-close + the mapping table. The mapping table is small; the silica gaps are additive (parity-spec §13).
- **Phase B (WS-3, WS-4, WS-5, WS-8):** the concentrated core — one leaf map, one compile theme, apps/site wiring. This is the highest-value, highest-risk slice.
- **Phase C (WS-6, WS-9):** catalog rewrite is high-volume-but-mechanical; backfill is trivial pre-launch.
- **Phase D (WS-7):** ~1600 lines of chrome re-skin (inspector is the bulk), decoupled and parallelizable.

The point of the finding work: this is **not** "migrate two builders." It is **one leaf renderer + one CSS compiler retargeted, a class-string data backfill, a chrome re-skin, and a catalog rewrite** — over a preserved document model, binding runtime, and Outlet composition. Everything hard (multi-tenant theming, the security boundary, per-record collections, the binding spine) either already exists and stays, or is additive on the silica side.

---

## 8. Definition of done

> **Reality note (2026-07-10):** the checkboxes below are framed against the SUPERSEDED "retarget in place" path (WS-3 `renderLeaf`). Under engine adoption the storefront renders through silica's shared `renderSilicaBody` instead, and that path is **shipped for four routes** (home, page, PDP, blog) with the editor host complete — see the STATUS banner at the top. What remains is **coverage** (a silica `collections/[handle]` route) and, only after full coverage, the legacy **deletion** — both tracked in the banner + the deletion map.

- [ ] silicaui closes the parity-spec §13 gap list for every token/class the sparx catalog references (WS-1).
- [ ] `renderLeaf` + `renderSiteUiAtom` + `serialize-html` emit silica classes/components; canvas, storefront, and View-HTML are byte-faithful to each other (WS-3).
- [ ] `surface-compile` emits silica plugin tokens (global + `@scope(.bx-canvas)`), allowlist retained (WS-4).
- [ ] `apps/site` renders silica elements/styles; `@sparx/site-ui` stylesheet retired (WS-8).
- [ ] Catalog + `site-chrome` re-authored against silica (silica blocks adapted where they fit) (WS-6).
- [ ] Every persisted tree's `class` strings backfilled via the shared mapper, through the DB Migrate workflow, RLS-safe (WS-9).
- [ ] Editor chrome resolved (§1.4): **either** Phase F adopts silica's engine (chrome deleted), **or** — if deferred — WS-7 re-skins the chrome onto silicaui-react (6 workstreams; the 7 bespoke sets preserved).
- [ ] Binding/iteration/Outlet/security invariants unchanged and regression-tested (§5).
- [ ] `@sparx/site-ui` primitives + the `st-*` theme block deleted; no importers remain (Phase E).
- [ ] Docs reconciled: this doc → shipped, brain builder nodes updated, parity-spec status advanced.

---

## Appendix — file-level index (the migration surface)

**Preserve (do not change the logic):**
`builder-schemas/src/node.ts`, `runtime.ts`, `element.ts`, `binding.ts` · `apps/site/components/builder-renderer.tsx` (walker), `lib/builder-data.ts`, `builder-commerce-data.ts` · `builder/_builder/canvas.tsx` (walker), `use-studio-editor.ts`, `use-builder-editor.ts`, `class-controls.ts`, `registry.tsx` (metadata), `binding-catalog.ts`, `model.ts`.

**Retarget (the swap seams):**
`builder-render/render-leaf.tsx`, `site-atoms.tsx`, `serialize-html.tsx`, islands + `behaviors/` · `surface-compile/theme.ts`, `allowlist.ts`, `index.ts` · `builder-schemas/box-to-class.ts`, `catalog/*`, `site-chrome.ts`, `_kit.ts`, `CONTRACT.md` · `builder-schemas` validation schemas.

**Re-skin (chrome):**
`builder/_builder/{site-studio,builder-workspace,inspector,layers-*,add-palette,fields-panel,data-panel,*-control,picker-fields,token-field,merge-tags-panel,shortcuts-overlay,link-target-control,nav-menu-editor,icon-picker,color-swatch,background-fill}.tsx` + `builder.css` (partial).

**Backfill (data, no schema change):**
`builder_pages.{draft,published}_tree`, `builder_layouts.*`, `builder_emails.*`, `builder_component_versions.tree`, `builder_archetypes.tree`, `platform_components.tree`, saved themes — via a DB Migrate workflow backfill script using the WS-2 mapper, RLS per-tenant loop.

**Delete (Phase E):**
`@sparx/site-ui` (primitives + `styles.css`/`styles.canvas.css`), the `--st-*` `@theme` block in `surface-compile/theme.ts`.

**Silica-repo inputs (read, don't edit here):**
[`silicaui/docs/builder-contract.md`](../../silicaui/docs/builder-contract.md) (§2 doc shape, §3 the three primitives, §5 host seam), [`silicaui/docs/blocks-contract.md`](../../silicaui/docs/blocks-contract.md) (§10 the sparx near-identity adapter), [silicaui-site-ui-parity-spec.md](silicaui-site-ui-parity-spec.md) (§13 the readiness gate).
