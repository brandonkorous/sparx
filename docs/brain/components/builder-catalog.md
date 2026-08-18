---
title: The builder catalog is data-driven
node: components
type: rule
status: active
applies-to: [site]
sources:
  - wizeworks/packages/builder-schemas/src/catalog/
  - docs/98-builder-customization-rebuild.md
  - wizeworks/packages/surface-compile/src/theme.ts
---

The site-builder's component list **is a data-driven catalog**, not hardcoded types. Components are composed `BuilderNode` trees in `wizeworks/packages/builder-schemas/src/catalog/` (data-as-code; authoring contract in `catalog/CONTRACT.md` + `_kit.ts`), surfaced in the Add palette and **stamped (forked)** into the page — never new registry types or renderer branches.

- The **navbar is a real primitive** — `<nav class="navbar">` with `navbar-start / center / end` zones, CSS verbatim daisyUI in `surface-compile/src/theme.ts`. There is **one** navbar; "centered brand" = moving the Wordmark into `navbar-center`. A site "header" is just a navbar at the top — placement, not a type.
- A site layout is a **free canvas**; its only pinned (undeletable, undraggable) node is the `Outlet`.
- Node ids must be **globally unique** (`makeId` carries a random base) — they're persisted AND used as React keys + dnd-kit sortable ids.

**This is the site system** ([[two-design-systems]]) — `--st-*` tokens, `@sparx/site-ui`, per-tenant themeable. Do not apply dashboard (`@wizeworks/ui`) assumptions here.

**Why:** hardcoding component types would make every new component a code change; data-as-code lets the catalog grow as content.

**How to apply:** add a component as a composed tree in the catalog, not a registry type. Preserve node-id uniqueness on every stamp/add/paste/clone.

Related: [[two-design-systems]], [[modules]]
