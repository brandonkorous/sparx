# 62 — Responsive Site Chrome (header & footer)

Version: 2.0
Author: Brandon Korous
Last Updated: 2026-06-08

## v2.0 update — `CollapsibleNav` + canvas parity (supersedes D4/D5)

The header nav is now a **prebuilt `@sparx/site-ui` component, `CollapsibleNav`**,
rendered by BOTH the live site and the editor canvas — not an `apps/site`-only
island. This fixed two things v1.0 left open:

- **Canvas parity.** The dashboard canvas has its own renderer (`registry.tsx`)
  that previously drew the site-chrome leaves (`NavMenu`, `Logo`, `SocialLinks`)
  as crude `bx-*` placeholders, so the canvas disagreed with the live site: the
  nav never collapsed, and `Logo` showed the brand name even when the identity
  had a logo image. The canvas now renders the **same site-ui components** the
  live site does, so the preview is faithful.
- **The swap is a container query, not a viewport one (supersedes D4).** The old
  `@media (max-width: 767px)` could never fire in the canvas, whose device
  preview is a fixed-width element inside a desktop viewport, not a narrow
  viewport. `CollapsibleNav` now swaps on a **named `st-frame` container query**
  (`@container st-frame (min-width: 768px)`), and both frame roots declare
  `container-name: st-frame` (`.bx-render` live, `.bx-canvas` canvas). It collapses
  identically at the simulated device width and the real viewport.
- **Centralized in site-ui, not forked (supersedes D5).** `CollapsibleNav`
  composes the existing `NavMenu` + `Drawer` primitives; its CSS lives in
  `packages/site-ui/src/styles/collapsible-nav.css` (compiled into both
  `styles.css` and `styles.canvas.css`). The `apps/site` island
  (`builder-nav-menu.tsx`) and the `.st-builder-nav*` viewport switch are deleted.

D1, D2, and D3 below still stand (scoping the legacy CSS, a real mobile app-bar,
the always-horizontal app-bar header). The text below is the original v1.0 record.

## Why this doc

Responsiveness is a top-priority platform rule (no site in 2026 survives if it
isn't responsive — see docs/59). The Builder render layer collapses page bands
correctly, but the **site chrome** — the header and footer the Builder layout
owns (docs/45, docs/57) — had two concrete defects on phones. This note records
the diagnosis, the decisions, and the build so the chrome is as responsive as
the page body.

## Background: two chrome systems, one class namespace

A tenant's chrome comes from one of two mutually-exclusive paths (see
`apps/site/app/layout.tsx`):

1. **Builder chrome** (`BuilderSiteChrome`) — when a published Builder layout
   exists. Header/footer are a Builder **node tree** (Logo · NavMenu · Button …)
   rendered by `apps/site/components/builder-renderer.tsx` using the
   `@sparx/site-ui` primitives. The nav primitive emits
   `<nav class="st-nav st-nav--row|--stack"><a class="st-nav__item">`.
2. **Legacy chrome** (`SiteHeader`/`SiteFooter`) — the fallback when there is no
   Builder layout. It renders its own `<nav class="st-nav"><a class="st-nav__link">`
   **inside `.st-header`**, and ships a working mobile hamburger
   (`components/mobile-nav.tsx` + the `.st-drawer-*` CSS).

Both systems use the bare class `.st-nav`. The legacy responsive rule in
`apps/site/app/site.css` was written for path 2 but was **unscoped**:

```css
@media (max-width: 760px) {
  .st-nav {
    display: none;
  }
  .st-nav__toggle {
    display: inline-flex;
  }
}
```

Because `.st-nav` is also what the Builder chrome (path 1) renders, this rule
**hid the Builder header nav and every footer link column on phones**. The
footer links literally vanished < 760px. That is the bulk of "the header and
footer aren't responsive."

## Decisions

- **D1 — Scope the legacy chrome CSS to `.st-header`.** The legacy header's
  responsive rules (`.st-nav` hide, `.st-nav__toggle` show, `.st-header__brand`
  margin) are scoped under `.st-header` so they can only touch path-2 chrome.
  The Builder chrome's `.st-nav` (which lives under `.bx-render`, never under
  `.st-header`) is no longer affected. This alone restores the footer + header
  nav on phones.

- **D2 — Give the Builder header a real mobile app-bar.** A new client island,
  `apps/site/components/builder-nav-menu.tsx`, renders a **row** NavMenu as:
  inline links ≥ 768px; a hamburger + slide-in drawer < 768px. It reuses the
  existing `.st-nav__toggle` + `.st-drawer-*` CSS and the proven MobileNav
  behavior (Escape, backdrop click, body-scroll lock, close-on-select). The
  renderer routes `NavMenu orientation:'row'` (primary/header nav) to the island;
  `orientation:'stack'` (footer / secondary) keeps the static `NavMenu`.

- **D3 — The header bar stays horizontal at every width.** The default Builder
  row collapses to a vertical stack on narrow containers (`flex flex-col
@3xl:flex-row`), which reads wrong for a top bar. A header authored as a true
  app-bar uses an explicit `flex flex-row …` class (no `layout.direction`, so the
  compiler doesn't inject the stack), keeping **logo left, actions right** on
  every width. The actions group (nav + CTA) is itself an always-row Stack, so on
  phones it reads **logo · [hamburger + CTA]** — conventional and tidy. Only the
  nav links fold into the drawer; the CTA stays visible. This is the recommended
  header authoring pattern for blueprints; the Mosaic blueprint adopts it.

- **D4 — One deliberate viewport breakpoint.** The render path is container-query
  based (docs/61 §7), but the app-bar swap (inline ↔ hamburger) and its drawer
  are **viewport** concerns: the header width ≈ the viewport and the drawer is
  `position: fixed`. So the island's swap uses a plain `@media (max-width: 767px)`
  — the one justified viewport breakpoint in an otherwise container-query layer.
  `fixed` is allowlist-blocked for _authored_ classes (docs/61 §9), which is
  exactly why the drawer must be a first-class island, not author-class chrome.

- **D5 — Reuse, don't fork.** The island reuses the existing drawer CSS kit and
  the `.st-iconbtn`/`.st-nav__toggle` styling. The only new CSS is the
  inline-vs-hamburger visibility switch (`.st-builder-nav*`). No `@sparx/site-ui`
  rebuild is required — all changes live in `apps/site` + the blueprint.

## Known follow-ups (not in this slice)

These surfaced during the audit and remain open (tracked in memory under the
responsiveness rule):

- `box.padding` `xl`/`lg` compile to fixed `p-16`/`p-10` (the `@media` relax only
  hits the now-dead editor-path `bx-p-*` classes), so large section padding does
  not ease on phones.
- The Button leaf emits an inline `min-width: 160px`, a fixed-width element on
  every site.
- A general "app-bar" layout affordance in the Builder (so a tenant can author a
  non-stacking header without hand-written `flex` classes) rather than per-blueprint.

## Files

- `apps/site/app/site.css` — D1 scoping + D5 `.st-builder-nav*` visibility switch.
- `apps/site/components/builder-nav-menu.tsx` — D2 island (new).
- `apps/site/components/builder-renderer.tsx` — route row NavMenu to the island.
- `packages/blueprints/src/blueprints/notion-workspace.ts` — D3 app-bar header.
- MCP authoring contract (`packages/builder/src/mcp/vocabulary.ts`,
  `.../write-tools.ts`, `packages/sitebuilder/src/mcp/write-tools.ts`) now mandates
  responsive header/footer authoring.
