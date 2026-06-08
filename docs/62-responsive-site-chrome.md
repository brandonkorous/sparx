# 62 — Responsive Site Chrome (header & footer)

Version: 1.0
Author: Brandon Korous
Last Updated: 2026-06-08

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
   `<nav class="sf-nav sf-nav--row|--stack"><a class="sf-nav__item">`.
2. **Legacy chrome** (`SiteHeader`/`SiteFooter`) — the fallback when there is no
   Builder layout. It renders its own `<nav class="sf-nav"><a class="sf-nav__link">`
   **inside `.sf-header`**, and ships a working mobile hamburger
   (`components/mobile-nav.tsx` + the `.sf-drawer-*` CSS).

Both systems use the bare class `.sf-nav`. The legacy responsive rule in
`apps/site/app/site.css` was written for path 2 but was **unscoped**:

```css
@media (max-width: 760px) {
  .sf-nav {
    display: none;
  }
  .sf-nav__toggle {
    display: inline-flex;
  }
}
```

Because `.sf-nav` is also what the Builder chrome (path 1) renders, this rule
**hid the Builder header nav and every footer link column on phones**. The
footer links literally vanished < 760px. That is the bulk of "the header and
footer aren't responsive."

## Decisions

- **D1 — Scope the legacy chrome CSS to `.sf-header`.** The legacy header's
  responsive rules (`.sf-nav` hide, `.sf-nav__toggle` show, `.sf-header__brand`
  margin) are scoped under `.sf-header` so they can only touch path-2 chrome.
  The Builder chrome's `.sf-nav` (which lives under `.bx-render`, never under
  `.sf-header`) is no longer affected. This alone restores the footer + header
  nav on phones.

- **D2 — Give the Builder header a real mobile app-bar.** A new client island,
  `apps/site/components/builder-nav-menu.tsx`, renders a **row** NavMenu as:
  inline links ≥ 768px; a hamburger + slide-in drawer < 768px. It reuses the
  existing `.sf-nav__toggle` + `.sf-drawer-*` CSS and the proven MobileNav
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
  the `.sf-iconbtn`/`.sf-nav__toggle` styling. The only new CSS is the
  inline-vs-hamburger visibility switch (`.sf-builder-nav*`). No `@sparx/site-ui`
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

- `apps/site/app/site.css` — D1 scoping + D5 `.sf-builder-nav*` visibility switch.
- `apps/site/components/builder-nav-menu.tsx` — D2 island (new).
- `apps/site/components/builder-renderer.tsx` — route row NavMenu to the island.
- `packages/blueprints/src/blueprints/notion-workspace.ts` — D3 app-bar header.
- MCP authoring contract (`packages/builder/src/mcp/vocabulary.ts`,
  `.../write-tools.ts`, `packages/sitebuilder/src/mcp/write-tools.ts`) now mandates
  responsive header/footer authoring.
