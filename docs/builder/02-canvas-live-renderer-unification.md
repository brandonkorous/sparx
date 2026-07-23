# 02 — Phase 2 (keystone): Unify the canvas on the live renderer

> ⚠️ **SUPERSEDED 2026-07-22.** This plan predates the silicaui `<Builder>` adoption — sparx now HOSTS silica's engine (Insert palette, canvas, layers, inspector, undo/redo) instead of building its own. See **docs/118-builder-silicaui-html-migration.md** for the current architecture. Kept for historical context.

Version: 1.1
Author: Brandon Korous
Last Updated: 2026-07-22

> The builder's premise is **"canvas == production."** Today it isn't, because
> there are **two** render paths: the editor canvas renders each node through
> `_builder/registry.tsx` (with hand-written _mocks_ for commerce atoms and an
> inert `<span>` for Button), while the live site renders through
> `apps/site/components/builder-renderer.tsx` (the real, wired components). This
> fork is the canvas↔live divergence
> ([evaluation Finding 4 + §6](../evaluations/builder-eval-findings-2026-06-14.md)).
>
> This phase collapses the two into **one shared render path** used by both the
> live site and the canvas — parameterized by a data resolver (real vs sample) and
> a render mode (`live` vs `edit`) — with an **interaction shield** that lets the
> real interactive components render in the canvas while clicks select instead of
> navigate/submit. After this phase, "what you see is what ships" is _literally_
> true, and the unified shell (Phase 3) has the substrate it needs.

## 1. The problem

From the parity map ([evaluation §6](../evaluations/builder-eval-findings-2026-06-14.md)):

**Shared correctly today** (no drift): binding resolution + cardinality
(`resolvePath`/`cardinalityOf` in `packages/builder-schemas/src/runtime.ts`),
iteration/scope, class compilation, and the Tier-1 primitives + content
components (Heading, Text, Image, Divider, Icon, NavMenu, FAQ, FeatureGrid,
EditorialSection, Logo, Wordmark, SocialLinks) — both sides render the same
`@sparx/site-ui` components.

**Diverges** (two code paths):

| Component                                     | Canvas (`registry.tsx`)                              | Live (`builder-renderer.tsx`)           |
| --------------------------------------------- | ---------------------------------------------------- | --------------------------------------- |
| BuyBox / VariantPicker / Quantity / AddToCart | static mock spans (`~1135–1198`)                     | real wired atoms (`~314–320`)           |
| PriceTag / ImageDisplay                       | `amount={null}` / "N images" badge (`~1041–1085`)    | real bound value (`~342–352`)           |
| Button                                        | inert `<span>` (`~666–682`)                          | interactive `<a>/<button>` (`~298–308`) |
| Carousel                                      | `CanvasCarousel` (no autoplay)                       | `BuilderCarousel` (autoplay/pause)      |
| Email leaves                                  | `email-leaf.tsx` at email scale, site-theme fallback | `@sparx/email` via email-platform brand |

The root cause is **structural**: per-type render lives in two files. Any new
component must be written twice and can silently drift. The mocks exist because
the canvas needs components to be **inert and selectable** (a real `<button>`
would fire its handler and break selection), but the answer to that is an
interaction layer — not a parallel render tree.

## 2. Decisions

**2.1 One render path, in a shared package.** Extract the per-type node render
into a new server-safe package — working name **`@sparx/builder-render`** — that
both `apps/site` (live) and the dashboard canvas (edit) import. The package owns
the `type → React element` mapping for every node, calling the _same_
`@sparx/site-ui` / commerce / `@sparx/email` components both surfaces ship.
`registry.tsx` keeps **metadata only** (palette grouping, `accepts`/cardinality,
`defaults`, `props`, `bindable`, icons); its `renderLeaf` functions are deleted.

**2.2 Parameterize by a data resolver, not by app.** The renderer takes a
`DataResolver` (the binding source). Live passes real `DataSources`
(commerce/cms/site records); the canvas passes **sample data** — and the commerce
sample is a _realistic_ product (`apps/site/lib/sample-data.ts` `SAMPLE_PRODUCT`
already exists), so BuyBox/VariantPicker/PriceTag render the **real component with
sample values** — no more mocks. Sample data moves into (or is re-exported from)
the shared package so both sides agree on its shape.

**2.3 Render mode = `live` | `edit`; the interaction shield handles `edit`.**
Interactive components render their **real** element in both modes. In `edit`
mode the canvas wraps the tree in an **interaction shield**: a capture-phase
pointer layer on the canvas root that (a) on click, selects the node under the
pointer and `preventDefault()`/`stopPropagation()` so links don't navigate and
forms don't submit; (b) leaves hover/pointer-events intact so `:hover` styles and
the inspector's live class changes still show. This is the same technique the
storefront `PreviewBridge` already uses for the iframe preview
(`apps/site/components/preview-bridge.tsx` capture-phase `onClick` → select) —
generalized to the in-DOM canvas. Components may read an `editMode` context to
disable internal side effects (e.g. an `AddToCart` that no-ops its mutation in
edit mode) where a click-shield alone isn't enough.

