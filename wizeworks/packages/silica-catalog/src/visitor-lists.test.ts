// sparx persona issue 022: a design captured from a live site carries a plain `repeat`,
// and Gillett Diesel's homepage went live reading "Product name · $0.00" over a
// catalog of zero. Both directions, as in empty-collection.test.ts: a fix that hides
// the list when it HAS items would empty every shop on the platform.

import { describe, expect, it } from 'vitest';
import { el, repeat, type ResolveHost, type Site } from '@wizeworks/silicaui-html';
import { renderSilicaPage } from './render';

// A plain repeat, exactly as a captured page stores it: no `omitWhenEmpty`.
function siteWithPlainList(): Site {
  const card = el('article', 'card', {
    children: [
      { ...el('h3', '', { text: 'Product name' }), data: { kind: 'value', ref: 'title' } },
    ],
  });
  const grid = repeat(el('div', 'grid', { children: [card] }), 'commerce.products');
  return {
    pages: [{ id: 'home', name: 'Home', slug: '', root: el('main', '', { children: [grid] }) }],
  } as unknown as Site;
}

function host(products: { title: string }[]): ResolveHost {
  return {
    resolveCollection: (ref) => (ref === 'commerce.products' ? products : undefined),
    resolveBinding: (ref, scope) => {
      const item = scope.item as Record<string, unknown> | undefined;
      return item && ref in item ? { value: item[ref] } : undefined;
    },
  };
}

describe('a plain list on a page a visitor sees', () => {
  it('draws no placeholder item when the list is empty', () => {
    const html = renderSilicaPage(siteWithPlainList(), 'home', { host: host([]) }) ?? '';
    expect(html).not.toContain('Product name');
  });

  it('still draws every item when the list has some', () => {
    const html =
      renderSilicaPage(siteWithPlainList(), 'home', {
        host: host([{ title: 'Fuel Injector, 6.7L Cummins' }, { title: 'Lift Pump' }]),
      }) ?? '';
    expect(html).toContain('Fuel Injector, 6.7L Cummins');
    expect(html).toContain('Lift Pump');
  });
});
