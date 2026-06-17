// Catalog · Navigation (docs/98 §5). Bars, menus, breadcrumbs, steps, pagination.
//
// THE re-architecture exemplar — and the common/comprehensive split it teaches:
//
//   • `navbar` (common) IS JUST THE NAVBAR — a `<nav class="navbar">` shell with
//     its three EMPTY zones `navbar-start` / `navbar-center` / `navbar-end` (the
//     zone layout lives in CSS — surface-compile theme.ts, verbatim from daisyUI:
//     the side zones are width:50%, the center is shrink-0 between them). It is the
//     bar STRUCTURE; you drop brand / nav / actions into the zones yourself. There
//     is ONE navbar (no "centered" variant) — centering a brand is just placing it
//     in `navbar-center`.
//   • `navbar_brand` (comprehensive) is a navbar already FILLED OUT — brand in the
//     start zone, primary nav in the center, an action in the end, plus a mobile
//     menu. A populated bar is a bigger composite, so it's a separate entry; the
//     bare `navbar` never carries content.
//
// Every node in either stays individually selectable, classable, and editable — the
// whole point of v2.

import { el, atom, bound, entry, type PlatformCatalogEntry } from './_kit';

// A primary-nav link — individually editable (not a NavMenu black box).
const navLink = (label: string, href: string) =>
  el('a', 'text-sm font-medium text-base-content/80 transition-colors hover:text-primary', {
    text: label,
    attrs: { href },
  });

// A link styled as an item inside a dropdown / mobile sheet.
const sheetLink = (label: string, href: string) =>
  el('a', 'rounded-field px-3 py-2 text-sm text-base-content hover:bg-base-200', {
    text: label,
    attrs: { href },
  });

