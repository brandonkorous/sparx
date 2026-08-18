import { describe, expect, it } from 'vitest';
import { bind, el, repeat } from '@wizeworks/silicaui-html';

import { encodeBindingRef } from './binding-ref';
import { collectSilicaSourceNeeds } from './silica-data-needs';

describe('collectSilicaSourceNeeds', () => {
  it('flags commerce for a commerce.product collection repeat', () => {
    const tree = el('section', '', {
      children: [
        repeat(el('div', '', { children: [bind(el('h3'), 'title')] }), 'commerce.product'),
      ],
    });
    const needs = collectSilicaSourceNeeds(tree);
    expect(needs.commerce).toBe(true);
    expect(needs.cmsTypes).toEqual([]);
  });

  it('flags commerce for a commerce.featured rail (bounded, same fetch as the catalog)', () => {
    const tree = repeat(
      el('div', '', { children: [bind(el('h3'), 'title')] }),
      'commerce.featured'
    );
    const needs = collectSilicaSourceNeeds(tree);
    expect(needs.commerce).toBe(true);
  });

  it('ignores scope-relative value refs (item.* / bare field keys)', () => {
    // A card's inner binds (`title`, `price`, `image`) name no source — only the
    // enclosing collection repeat does.
    const tree = repeat(
      el('div', '', {
        children: [bind(el('h3'), 'title'), bind(el('p'), 'price'), bind(el('img'), 'image')],
      }),
      'commerce.product'
    );
    const needs = collectSilicaSourceNeeds(tree);
    expect(needs.commerce).toBe(true);
    expect(needs.productPins).toEqual([]);
    expect(needs.cmsPins).toEqual([]);
  });

  it('collects + de-dupes cms collection types', () => {
    const tree = el('div', '', {
      children: [
        repeat(el('div'), 'cms.blog_post'),
        repeat(el('div'), 'cms.blog_post'),
        repeat(el('div'), 'cms.faq'),
      ],
    });
    const needs = collectSilicaSourceNeeds(tree);
    expect(needs.cmsTypes.sort()).toEqual(['blog_post', 'faq']);
    expect(needs.commerce).toBe(false);
  });

  it('records entity pins by kind from JSON-encoded refs', () => {
    const productRef = encodeBindingRef({ entity: 'commerce', id: 'prod_1' });
    const cmsRef = encodeBindingRef({ entity: 'cms', id: 'entry_9' });
    const tree = el('div', '', {
      children: [bind(el('div'), productRef), bind(el('div'), cmsRef)],
    });
    const needs = collectSilicaSourceNeeds(tree);
    expect(needs.productPins).toEqual(['prod_1']);
    expect(needs.cmsPins).toEqual(['entry_9']);
  });

  it('reads a source `{ from }` binding as its named source', () => {
    const sourceRef = encodeBindingRef({ source: { from: 'commerce.product' } });
    const tree = repeat(el('div'), sourceRef);
    const needs = collectSilicaSourceNeeds(tree);
    expect(needs.commerce).toBe(true);
  });

  it('returns all-empty needs for a static tree', () => {
    const tree = el('section', 'p-6', { children: [el('h1', '', { text: 'Hello' })] });
    expect(collectSilicaSourceNeeds(tree)).toEqual({
      commerce: false,
      products: { catalog: false, featured: false, fresh: false, related: false, categories: [] },
      cmsTypes: [],
      productPins: [],
      cmsPins: [],
      limits: {},
    });
  });

  it('classifies each configurable product source (catalog/featured/new/related/category)', () => {
    const rail = (ref: string) =>
      repeat(el('div', '', { children: [bind(el('h3'), 'title')] }), ref);
    const tree = el('div', '', {
      children: [
        rail('commerce.product'),
        rail('commerce.featured'),
        rail('commerce.new'),
        rail('commerce.related'),
        rail('commerce.category.studio-goods'),
        rail('commerce.category.studio-goods'), // de-duped
      ],
    });
    const needs = collectSilicaSourceNeeds(tree);
    expect(needs.commerce).toBe(true);
    expect(needs.products).toEqual({
      catalog: true,
      featured: true,
      fresh: true,
      related: true,
      categories: ['studio-goods'],
    });
  });
});

describe('collectSilicaSourceNeeds — per-source limits', () => {
  /** A repeat carrying silicaui 0.38's `limit`. `repeat()` does not take one, so the
   *  marker is extended directly — which is also what the engine's inspector writes. */
  const limited = (ref: string, limit?: number) => {
    const node = repeat(el('div', '', { children: [bind(el('h3'), 'title')] }), ref);
    if (limit !== undefined) (node as { data: { limit?: number } }).data.limit = limit;
    return node;
  };

  it('records the limit an author set on a rail', () => {
    const needs = collectSilicaSourceNeeds(
      el('div', '', { children: [limited('commerce.featured', 4)] })
    );
    expect(needs.limits['commerce.featured']).toBe(4);
  });

  it('reads an unlimited repeat as unbounded, not as absent', () => {
    const needs = collectSilicaSourceNeeds(
      el('div', '', { children: [limited('commerce.featured')] })
    );
    expect(needs.limits['commerce.featured']).toBeNull();
  });

  it('takes the MAX when two repeats share a source, so the larger block is not starved', () => {
    const needs = collectSilicaSourceNeeds(
      el('div', '', {
        children: [limited('commerce.featured', 4), limited('commerce.featured', 12)],
      })
    );
    expect(needs.limits['commerce.featured']).toBe(12);
  });

  it('lets one unbounded consumer un-limit a source, in either order', () => {
    const after = collectSilicaSourceNeeds(
      el('div', '', { children: [limited('commerce.new', 4), limited('commerce.new')] })
    );
    const before = collectSilicaSourceNeeds(
      el('div', '', { children: [limited('commerce.new'), limited('commerce.new', 4)] })
    );
    expect(after.limits['commerce.new']).toBeNull();
    expect(before.limits['commerce.new']).toBeNull();
  });

  it('ignores a limit the ENGINE would ignore, rather than fetching to a number it refuses', () => {
    for (const bad of [0, -3, 2.5]) {
      const needs = collectSilicaSourceNeeds(
        el('div', '', { children: [limited('commerce.related', bad)] })
      );
      expect(needs.limits['commerce.related']).toBeNull();
    }
  });

  it('keeps limits per source, and covers cms + category keys', () => {
    const needs = collectSilicaSourceNeeds(
      el('div', '', {
        children: [
          limited('commerce.product', 4),
          limited('cms.blog_post', 3),
          limited('commerce.category.studio-goods', 6),
        ],
      })
    );
    expect(needs.limits).toEqual({
      'commerce.product': 4,
      'cms.blog_post': 3,
      'commerce.category.studio-goods': 6,
    });
  });

  it('treats a VALUE bind against a source as unbounded — nothing is trimming it', () => {
    const node = bind(el('p'), 'commerce.product');
    const needs = collectSilicaSourceNeeds(el('div', '', { children: [node] }));
    expect(needs.limits['commerce.product']).toBeNull();
  });
});
