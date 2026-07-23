# 00 — Builder v2: The Unified Builder

> ⚠️ **SUPERSEDED 2026-07-22.** This whole "Builder v2" series planned sparx building its OWN unified shell / inspector / affordances. That plan was inverted by the silicaui `<Builder>` adoption — sparx now HOSTS silica's engine (Insert palette, canvas, layers/Navigator, Design inspector, undo/redo, page switching, frame/Outlet, symbols, theme) rather than building its own. See **docs/118-builder-silicaui-html-migration.md** for the current architecture. The individual phase docs are kept for historical context.

Version: 1.1
Author: Brandon Korous
Last Updated: 2026-07-22

> This is the table of contents and the binding plan for **Builder v2** — the
> consolidation of `/builder/brand`, `/builder/site`, and `/builder/page` into a
> single editor where you compose a site the way it actually renders: **a brand
> theme wrapping a site chrome wrapping a page**, all on one canvas that is
> literally the production renderer. It also closes the gaps the
> [builder evaluation](../evaluations/builder-eval-findings-2026-06-14.md) found:
> a properties panel that doesn't reach full Tailwind, no undo/redo, no canvas
> drag, canvas↔live divergence, and a publish path that is broken in local dev.
>
> Read this doc first. Each numbered doc after it is **one focused, buildable
> phase** with its own goal, current-state map, target design, file-level work,
> and acceptance criteria — so the phases can be picked up and shipped
> independently, in order.

## 1. Why now, and why "fully"

The builder has an **excellent foundation and an incomplete surface.** The eval
rated it ~7/10: the node-tree model, the 35-component registry, the binding
system with cardinality, the per-tenant theme compile, and the live renderer are
all genuinely good ([evaluation §1](../evaluations/builder-eval-findings-2026-06-14.md)).
What's missing is everything a _power user_ expects from a great visual builder,
plus one architectural duplication (two render paths) that produces the
canvas↔live divergence.

There are **no users, no real data, and no marketing in flight.** That removes the
only force that justifies incrementalism — an install base you can't break. So
this plan is not "ship quick wins and iterate." It is: **build the complete
builder, to production quality, replacing the old routes outright.** No MVP
slices, no `// later` TODOs, no permanent `/builderv2` shadow route — we evolve
the real `/builder`.

**What we keep, and why it is not caution.** We keep the _engine_ — the
`BuilderNode` model ([40](../40-sitebuilder-composition-model.md)), the registry,
the binding resolver in `@sparx/builder-schemas`, the Token Model v2 compile
([33](../33-token-model-v2.md)), and the class-first authoring model
([47](../47-class-first-authoring-model.md), [61](../61-utility-authoring-system.md)).
Rewriting a correct foundation would destroy value and re-incur every
canvas↔live bug already fixed
([project_canvas_live_renderer_divergence] in the engineering notes). "Fully"
means building everything _above and around_ the engine to the real vision — and
removing the one true duplication (Phase 2).

## 2. The product shape we are building toward

One editor. One canvas. One layers tree. The tree mirrors how a page renders in
production:

```
Theme  (the brand — tokens/identity; the tree ROOT, opens the brand controls)
└── Site layout  (the chrome that wraps every page — header / footer / nav)
    └── Page content  (the Outlet)
        └── <the active page>  ← switchable (Home, Shop, About, a collection template…)
```

- **Brand is the theme context, not a draggable node.** It is tokens, not a
  subtree. It lives at the **root** of the tree as a "Theme" node that opens the
  existing brand/theme controls (`theme-center`), and it ambiently themes
  everything below. Switching the active site swaps the whole theme (already
  true today, [per-site brand](../evaluations/builder-eval-findings-2026-06-14.md)).
- **Site + Page merge into one canvas.** Today the site editor shows the Outlet as
  a _ghost_ ("Page content renders here"); the page editor edits that Outlet's
  subtree on a separate route. In v2 the ghost becomes the **real page**, with a
  page switcher. You edit the page _inside_ the live chrome, themed by the live
  brand — which is exactly what ships.
- **Email stays a sibling surface.** Same engine, different medium (email-safe
  subset, different render target, [13](../13-email-platform-prd.md)). It gets the
  same upgraded inspector and affordances but keeps its own canvas tab.

This is not a new model — it is the model the renderer already implements
([45 §1](../45-builder-site-layout.md), [36](../36-sitebuilder-layering-model.md)).
v2 makes the _editor_ match the _renderer_.

## 3. The four principles this plan commits to

1. **The canvas IS production.** The editor must render through the _same_
   component path as the live site, fed by sample data, with an editor
   interaction layer on top. No second "canvas registry" with mocks. (Phase 2.)
2. **The common surface is never the ceiling.** Every everyday control stays
   simple, but a power user can reach the _complete_ Tailwind surface for _any_
   node — on every surface, per breakpoint, per state — from the UI. (Phase 4.)
3. **Nothing is unrecoverable.** Undo/redo, multi-select, and direct-manipulation
   on the canvas are baseline, not nice-to-haves. (Phase 5.)
4. **Each phase ships production-complete.** "Build it fully" does not mean one
   giant branch — it means each phase merges at production quality (no stubs),
   landed in dependency order. Since there are no users, we _replace_, we don't
   flag.

## 4. The phases

Built in dependency order. Each links to its own focused doc.

