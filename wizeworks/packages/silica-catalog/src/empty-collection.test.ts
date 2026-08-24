// An empty collection must publish NOTHING, never a placeholder record.
//
// Issue 092: a salon deleted the six products she never asked for, and her live
// homepage went on advertising "Product name · $0.00 · Sold out" — a price nobody
// set and a stock claim about a product that does not exist. `repeat` renders its
// template once against an empty collection (silica's one-placeholder-item
// convention), and the storefront was inheriting that convention as published copy.
//
// Both directions are asserted here on purpose. The first attempt at this fix hid
// the grid when products DID exist, because it hung the whole thing on `visible`,
// which reads `resolveBinding` — and a collection ref means nothing to a host that
// answers collections through `resolveCollection`. A test that only checked the
// empty case would have passed on a fix that emptied every shop on the platform.

import { describe, expect, it } from 'vitest';
import type { DataScope, ResolveHost } from '@wizeworks/silicaui-html';
import { renderSilicaPage } from './render';
import { starterSite } from './site';

const PRODUCTS = [
  { title: 'Aurora Lamp', price: 4900, image: 'https://cdn.test/aurora.jpg' },
  { title: 'Bexley Chair', price: 12900, image: 'https://cdn.test/bexley.jpg' },
];

/** Models the storefront host: collections through `resolveCollection`, and the
 *  same collections readable on the root through `resolveBinding` (the storefront
 *  publishes them at a dotted root path, which is what makes the empty MESSAGE
 *  resolvable).
 *
 *  Answers EVERY `commerce.*` product source, because the starter home page has two
 *  product sections — the catalog grid and a Featured rail. Feeding only the first
 *  leaves the second legitimately empty, which is correct behaviour and makes the
 *  "products exist" assertion unable to tell right from wrong. */
function hostWith(products: readonly unknown[]): ResolveHost {
  const isProductSource = (ref: string): boolean => ref.startsWith('commerce.');
  return {
    resolveCollection: (ref) => (isProductSource(ref) ? products : []),
    resolveBinding: (ref: string, scope: DataScope) => {
      const item = scope.item as Record<string, unknown> | undefined;
      if (item && ref in item) return { value: item[ref] };
      if (isProductSource(ref)) return { value: products };
      return { value: '' };
    },
  };
}

function renderHome(products: readonly unknown[]): string {
  const site = starterSite();
  const home = site.pages[0];
  if (!home) throw new Error('the starter has no home page');
  const html = renderSilicaPage(site, home.id, { host: hostWith(products) });
  if (!html) throw new Error('the home page did not render');
  return html;
}

describe('a product grid with nothing in it', () => {
  it('publishes no card, no invented price, and no stock claim', () => {
    const html = renderHome([]);

    // The three values from the card template. Each was a statement about her
    // business that nobody made.
    expect(html, 'placeholder title').not.toContain('Product name');
    expect(html, 'invented price').not.toContain('$0.00');
    expect(html, 'invented stock claim').not.toContain('Sold out');
  });

  it('says so, in the site voice, rather than vanishing silently', () => {
    expect(renderHome([])).toContain('Nothing in the shop just yet.');
  });

  it('still renders every product when there ARE products', () => {
    const html = renderHome(PRODUCTS);

    expect(html, 'first product').toContain('Aurora Lamp');
    expect(html, 'second product').toContain('Bexley Chair');
    // And the empty state is not sitting underneath them.
    expect(html, 'empty message').not.toContain('Nothing in the shop just yet.');
  });
});