export const NAVIGATION_CATALOG: PlatformCatalogEntry[] = [
  // ── Navbar — JUST the bar: navbar-start / -center / -end zones, all empty ─────
  // The structural primitive. The three zones come from the `navbar`/`navbar-start`/
  // `-center`/`-end` utilities (surface-compile theme.ts, daisyUI-faithful): the
  // side zones are width:50% and the center is shrink-0 between them, so whatever
  // you drop into the center sits dead-centre. Drop brand / nav / actions into the
  // zones yourself — for a pre-filled bar, stamp `navbar_brand` instead.
  entry({
    key: 'navbar',
    name: 'Navbar',
    category: 'navigation',
    kind: 'common',
    icon: 'panel-top',
    description:
      'Just the bar: a navbar with empty navbar-start, navbar-center, and navbar-end zones. Drop your brand, nav, and actions into the zones. Anything in navbar-center sits dead-centre.',
    surfaces: ['page', 'site'],
    tags: ['navbar', 'bar', 'appbar', 'topbar', 'zones', 'navigation'],
    tree: el('nav', 'navbar border-b border-base-200 bg-base-100', {
      name: 'Navbar',
      attrs: { ariaLabel: 'Primary' },
      children: [
        el('div', 'navbar-start gap-2', { name: 'navbar-start' }),
        el('div', 'navbar-center gap-6', { name: 'navbar-center' }),
        el('div', 'navbar-end gap-2', { name: 'navbar-end' }),
      ],
    }),
  }),

  // ── Navbar with brand & nav — a navbar already filled out (comprehensive) ─────
  // The same bar, populated: brand in navbar-start, primary nav in navbar-center,
  // an action in navbar-end, plus a CSS-native mobile menu. A populated bar is a
  // bigger composite than the bare `navbar`, so it's its own entry. To centre the
  // brand instead, move the Wordmark from navbar-start into navbar-center.
  entry({
    key: 'navbar_brand',
    name: 'Navbar with brand & nav',
    category: 'navigation',
    kind: 'comprehensive',
    icon: 'panel-top',
    description:
      'A ready-made bar: brand in navbar-start, primary nav links in navbar-center, and an action button in navbar-end, collapsing to a menu on mobile.',
    surfaces: ['page', 'site'],
    tags: ['header', 'nav', 'menu', 'appbar', 'topbar', 'navbar', 'brand', 'navigation'],
    tree: el('nav', 'navbar border-b border-base-200 bg-base-100', {
      name: 'Navbar',
      attrs: { ariaLabel: 'Primary' },
      children: [
        // navbar-start — mobile menu (CSS-native <details>) + brand
        el('div', 'navbar-start gap-2', {
          name: 'navbar-start',
          children: [
            el('details', 'relative @3xl:hidden', {
              children: [
                el(
                  'summary',
                  'flex cursor-pointer list-none items-center rounded-field p-2 text-xl leading-none text-base-content hover:bg-base-200 [&::-webkit-details-marker]:hidden',
                  { text: '☰' }
                ),
                el(
                  'div',
                  'absolute left-0 top-full z-40 mt-2 flex w-52 flex-col gap-1 rounded-box border border-base-200 bg-base-100 p-2 shadow-lg',
                  {
                    children: [
                      sheetLink('Home', '/'),
                      sheetLink('Shop', '/products'),
                      sheetLink('About', '/about'),
                      sheetLink('Contact', '/contact'),
                    ],
                  }
                ),
              ],
            }),
            bound(atom('Wordmark', '', { collapse: 'mark' }), 'site.identity'),
          ],
        }),
        // navbar-center — desktop nav (hidden on mobile)
        el('div', 'navbar-center hidden gap-6 @3xl:flex', {
          name: 'navbar-center',
          children: [
            navLink('Home', '/'),
            navLink('Shop', '/products'),
            navLink('About', '/about'),
            navLink('Contact', '/contact'),
          ],
        }),
        // navbar-end — action
        el('div', 'navbar-end gap-3', {
          name: 'navbar-end',
          children: [
            atom('Button', 'st-btn st-c-primary st-v-solid st-btn--sz-sm', {
              label: 'Get started',
            }),
          ],
        }),
      ],
    }),
  }),

  // ── Breadcrumb ───────────────────────────────────────────────────────────────
  entry({
    key: 'breadcrumb',
    name: 'Breadcrumb',
    category: 'navigation',
    kind: 'common',
    icon: 'chevron-right',
    description: 'A trail of links showing where the current page sits in the hierarchy.',
    surfaces: ['page', 'site'],
    tags: ['breadcrumb', 'trail', 'path', 'navigation'],
    // The real Breadcrumb atom (st-breadcrumb) — the last crumb is the current page.
    tree: atom('Breadcrumb', 'w-full', {
      items: 'Home | /\nCollections | /collections\nCurrent page',
    }),
  }),

  // ── Vertical menu (sidebar nav) ──────────────────────────────────────────────
  entry({
    key: 'menu_vertical',
    name: 'Menu (vertical)',
    category: 'navigation',
    kind: 'common',
    icon: 'menu',
    description: 'A stacked navigation list — a sidebar or in-page section menu.',
    surfaces: ['page', 'site'],
    tags: ['menu', 'sidebar', 'list', 'navigation', 'vertical'],
    // The real Menu atom (st-menu) — the first item renders active. (Was a hand-rolled
    // <ul> of styled links.)
    tree: atom('Menu', 'w-full max-w-xs rounded-box border border-base-200 bg-base-100 p-2', {
      orientation: 'vertical',
      items: 'Overview | #\nFeatures | #\nPricing | #\nSupport | #',
    }),
  }),

  // ── Tabs (visual) ────────────────────────────────────────────────────────────
  entry({
    key: 'tabs',
    name: 'Tabs',
    category: 'navigation',
    kind: 'common',
    icon: 'rectangle-horizontal',
    description: 'A row of tabs with an active underline. Wire panels with the tabs behavior.',
    surfaces: ['page', 'site'],
    tags: ['tabs', 'segmented', 'navigation'],
    tree: el('div', 'flex w-full items-center gap-1 border-b border-base-200', {
      children: [
        el(
          'button',
          '-mb-px border-b-2 border-primary px-4 py-2 text-sm font-medium text-primary',
          { text: 'Overview', attrs: { type: 'button' } }
        ),
        el(
          'button',
          '-mb-px border-b-2 border-transparent px-4 py-2 text-sm font-medium text-base-content/60 transition-colors hover:text-base-content',
          { text: 'Details', attrs: { type: 'button' } }
        ),
        el(
          'button',
          '-mb-px border-b-2 border-transparent px-4 py-2 text-sm font-medium text-base-content/60 transition-colors hover:text-base-content',
          { text: 'Reviews', attrs: { type: 'button' } }
        ),
      ],
    }),
  }),

  // ── Steps ────────────────────────────────────────────────────────────────────
  entry({
    key: 'steps',
    name: 'Steps',
    category: 'navigation',
    kind: 'common',
    icon: 'list-ordered',
    description: 'A horizontal progress indicator across a multi-step flow.',
    surfaces: ['page', 'site'],
    tags: ['steps', 'stepper', 'progress', 'wizard', 'navigation'],
    // The real Steps atom (st-steps) — "x " marks a completed step, "* " the active
    // one. (Was hand-rolled numbered circles + connector rails.)
    tree: atom('Steps', 'st-c-primary w-full', {
      orientation: 'horizontal',
      items: 'x Cart\n* Shipping\nPayment',
    }),
  }),

  // ── Pagination ───────────────────────────────────────────────────────────────
  entry({
    key: 'pagination',
    name: 'Pagination',
    category: 'navigation',
    kind: 'common',
    icon: 'ellipsis',
    description: 'Numbered page controls with previous / next.',
    surfaces: ['page', 'site'],
    tags: ['pagination', 'pager', 'pages', 'navigation'],
    // The real Pagination atom (st-pagination) — page/total drive the numbers,
    // sibling window, and prev/next. (Was hand-rolled page links.)
    tree: atom('Pagination', 'w-full justify-center', { page: '1', total: '12' }),
  }),
];
