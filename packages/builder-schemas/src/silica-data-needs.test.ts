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
      cmsTypes: [],
      productPins: [],
      cmsPins: [],
    });
  });
});
