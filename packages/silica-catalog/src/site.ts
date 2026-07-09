// The silica-native starter Site (docs/118 Stage 4 — the re-seed, not a backfill).
//
// A fresh tenant's site as a silica `Site`: a shared `Frame` (nav ⊕ Outlet ⊕
// footer chrome wrapping every page) + a small set of `Page`s composed from
// silica's shipped marketing blocks and sparx's commerce composites. This is the
// single source the re-seed writes to the store, the builder loads for editing,
// and the render primitive projects to the storefront — no per-surface drift.
//
// Every tree is fully STAMPED (ids present): a `Site`'s pages + frame are live,
// editable trees (unlike an id-free block `Template`), so the builder's selection,
// React keys, and dnd-kit sortable ids all have the globally-unique ids they
// require the moment the site loads. `stampTree` deep-clones each shared block
// root before minting, so reusing a block in more than one page is safe.

import {
  el,
  makePage,
  outlet,
  pageBody,
  stampTree,
  THEME_PRESETS,
  type Frame,
  type Node,
  type Page,
  type Site,
  type Theme,
} from '@wizeworks/silicaui-html';
import {
  contentProse,
  ctaBand,
  faqAccordion,
  featureGrid,
  footer,
  heroSplitCta,
  navbar,
} from '@wizeworks/silicaui-html/blocks';

import { collectionHeader, featuredProducts, productGrid } from './commerce';

// The shared shell: the site nav, a flex-grown main holding the single Outlet
// (every page body drops in here), and the footer. The `min-h-screen flex-col`
// column pins the footer to the bottom on short pages. Exactly one Outlet, per
// the Frame contract.
function frameRoot(): Node {
  return el('div', 'flex min-h-screen flex-col bg-base-100', {
    children: [navbar.root, el('main', 'flex-1', { children: [outlet()] }), footer.root],
  });
}

/** The starter frame — the shared header/footer chrome, fully stamped + editable. */
export function starterFrame(): Frame {
  return { root: stampTree(frameRoot()), editable: true };
}

/** The starter pages, fully stamped. Home merchandises (hero → product grid →
 *  featured rail → CTA); Shop is the catalog grid; About is editorial; Contact
 *  pairs an FAQ with a lead form. Each is a `pageBody` so the Navigator shows a
 *  real "Page" root that holds sections as siblings. */
export function starterPages(): Page[] {
  return [
    makePage(
      'Home',
      '/',
      stampTree(pageBody([heroSplitCta.root, productGrid(), featuredProducts(), ctaBand.root]))
    ),
    makePage('Shop', '/shop', stampTree(pageBody([collectionHeader(), productGrid()]))),
    makePage('About', '/about', stampTree(pageBody([contentProse.root, featureGrid.root]))),
    makePage('Contact', '/contact', stampTree(pageBody([faqAccordion.root]))),
  ];
}

/** The complete silica-native starter `Site` — shared frame + starter pages in the
 *  tenant's theme. Pass the tenant's compiled silica `Theme`
 *  (`compiledToSilicaTheme` of its brand) so the seed previews/renders in the real
 *  brand; falls back to a shipped preset when none is supplied. */
export function starterSite(theme: Theme = THEME_PRESETS[0]!): Site {
  return {
    version: '1.0.0',
    theme,
    frame: starterFrame(),
    pages: starterPages(),
  };
}
