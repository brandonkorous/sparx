// Conditional visibility, against the real engine.
//
// The interesting behaviour is not "does it hide" — it is WHAT COUNTS AS ABSENT, and
// where the boundary sits. `0` and `false` are the two that bite: a price of zero must
// render, and the engine treats `false` as absent, so anything binding a boolean flag
// gets the opposite of what a naive reading suggests.

import { describe, expect, it } from 'vitest';
import {
  bind,
  el,
  resolveTree,
  toHtml,
  type DataScope,
  type Node,
  type ResolveHost,
} from '@wizeworks/silicaui-html';

import { visibilityRef, visibleWhen } from './conditional';
import { productDetailPage } from './commerce';
import { renderSilicaBody } from './render';

/** A host answering from one flat record — the shape a PDP resolves against. */
const hostFor = (record: Record<string, unknown>): ResolveHost => ({
  resolveBinding(ref: string, scope: DataScope) {
    const item = (scope.item as Record<string, unknown> | undefined) ?? record;
    return { value: item[ref] };
  },
  resolveCollection: () => [],
});

/** Render a conditional node the way a page actually contains one — NESTED. A
 *  conditional at the tree ROOT is a no-op: `resolveTree` ends in
 *  `resolveNode(tree, …) ?? tree`, so a root that resolves to "drop" falls back to the
 *  original tree (a whole document may not vanish) and the `data-sui-visible` marker
 *  survives into the HTML. Pinned as its own test below. */
const render = (node: Node, record: Record<string, unknown>) =>
  toHtml(resolveTree(el('div', 'page', { children: [node] }), hostFor(record)));

describe('visibleWhen', () => {
  it('keeps the node when the ref resolves to something', () => {
    const html = render(visibleWhen(el('span', 'x', { text: 'On sale' }), 'sale'), { sale: true });
    expect(html).toContain('On sale');
  });

  it('drops the node AND its subtree when the ref is absent', () => {
    for (const sale of [null, undefined, '', false, []]) {
      const tree = visibleWhen(
        el('div', 'x', { children: [el('b', '', { text: 'deep' })] }),
        'sale'
      );
      expect(render(tree, { sale }), String(sale)).not.toContain('deep');
    }
  });

  it('treats 0 as PRESENT — a free item is not a missing one', () => {
    // `isPresent` excludes null/undefined/false/'' and empty arrays, but not 0. If it
    // did, a $0 line, a zero-count badge and a zero-rating would all silently vanish.
    expect(render(visibleWhen(el('span', 'x', { text: 'Free' }), 'price'), { price: 0 })).toContain(
      'Free'
    );
  });

  it('negate shows the node only when the ref is ABSENT', () => {
    const outOfStock = () => visibleWhen(el('p', 'x', { text: 'Sold out' }), 'available', true);
    expect(render(outOfStock(), { available: false })).toContain('Sold out');
    expect(render(outOfStock(), { available: true })).not.toContain('Sold out');
  });

  it('is a NO-OP at the tree root, and says so', () => {
    // Not a bug to fix here, but a sharp edge worth knowing: `resolveTree` ends in
    // `resolveNode(tree, …) ?? tree`, so a root that resolves to "drop" falls back to
    // the unresolved original — marker attribute included. Real pages nest their
    // content under `pageBody`, so this only bites someone making a whole standalone
    // fragment conditional and wondering why the attribute shows up in the output.
    const bare = toHtml(
      resolveTree(visibleWhen(el('p', 'x', { text: 'gone?' }), 'sale'), hostFor({ sale: null }))
    );
    expect(bare).toContain('gone?');
    expect(bare).toContain('data-sui-visible');
  });

  it('visibilityRef reads back what visibleWhen wrote', () => {
    expect(visibilityRef(visibleWhen(el('span', ''), 'sale'))).toBe('sale');
    expect(visibilityRef(bind(el('span', ''), 'title'))).toBeUndefined();
    expect(visibilityRef(el('span', ''))).toBeUndefined();
  });
});

describe('the product page was-price', () => {
  const pdp = () => productDetailPage();

  it('shows the strikethrough only on an actual sale', () => {
    const onSale = renderSilicaBody(pdp(), {
      host: hostFor({ title: 'Lamp', price: 19, compareAtPrice: 29 }),
      scope: { item: { title: 'Lamp', price: 19, compareAtPrice: 29 } },
    });
    expect(onSale).toContain('line-through');
    expect(onSale).toContain('29');
  });

  it('renders NO empty strikethrough when there is no sale', () => {
    // The regression: a bare value bind left `<span class="line-through"></span>` on
    // every non-sale product page — invisible text, but a real flex item, so the price
    // row carried a stray `gap-3` after it.
    const noSale = renderSilicaBody(pdp(), {
      host: hostFor({ title: 'Lamp', price: 19, compareAtPrice: null }),
      scope: { item: { title: 'Lamp', price: 19, compareAtPrice: null } },
    });
    expect(noSale).not.toContain('line-through');
    // The real price is untouched — the conditional must not take the row with it.
    expect(noSale).toContain('19');
  });
});