**2.4 The canvas wrapper stays; only the leaf render moves.** `canvas.tsx` keeps
the selection chrome, hover outlines, drop zones, and the per-node wrapper
(`data-bx-id`, `data-bx-type`). It renders **`<BuilderRenderNode mode="edit">`**
from the shared package _inside_ that wrapper instead of calling
`registry.renderLeaf`. Scope (`.bx-canvas` vs `.bx-render`) is applied by the
wrapper/host, not the shared renderer, so the renderer is scope-agnostic.

**2.5 Server- and client-safe.** The live renderer is a React Server Component
tree; the canvas is a client tree. The shared package must run in both: render
functions are presentational and synchronous, data is **injected** (no server-only
fetches inside), and the genuinely-interactive atoms stay `'use client'` islands
(they already are). No `@sparx/db`, no server-only imports in the package — keep
it the same dependency weight the storefront image already tolerates.

**2.6 Email converges too.** The email leaf render (`email-leaf.tsx`) and the live
email render unify on the `@sparx/email` components in the shared package, so the
canvas email preview uses the _same_ brand resolution as a real send (closes the
email-scale/brand caveat). If full brand-service parity is heavy, the minimum bar
is: same components, same scale; brand source documented.

## 3. Target architecture

```
packages/builder-render/                ← NEW, server-safe
  renderNode(node, { resolver, mode })  ← the single type→element map
  sampleData                            ← re-exported / owned sample records
  EditModeContext                       ← read by interactive atoms in 'edit'

apps/site/components/builder-renderer.tsx
  → thin wrapper: renderNode(node, { resolver: realDataSources, mode: 'live' })

apps/dashboard/.../_builder/canvas.tsx
  → selection chrome + drop zones, wrapping
    renderNode(node, { resolver: sampleData, mode: 'edit' })
  + InteractionShield on the canvas root (capture-phase select)

apps/dashboard/.../_builder/registry.tsx
  → metadata ONLY (palette/accepts/defaults/props/bindable/icon); renderLeaf removed
```

## 4. Work breakdown

| Step | Area                          | Change                                                                                                                                                            |
| ---- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | new `packages/builder-render` | Scaffold the package ([new-workspace-package] skill); server-safe; depends on `@sparx/site-ui`, `@sparx/builder-schemas`, commerce/email component libs.          |
| 2    | move render                   | Port each `type → element` mapping out of `registry.tsx` and `builder-renderer.tsx` into `renderNode`, calling the **real** components for every type (no mocks). |
| 3    | data resolver                 | Define `DataResolver`; live = `DataSources`, edit = `sampleData`. Move/own the sample records; ensure the commerce sample is a realistic multi-variant product.   |
| 4    | edit mode                     | `EditModeContext`; interactive atoms (Button, AddToCart, Signup, forms, Carousel) honor it (inert internal effects).                                              |
| 5    | interaction shield            | Generalize the `PreviewBridge` capture-phase select into a reusable canvas shield; wire selection to `use-builder-editor`.                                        |
| 6    | rewire live                   | `apps/site/components/builder-renderer.tsx` becomes a thin `mode:'live'` wrapper; delete its per-type render.                                                     |
| 7    | rewire canvas                 | `canvas.tsx` renders `renderNode(mode:'edit')` inside its wrapper; delete `CanvasCarousel` + the commerce/Button mock branches.                                   |
| 8    | trim registry                 | `registry.tsx` keeps metadata; remove `renderLeaf`. (Full deletion of the dead path is finalized in [07](07-cutover-route-consolidation.md).)                     |
| 9    | verify                        | Build a page with a product grid + buttons; **publish** (needs [01](01-publish-gate-fix.md)); diff canvas vs the live route — they must match.                    |

## 5. Acceptance criteria

- A product card in the canvas shows the **real** PriceTag/ImageDisplay/BuyBox with
  sample data (correct variant count, real price formatting) — not a mock.
- A Button renders its real `<a>/<button>` in the canvas; clicking it **selects**
  the node (no navigation/submit); the published page's button navigates/submits.
- Carousel autoplay/pause authored in the editor is visible in the canvas.
- A non-trivial page built in the canvas, once published, is **visually identical**
  to its live route (spot-checked across hero, product grid, forms, footer).
- There is exactly **one** per-type render map in the codebase; `registry.tsx` no
  longer renders nodes.
- Storefront image size/deps are not regressed (no server-only deps leaked into
  `@sparx/builder-render`).

## 6. Risks & notes

- **Biggest risk: server/client duality (2.5).** A render function that
  accidentally pulls a server-only import will break the canvas (or bloat the
  client bundle). Keep the package presentational + injected-data; gate the
  interactive islands behind `'use client'`.
- **Interaction shield completeness.** Some components have effects a click-shield
  won't stop (autoplay timers, intersection observers, fetch-on-mount). Audit each
  interactive atom and give it an `editMode` no-op path.
- **Sample-data fidelity (Phase 2 ↔ Finding "shape divergence").** If the sample
  product is unrealistic (1 variant, 1 option) the canvas still mis-teaches.
  Invest in a sample product whose shape matches a real one (multiple
  variants/options, an out-of-stock, a sale price).
- **This is the highest-leverage phase.** It is also the one most worth a careful
  design pass before coding — extracting the package and the resolver boundary is
  the part that, done right, makes Phases 3–7 straightforward.
- **Largest blast radius:** touches both `apps/site` render and the dashboard
  canvas. Land it behind a thorough publish-diff before moving on.
