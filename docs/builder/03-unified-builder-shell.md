# 03 — Phase 3: The unified builder shell

> ⚠️ **SUPERSEDED 2026-07-22.** This plan predates the silicaui `<Builder>` adoption — sparx now HOSTS silica's engine (Insert palette, canvas, layers, inspector, undo/redo) instead of building its own. See **docs/118-builder-silicaui-html-migration.md** for the current architecture. Kept for historical context.

Version: 1.1
Author: Brandon Korous
Last Updated: 2026-07-22

> Today brand, site chrome, and page are three separate routes
> (`/builder/brand`, `/builder/site`, `/builder/page`) even though production
> renders them as one stack: a brand theme wrapping a site chrome wrapping a page.
> This phase merges them into **one editor** — one canvas, one layers tree, one
> toolbar — whose tree is that stack: **Theme** (root) › **Site layout** (chrome)
> › **Outlet → the active page** (switchable). You edit the page _inside_ the live
> chrome, themed by the live brand. Email stays a sibling surface.
>
> This phase depends on [02](02-canvas-live-renderer-unification.md): the canvas
> can only show "chrome + page + theme together as it ships" once it renders
> through the live path.

## 1. The problem

The three surfaces already share the editor machinery — `/builder/site` and
`/builder/page` both run `_builder/builder-workspace.tsx` (canvas + inspector +
layers); `/builder/brand` runs the separate `theme-center`. But they're three
_destinations_, so:

- You can't see a page inside its real chrome while editing it (the site editor
  shows the page as a ghost Outlet; the page editor shows no chrome).
- The brand that themes everything is edited somewhere else entirely.
- Switching what you're working on is a route change, not a selection.

The renderer already composes the stack ([45 §1](../45-builder-site-layout.md),
[36](../36-sitebuilder-layering-model.md)); the editor should too.

## 2. Decisions

**2.1 One tree, three ownership zones.** The unified layers tree is:

```
▸ Theme            ← brand/theme context (tokens); opens the brand controls
▾ Site layout      ← the chrome (owned by the active layout)
  ▸ Header
  ▾ Page content   ← the Outlet
    ▾ Home — Landing   ← the ACTIVE PAGE (owned by the page); switchable
      ▸ Hero
      ▸ Latest writing
  ▸ Footer
```

Each node belongs to exactly one **ownership zone**: `theme` (brand), `layout`
(site chrome), or `page` (the page in the Outlet). The Outlet boundary is the
split between layout-owned and page-owned nodes.

**2.2 Persistence routes by ownership zone.** The editor's autosave sends each
edit to the store that owns the node:

| Zone     | Edit target                                                                           |
| -------- | ------------------------------------------------------------------------------------- |
| `theme`  | brand / site config (`PATCH /v1/brand` or property `brandOverride`, [per-site brand]) |
| `layout` | the active site layout tree (`PATCH /v1/builder/layouts/:id`)                         |
| `page`   | the active page tree (`PATCH /v1/builder/pages/:id`)                                  |

The site editor already splits brand-owned vs presentation-owned saves
([45](../45-builder-site-layout.md)); this generalizes that to a
three-zone router keyed on the selected node's zone. One debounced autosave per
zone, so a chrome edit and a page edit don't stomp each other.

**2.3 Brand is the theme root, not a draggable node.** Selecting **Theme** opens
the brand/theme controls (the `theme-center` panels — colors, type, rounding,
logo/favicon, saved themes, Light/Dark) in the inspector, _not_ node-style
controls. It cannot be reordered, removed, or have children added. This gives the
"stacked" feel — Theme › Site › Page — without forcing tokens into the node model
([33](../33-token-model-v2.md)).

**2.4 Two switchers: site and page.** The **site** switcher stays in the
breadcrumb (it swaps the active property → theme + chrome + page set, already
working, [per-site brand]). A new **page** switcher in the toolbar chooses which
page fills the Outlet (Home, Shop, About, a collection template…). Switching the
page swaps only the Outlet subtree; theme + chrome persist — exactly like
navigation on the live site.

**2.5 The inspector adapts to the selected zone.** Theme node → brand controls.
Layout/page node → the full node inspector ([04](04-inspector-full-design-surface.md)).
A small zone indicator on the selected node ("in Site layout" / "in Home") tells
the author what they're editing and where a save lands.

