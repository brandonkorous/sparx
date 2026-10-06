// "Fits your fleet" on pages built with the site builder (sparx persona issue 086).
//
// What this pins, rendered through the REAL silica resolver the storefront uses:
//
//   1. A product card stamped before fleets existed gets the badges at render,
//      once, so a tenant's live home page shows them with nothing to republish.
//   2. The badge shows on the parts that fit, the warning on the parts that fit none,
//      and NOTHING on a part with no fitment data or for a visitor with no fleet.
//   3. Every product record carries both badge keys. The resolver treats a key that
//      is missing from the record as unknown and keeps the node, so a record without
//      them would print "Fits your fleet" under every product in the shop.
//   4. The product page says which of the buyer's vehicles it fits, before the button.

import { describe, expect, it } from 'vitest';
import { createSilicaResolver } from '@wizeworks/builder-schemas';
import { productCard } from '@wizeworks/silica-catalog';
import { el, repeat, resolveTree, toHtml, type Node } from '@wizeworks/silicaui-html';

import type { PublicProductListItem } from './commerce';
import { withFleetBadges, withFleetNotice } from './fleet-fit-tree';
import { toSilicaProduct } from './silica-data';

function item(id: string, over: Partial<PublicProductListItem> = {}): PublicProductListItem {
  return {
    id,
    title: `Part ${id}`,
    handle: `part-${id}`,
    description: null,
    vendor: null,
    productType: null,
    tags: [],
    priceMinCents: 4900,
    priceMaxCents: 4900,
    compareAtCents: null,
    yourPriceCents: null,
    inStock: true,
    averageRating: null,
    reviewCount: 0,
    primaryImageId: null,
    primaryImageAlt: null,
    defaultVariantId: `v-${id}`,
    seoTitle: null,
    seoDescription: null,
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...over,
  };
}

const unit12 = { id: 'veh-12', label: 'Unit 12, 2019 Ram 3500 6.7L Cummins' };

/** A stamped grid: the factory's product card, repeated over `products`. */
function stampedGrid(): Node {
  return repeat(el('div', 'grid', { children: [productCard()] }), 'products');
}

function renderGrid(tree: Node, records: Record<string, unknown>[]): string {
  const resolver = createSilicaResolver({ root: { products: records } });
  return toHtml(resolveTree(tree, resolver));
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('fleet badges on a stamped product card', () => {
  it('adds the badges once, and leaves a page without product cards alone', () => {
    const page = { root: stampedGrid() };
    const once = withFleetBadges(page);
    expect(once).not.toBe(page);
    expect(withFleetBadges(once)).toBe(once);

    const plain = { root: el('section', 'p-4', { children: [el('h1', '', { text: 'Hi' })] }) };
    expect(withFleetBadges(plain)).toBe(plain);
  });

  it('shows the right badge, and nothing at all for a part with no fitment data', () => {
    const { root } = withFleetBadges({ root: stampedGrid() });
    const html = renderGrid(root, [
      toSilicaProduct(item('fits', { fleetFit: { fits: true, vehicles: [unit12] } }), 'gillett'),
      toSilicaProduct(item('misfit', { fleetFit: { fits: false, vehicles: [] } }), 'gillett'),
      toSilicaProduct(item('rags', { fleetFit: null }), 'gillett'),
    ]);
    expect(count(html, 'Fits your fleet')).toBe(1);
    expect(count(html, 'Does not fit your fleet')).toBe(1);
  });

  it('shows no badge to a visitor without a fleet', () => {
    const { root } = withFleetBadges({ root: stampedGrid() });
    const html = renderGrid(root, [toSilicaProduct(item('a'), 'gillett')]);
    expect(html).not.toContain('your fleet');
  });

  it('puts both badge keys on every product record', () => {
    const record = toSilicaProduct(item('a'), 'gillett');
    expect('fitsFleet' in record).toBe(true);
    expect('notForFleet' in record).toBe(true);
  });
});

describe('the fleet notice on a product page', () => {
  const buyBox = () => ({
    root: el('div', 'flex flex-col', {
      children: [
        el('h1', '', { text: 'Fuel filter' }),
        {
          kind: 'element',
          tag: 'form',
          class: '',
          children: [],
          data: { kind: 'action', ref: 'add-to-cart' },
        },
      ],
    }),
  });

  it('names the vehicles it fits, before the button', () => {
    const page = withFleetNotice(buyBox(), { fits: true, vehicles: [unit12] });
    const html = toHtml(page.root);
    expect(html).toContain('Fits Unit 12, 2019 Ram 3500 6.7L Cummins.');
    expect(html.indexOf('Fits Unit 12')).toBeLessThan(html.indexOf('<form'));
  });

  it('warns when it fits none of their vehicles, and still lets them buy', () => {
    const html = toHtml(withFleetNotice(buyBox(), { fits: false, vehicles: [] }).root);
    expect(html).toContain('does not fit any vehicle in your fleet');
    expect(html).toContain('<form');
  });

  it('says nothing about a part with no fitment data', () => {
    const page = buyBox();
    expect(withFleetNotice(page, null)).toBe(page);
  });
});
