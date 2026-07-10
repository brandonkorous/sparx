// Locks the attribute-binding bridge against the REAL silica engine.
//
// This bridge exists because silica's `resolveTree` stops resolving a node's
// children the moment it fills that node's binding — correct for a text binding
// (the children were just replaced), wrong for an attribute binding (the children
// survive, unresolved). It is load-bearing — a product grid that cannot link to
// its products is not a storefront — and it is meant to be DELETED once the
// engine recurses through an attribute binding (docs/119 Q22). Both facts make it
// worth pinning precisely: the carrier must never reach the HTML, an unresolved
// carrier must not emit an empty attribute, sibling bindings must still resolve,
// and the engine's URL sanitiser must still get its say.

import { describe, expect, it } from 'vitest';
import {
  bind,
  el,
  repeat,
  resolveTree,
  toHtml,
  type DataScope,
  type ResolveHost,
} from '@wizeworks/silicaui-html';

import { bindAttr, hoistAttrBindings } from './attr-binding';
import { renderSilicaBody } from './render';

const ITEMS = [
  { title: 'Aurora Lamp', url: '/products/aurora-lamp' },
  { title: 'Dune Chair', url: '/products/dune-chair' },
];

const host: ResolveHost = {
  resolveBinding(ref: string, scope: DataScope) {
    const item = scope.item as Record<string, unknown> | undefined;
    return { value: item?.[ref] };
  },
  resolveCollection: (ref) => (ref === 'items' ? ITEMS : []),
};

/** An `<a>` card whose href is bound, wrapping a bound title. */
const card = () =>
  bindAttr(
    el('a', 'card', { children: [bind(el('h3', '', { text: 'Name' }), 'title')] }),
    'href',
    'url'
  );

describe('bindAttr / hoistAttrBindings', () => {
  it('lifts a resolved carrier onto the parent attribute and removes the carrier', () => {
    const tree = repeat(el('div', 'grid', { children: [card()] }), 'items');
    const html = toHtml(hoistAttrBindings(resolveTree(tree, host)));

    expect(html).toContain('href="/products/aurora-lamp"');
    expect(html).toContain('href="/products/dune-chair"');
    // the carrier must never survive into the markup
    expect(html).not.toContain('<input');
    expect(html).not.toContain('__sui-attr');
  });

  it('resolves the bound element&apos;s OWN children (a native attr binding does not)', () => {
    // The whole reason for the carrier. `resolveNode` early-returns on a filled
    // binding, so binding the `<a>` directly would leave `data-sui-bind="title"`
    // over the placeholder text. Via a leaf carrier, the siblings resolve.
    const html = toHtml(hoistAttrBindings(resolveTree(repeat(card(), 'items'), host)));
    expect(html).toContain('Aurora Lamp');
    expect(html).toContain('Dune Chair');
    expect(html).not.toContain('data-sui-bind');
    expect(html).not.toContain('Name');
  });

  it('binds each repeated item to ITS OWN url (scope, not the first item)', () => {
    const tree = repeat(el('div', 'grid', { children: [card()] }), 'items');
    const html = toHtml(hoistAttrBindings(resolveTree(tree, host)));
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(['/products/aurora-lamp', '/products/dune-chair']);
  });

  it('emits NO attribute when the value resolves empty (an un-clickable card)', () => {
    const empty: ResolveHost = { ...host, resolveCollection: () => [{ title: 'X', url: '' }] };
    const html = toHtml(hoistAttrBindings(resolveTree(repeat(card(), 'items'), empty)));
    // never `href=""`, which would silently reload the current page on click
    expect(html).not.toContain('href');
    expect(html).not.toContain('<input');
  });

  it('strips an UNRESOLVED carrier (static render, no host)', () => {
    // resolveTree is skipped entirely when a page has no bindings host.
    const html = toHtml(hoistAttrBindings(card()));
    expect(html).not.toContain('<input');
    expect(html).not.toContain('href');
  });

  it('a bound href still passes through silica&apos;s URL sanitiser', () => {
    const evil: ResolveHost = {
      ...host,
      resolveCollection: () => [{ title: 'X', url: 'javascript:alert(1)' }],
    };
    const html = toHtml(hoistAttrBindings(resolveTree(repeat(card(), 'items'), evil)));
    // toHtml's sanitizeElement runs isSafeUrl over href — the payload is dropped,
    // exactly as it would be for an authored href. The bridge grants no bypass.
    expect(html).not.toContain('javascript:');
  });

  it('the render primitive hoists, so the storefront never ships a carrier', () => {
    const html = renderSilicaBody(repeat(el('div', 'grid', { children: [card()] }), 'items'), {
      host,
    });
    expect(html).toContain('href="/products/aurora-lamp"');
    expect(html).not.toContain('<input');
  });
});