**2.6 Collection templates render per-record in the Outlet.** When the active
"page" is a collection template (e.g. Product page · per product), the page
switcher offers a sample record to preview, and the Outlet renders that record —
matching the live per-record route ([36 §6](../36-sitebuilder-layering-model.md)).

**2.7 Email stays a sibling surface.** A top-level surface switch (Site · Email)
keeps email on its own canvas — same engine, same upgraded inspector, but a
different render target ([13](../13-email-platform-prd.md)). It does not share the
site's chrome/Outlet tree.

**2.8 The toolbar is one bar.** Page switcher · device (viewport) · undo/redo
([05](05-editor-affordances.md)) · Preview · Save · Publish. The per-surface
toolbars collapse into this one; "Publish" publishes the active site (theme +
chrome + pages) as today.

## 3. Target shell

```
apps/dashboard/.../builder/  (unified route — replaces brand/site/page in Phase 7)
  ├─ toolbar: [Site|Email] · page-switcher · device · undo/redo · Preview · Save · Publish
  ├─ left:   layers tree (Theme ▸ Site layout ▸ Outlet→Page) + Add palette
  ├─ center: canvas — live-rendered chrome wrapping the active page, brand-themed
  └─ right:  inspector — brand controls (Theme) OR node inspector (layout/page node)
```

Reuses: `builder-workspace.tsx` (canvas/inspector/layers shell), `use-builder-editor`
(extended to the three-zone autosave router), `theme-center` panels (mounted as
the Theme-node inspector), the Add palette, `layers-tree.ts`.

## 4. Work breakdown

| Step | Area            | Change                                                                                                                    |
| ---- | --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1    | layers model    | Compose one tree from {brand-as-Theme-root, active layout, active page-in-Outlet}; tag each node with its ownership zone. |
| 2    | autosave router | Extend `use-builder-editor` to route edits to the zone's store (brand / layout / page), one debounce per zone.            |
| 3    | canvas compose  | Render the layout tree with the active page injected at the Outlet (via the Phase 2 renderer), brand-themed.              |
| 4    | Theme node      | Mount `theme-center` panels as the inspector for the Theme root; make the node non-editable as a tree node.               |
| 5    | page switcher   | Toolbar control to pick the Outlet page; swap only the page subtree on change; collection templates pick a sample record. |
| 6    | inspector adapt | Switch inspector content by selected node's zone; add the zone indicator.                                                 |
| 7    | surface switch  | Site · Email top-level switch; Email mounts its own canvas.                                                               |
| 8    | toolbar merge   | One toolbar; wire Preview/Save/Publish to the active site.                                                                |

(Route consolidation — making this _the_ `/builder` and retiring the split routes —
is [07](07-cutover-route-consolidation.md). Phase 3 can be built at a temporary
path to de-risk, but with no users there's no need to keep the old routes alive
beyond the cutover.)

## 5. Acceptance criteria

- One editor shows the active page **inside** its real header/footer, themed by the
  active brand; it matches the published site.
- Editing a header node saves to the **layout**; editing a hero node saves to the
  **page**; editing a color via the Theme node saves to the **brand/override** —
  verified independently, no cross-stomping.
- The page switcher swaps the Outlet page without touching chrome or theme; a
  collection template previews a sample record.
- Switching the active **site** (breadcrumb) swaps theme + chrome + page set live
  (the [per-site brand] remount behavior holds).
- Email is reachable as a sibling surface with the same inspector/affordances.
- No capability from the three old editors is lost (catalog of pages/layouts,
  rename/delete/duplicate/activate, SEO panel, saved themes, import/export).

## 6. Risks & notes

- **The three-zone autosave router is the core new complexity.** Get the ownership
  tagging and the per-zone debounce right; a mis-routed save is a data-loss class
  of bug. Cover with tests per zone.
- **Don't regress the per-site work.** The site switcher → full-identity swap and
  the brand-override isolation are already built and verified
  ([per-site brand]); the unified shell must preserve them (key the editor on the
  active property as today).
- **Scope creep guard:** Phase 3 is the _shell_. The inspector depth
  ([04](04-inspector-full-design-surface.md)) and affordances
  ([05](05-editor-affordances.md)) are separate phases that drop into this shell —
  don't fold them in here.
