// The silica-native seed + render primitive (docs/118 Stage 3/4). Locks that the
// starter Site is a well-formed, fully-stamped silica `Site`, and that the shared
// render primitive composes frame ⊕ body, resolves data bindings through a host,
// and projects to HTML — the "canvas == storefront" seam, exercised end-to-end
// against the REAL silicaui-html engine (composeFrame + resolveTree + toHtml).

import { describe, expect, it } from 'vitest';
import { walk, type DataScope, type Node, type ResolveHost } from '@wizeworks/silicaui-html';
import { renderSilicaPage, renderSilicaSite } from './render';
import { starterFrame, starterPages, starterSite } from './site';

// Every node in a live Site tree must carry an id (selection / React keys /
// dnd-kit sortable ids). Strings are text children, not nodes.
function everyNodeHasId(root: Node): boolean {
  let ok = true;
  walk(root, (n) => {
    if (n.kind !== 'outlet' && !n.id) ok = false;
  });
  return ok;
}

function countOutlets(root: Node): number {
  let n = 0;
  walk(root, (node) => {
    if (node.kind === 'outlet') n += 1;
  });
  return n;
}

/** A node's id, narrowing past the id-less `OutletNode` (page/frame roots are
 *  always elements, but the `Node` union includes Outlet). */
function nodeId(n: Node): string | undefined {
  return n.kind === 'outlet' ? undefined : n.id;
}

// A minimal stand-in for sparx's `createSilicaResolver`: a two-product catalog,
// scope-relative field resolution (`title`/`price`/`image` off the item in scope).
const PRODUCTS = [
  { title: 'Aurora Lamp', price: 4900, image: 'https://cdn.test/aurora.jpg' },
  { title: 'Bexley Chair', price: 12900, image: 'https://cdn.test/bexley.jpg' },
];

const host: ResolveHost = {
  resolveCollection: (ref) => (ref === 'commerce.product' ? PRODUCTS : []),
  resolveBinding: (ref: string, scope: DataScope) => {
    const item = scope.item as Record<string, unknown> | undefined;
    if (item && ref in item) return { value: item[ref] };
    return { value: '' };
  },
};

describe('starterSite — the silica-native seed', () => {
  const site = starterSite();

  it('is a versioned Site with a frame and the starter pages (incl. the editable cart)', () => {
    expect(site.version).toBe('1.0.0');
    expect(site.frame).toBeDefined();
    expect(site.pages.map((p) => p.slug)).toEqual([
      '/',
      '/shop',
      '/cart',
      '/search',
      '/products',
      '/collections',
      '/category',
      '/account/login',
      '/account/register',
      '/account/forgot',
      '/account/reset',
      '/about',
      '/contact',
      // The RECORD pages, appended after the ordinary ones. A product detail page is a
      // page like any other now — it has an address, so it appears in the switcher and
      // a tenant can actually open it. Appended rather than interleaved because both
      // published readers tiebreak on `position asc`, so inserting one earlier would
      // renumber every page after it.
      '/products/:handle',
      '/collections/:handle',
      '/category/:handle',
    ]);
  });

  it('seeds a record page only for a module the tenant actually has', () => {
    // A publisher with no Commerce module has no product page to edit, so putting one
    // in their switcher would be an invitation to style a page their site never serves.
    const cmsOnly = starterSite(undefined, { commerceEnabled: false, cmsEnabled: true });
    const slugs = cmsOnly.pages.map((p) => p.slug);
    expect(slugs).toContain('/blog/:slug');
    expect(slugs).not.toContain('/products/:handle');
    expect(slugs).not.toContain('/category/:handle');
  });

  it('gives the frame exactly one Outlet (the page-body slot)', () => {
    expect(countOutlets(site.frame!.root)).toBe(1);
    expect(site.frame!.editable).toBe(true);
  });

  it('stamps every page + frame node with an id (live, editable trees)', () => {
    expect(everyNodeHasId(site.frame!.root)).toBe(true);
    for (const page of site.pages) {
      expect(page.id).toBeTruthy();
      expect(everyNodeHasId(page.root)).toBe(true);
    }
  });

  it('seeds an editable /book page only when the Scheduling module is active', () => {
    // Default (no opts): scheduling is opt-in, so no Book page or nav link.
    expect(starterPages().some((p) => p.slug === '/book')).toBe(false);
    // Active: an editable shell page wrapping the pinned scheduling.services core.
    const book = starterPages({ schedulingEnabled: true }).find((p) => p.slug === '/book');
    expect(book).toBeDefined();
    expect(everyNodeHasId(book!.root)).toBe(true);
    // The seed carries the pinned booking-services core (lowered to its host mount).
    let hasCore = false;
    walk(book!.root, (n) => {
      if (n.kind === 'host' && n.component === 'scheduling.services') hasCore = true;
    });
    expect(hasCore).toBe(true);
  });

  it('mints fresh ids per call — two seeds never share a node id', () => {
    const a = nodeId(starterPages()[0]!.root);
    const b = nodeId(starterPages()[0]!.root);
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
    // Frame too — a shared block root is deep-cloned before stamping.
    expect(nodeId(starterFrame().root)).not.toBe(nodeId(starterFrame().root));
  });
});

describe('renderSilicaPage — the storefront/publish render primitive', () => {
  const site = starterSite();
  const homeId = site.pages[0]!.id;

  it('composes the page body inside the shared frame chrome', () => {
    const html = renderSilicaPage(site, homeId, { host });
    expect(html).toBeTypeOf('string');
    // The frame column wraps the page — its outer shell class is present, and the
    // Outlet is gone (replaced by the body), not rendered as an empty slot.
    expect(html).toContain('min-h-screen');
    expect(html).not.toContain('data-sui-outlet');
  });

  it('resolves the commerce collection — one card per product, in brand markup', () => {
    const html = renderSilicaPage(site, homeId, { host })!;
    // Both products resolve (the grid AND the featured rail repeat the source).
    expect(html).toContain('Aurora Lamp');
    expect(html).toContain('Bexley Chair');
    // The bound scalar image src is filled from the product record.
    expect(html).toContain('https://cdn.test/aurora.jpg');
    // The placeholder tile never survives a bound render.
    expect(html).not.toContain('image/svg+xml');
  });

  it('renders statically (no host) without throwing — bindings pass through', () => {
    const html = renderSilicaPage(site, homeId);
    expect(html).toBeTypeOf('string');
    expect(html!.length).toBeGreaterThan(0);
  });

  it('returns undefined for an unknown page id', () => {
    expect(renderSilicaPage(site, 'nope')).toBeUndefined();
  });
});

describe('renderSilicaSite — the whole-site export', () => {
  it('renders every page, carrying identity + composed HTML', () => {
    const pages = renderSilicaSite(starterSite(), { host });
    expect(pages.map((p) => p.slug)).toEqual([
      '/',
      '/shop',
      '/cart',
      '/search',
      '/products',
      '/collections',
      '/category',
      '/account/login',
      '/account/register',
      '/account/forgot',
      '/account/reset',
      '/about',
      '/contact',
    ]);
    for (const p of pages) {
      expect(p.html).toContain('min-h-screen'); // every page wears the frame
      expect(p.id).toBeTruthy();
    }
  });
});
