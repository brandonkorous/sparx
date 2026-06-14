# Sparx Platform — Responsive Rendering

**Version:** 0.1 (BUILT — site renderer + editor canvas)
**Author:** Brandon Korous
**Last Updated:** 2026-06-05

> **Top-2 platform rule.** No site shipped in 2026 survives if it is not
> responsive, and no tenant will pay for one that isn't. Responsiveness is
> non-negotiable for **both** surfaces: the Sparx platform UI (dashboard +
> builder) **and** every tenant site/property the platform generates. Any
> change that can render a fixed-width layout at a phone viewport is a bug.

## 1. Why this exists

The Builder composition model (docs/40) stores one node tree per page/layout.
Each container node carries a single `layout` ({ direction, columns, gap,
justify, alignItems, wrap }) with **no per-breakpoint values** — the author
picks one arrangement. Two render paths walk that tree:

- **Site** — `apps/site/components/builder-renderer.tsx` (the live site).
- **Editor canvas** — `apps/dashboard/.../builder/_builder/canvas.tsx` (the
  in-dashboard preview, "what you see is what you ship").

Both originally baked layout into **fixed inline styles**
(`grid-template-columns: repeat(N, …)`, `flex-direction: row`). React inline
styles can't hold `@media`, so a 4-column grid stayed 4 columns on a phone and
image-beside-text rows never stacked. Every template inherited that.

The fix is at the **render layer**, not the manifests: a single authored
`columns: 4` now _behaves_ responsively, so all blueprints (docs/54) and every
tenant-authored page get responsiveness for free, no per-node authoring.

## 2. The model — one authored layout, three realized tiers

The author still picks **one** desktop arrangement. The renderer derives the
narrower tiers from it. No new schema fields; `LayoutBase` is unchanged.

| Tier    | Viewport (site) | Editor device | Grid columns  | Row direction |
| ------- | --------------- | ------------- | ------------- | ------------- |
| Mobile  | `< 640px`       | `mobile` 390  | **1**         | stacks\*      |
| Tablet  | `640–1023px`    | `tablet` 834  | **min(N, 2)** | row           |
| Desktop | `≥ 1024px`      | `desktop`     | **N**         | row           |

Breakpoints are aligned so the editor's fixed-width device preview matches the
site's real-viewport behavior at the same widths.

### Grids (`direction: 'grid'`)

`1 → 2 → N`. A 1-column grid stays 1; a 2-column grid is `1 → 2 → 2`. Capped at
the schema max of 12.

### Rows (`direction: 'row'`) — stack heuristic

A row stacks to a column **on mobile only** (`< 768px`) **iff it contains a
container child** (Section / Grid / Stack / Card / Carousel / ProductForm, or an
unexpanded `custom:*`). The signal: a row of _containers_ is a layout band
(e.g. image-beside-text) that must stack; a row of _leaves only_ is an inline
lockup (logo + name, button + icon, a nav row) that must **not** stack.

\* When a row stacks, cross/main axes swap, so the authored `alignItems` /
`justify` would misbehave. Stacked rows reset to `align-items: stretch`
(full-width children) and `justify-content: flex-start`. The desktop values are
preserved and re-applied at `≥ 768px` (site passes them via the
`--bx-ai` / `--bx-jc` custom properties so the stacked rule can override them;
the editor recomputes from `device`).

### Heights & padding ease on small screens

Fixed section heights and the large padding steps relax on phones so heroes
aren't overlong and content isn't crushed:

| Token         | Desktop | Mobile (`< 768px`) |
| ------------- | ------- | ------------------ |
| height `md`   | 50vh    | 40vh               |
| height `lg`   | 75vh    | 55vh               |
| height `full` | 100vh   | 85vh               |
| padding `lg`  | 2.5rem  | 1.5rem             |
| padding `xl`  | 4.5rem  | 2rem               |

## 3. How each surface implements it

The two paths use the mechanism that fits — but the **rules above are the
single source of truth**; keep them in lockstep.

- **Site** renders to a real viewport, so it emits **CSS classes** and
  lets `@media` do the work. Layout/height/padding move out of inline styles
  into `bx-*` classes defined in `apps/site/app/site.css` (`.bx-grid` +
  `.bx-grid--cN`, `.bx-row`, `.bx-row--resp`, `.bx-stack`, `.bx-h-*`,
  `.bx-p-*`). Non-swapping bits (gap, surface, background, text color/align,
  contained max-width) stay inline.
- **Editor canvas** simulates a device by setting the canvas to a fixed _pixel
  width_ (mobile 390 / tablet 834), not the real viewport — so `@media` (which
  keys off the viewport) would never fire. The canvas already threads a
  `device` prop, so it **derives** columns / direction / height / padding from
  `device` in JS and keeps inline styles. Same rules, faithful preview.

## 4. Authoring guidance (templates & tenants)

- Don't hand-tune per breakpoint — author the desktop arrangement; the renderer
  collapses it. Use `columns` for grids; use `direction: 'row'` for bands you
  want side-by-side on desktop (they stack on phones automatically when they
  hold containers).
- Keep inline lockups (logo + name, button + icon) as a `row` of **leaves** so
  they stay inline at every width.
- `box.hiddenOn` (docs/40, the `Device` enum) still hides a node per breakpoint
  when a layout genuinely needs different content per tier.

## 5. Out of scope (deferred)

- Per-breakpoint authored values (e.g. "3 columns on tablet, 2 on mobile").
  The single-authored-value model covers the templates today; revisit only if a
  real design needs it.
- Container queries. Considered for unifying both surfaces, but the
  device-derived editor path is simpler and avoids `container-type` side
  effects. Revisit if a third render context appears.
- Responsive typography scaling beyond what the theme tokens already do.