| #   | Phase                                    | Doc                                          | Why here                                                                                                                       |
| --- | ---------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Publish gate fix**                     | [01](01-publish-gate-fix.md)                 | Correctness bug; blocks parity testing and dev publishing. Prereq for everything that verifies "what ships."                   |
| 2   | **Canvas ↔ live unification** (keystone) | [02](02-canvas-live-renderer-unification.md) | Collapse the two render paths into one. Kills canvas↔live divergence and is the substrate the unified shell needs.             |
| 3   | **Unified builder shell**                | [03](03-unified-builder-shell.md)            | Theme root › Site chrome › Outlet→Page on one canvas + one layers tree, with a page switcher.                                  |
| 4   | **Inspector: full design surface**       | [04](04-inspector-full-design-surface.md)    | Complete the Tailwind control set, the two-tier split, per-breakpoint/state on all surfaces, raw-class reconciliation.         |
| 5   | **Editor affordances**                   | [05](05-editor-affordances.md)               | Undo/redo, multi-select, canvas drag/reparent, alignment guides, copy-styles, keyboard shortcuts.                              |
| 6   | **Builder overview home**                | [06](06-builder-overview-home.md)            | The module home: site status, health, attention, activity ([mockup](../mockups/builder-overview.html)).                        |
| 7   | **Cutover & route consolidation**        | [07](07-cutover-route-consolidation.md)      | Replace `/builder/{brand,site,page}` with the unified editor; retire the split routes and the dead `registry.tsx` canvas path. |

**Sequencing notes.** Phases 1 and 2 are hard prerequisites. Phase 4 (inspector)
and Phase 5 (affordances) are engine-level and _independent of_ the shell (Phase 3) — they improve the current editor and the unified one identically, so they can
proceed in parallel with Phase 3 once Phase 2 lands. Phase 6 (overview) is
fully independent and can be built any time. Phase 7 is the final consolidation.

## 5. Where the code lives (orientation)

| Area                                       | Path                                                                                                                                                |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editor shell (page)                        | `apps/workbench/surfaces/builder/builder-app.tsx` _(historical; the shipped editor is `apps/workbench/surfaces/builder/studio/studio-surface.tsx`)_ |
| Editor shell (site)                        | `…/_builder/site-builder-app.tsx`                                                                                                                   |
| Editor shell (email)                       | `…/_builder/email-builder-app.tsx`                                                                                                                  |
| Shared workspace (canvas/inspector/layers) | `…/_builder/builder-workspace.tsx`                                                                                                                  |
| **Canvas render path (to be unified)**     | `…/_builder/canvas.tsx` + `…/_builder/registry.tsx`                                                                                                 |
| Inspector                                  | `…/_builder/inspector.tsx` + `…/_builder/class-controls.ts`                                                                                         |
| Layers tree (dnd-kit)                      | `…/_builder/layers-panel.tsx` + `layers-tree.ts`                                                                                                    |
| Editor state + autosave                    | `…/_builder/use-builder-editor.ts`                                                                                                                  |
| Brand / theme center                       | `…/_brand/components/theme-center.tsx`                                                                                                              |
| **Live render path (the target)**          | `apps/site/components/builder-renderer.tsx`                                                                                                         |
| Shared binding/runtime                     | `packages/builder-schemas/src/runtime.ts`                                                                                                           |
| Publish service + verified-email guard     | `packages/sitebuilder/src/services/publish-service.ts`, `services/api-rest/src/lib/verified-email-guard.ts`                                         |

## 6. Glossary (so every phase doc uses the same words)

- **Node / tree** — a `BuilderNode` `{ id, type, name?, class?, props, binding?, children? }` ([40](../40-sitebuilder-composition-model.md)). `class` is the only styling surface.
- **Surface** — one editing target: `page`, `site` (layout/chrome), `email`. A node's registry entry declares which surfaces it's valid on.
- **Outlet** — the single node in a site layout that marks where the routed page renders ([45 §2.1](../45-builder-site-layout.md)).
- **Live renderer** — `apps/site/components/builder-renderer.tsx`, the production component path. The Phase 2 target for the canvas.
- **Canvas registry** — `_builder/registry.tsx`'s per-type canvas render functions, including the _mocks_ for commerce atoms. Retired in Phase 2/7.
- **Interaction shield** — the editor overlay that makes live, interactive components selectable/inert inside the canvas (Phase 2).
- **Context (inspector)** — a style scope: base, a container-query breakpoint (`@sm`/`@md`/…), or a state (`hover`/`focus`/`active`/`dark`). Driven by `ContextSelect` ([61](../61-utility-authoring-system.md)).
- **Theme root** — the brand/theme presented as the root of the unified tree (Phase 3); not a draggable node.

## 7. Out of scope for v2 (named, so it's not silent)

- **The marketplace / blueprint _install_ engine** — v2 consumes blueprints; it does not change how they're authored or installed ([60](../60-marketplace.md), docs/85).
- **The CMS content model and commerce catalog** — bindings consume them; their schemas are unchanged.
- **A mobile _authoring_ experience** — v2 must remain usable on small screens (canvas fit-to-width, Phase 3/5), but full phone-first authoring is not a goal.
- **Email deliverability / sending** — unchanged ([13](../13-email-platform-prd.md)); v2 only edits the template tree.
