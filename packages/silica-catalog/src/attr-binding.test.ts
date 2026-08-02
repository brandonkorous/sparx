// Locks attribute binding against the REAL silica engine.
//
// This file used to pin a BRIDGE: silica's `resolveTree` stopped resolving a node's
// children the moment it filled that node's binding — correct for a text binding (the
// children were just replaced), wrong for an attribute binding (the children survive,
// unresolved) — so the value rode a hidden `<input>` carrier that a hoist pass lifted
// onto the parent. silicaui 0.36.0 recurses (docs/silicaui/01 §7 / Q22), so the carrier is gone
// and these are native `{ kind:'value', ref, attr }` bindings.
//
// The assertions did NOT go with it. Every one of them describes something a storefront
// still depends on, and the most valuable one inverted rather than disappeared: the test
// that used to prove the carrier resolved children WHERE NATIVE COULD NOT is now the
// regression test proving native does. If a future engine release re-breaks that
// recursion, a product grid silently becomes a wall of placeholder text — and this
// catches it.

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

import { bindAttr, boundAttrs, dropEmptyUrlAttrs } from './attr-binding';
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

const render = (tree: Parameters<typeof dropEmptyUrlAttrs>[0], h?: ResolveHost) =>
  toHtml(dropEmptyUrlAttrs(h ? resolveTree(tree, h) : tree));

describe('bindAttr', () => {
  it('fills the parent attribute from the bound ref', () => {
    const html = render(repeat(el('div', 'grid', { children: [card()] }), 'items'), host);

    expect(html).toContain('href="/products/aurora-lamp"');
    expect(html).toContain('href="/products/dune-chair"');
    // No trace of the retired carrier protocol anywhere in the output.
    expect(html).not.toContain('<input');
    expect(html).not.toContain('__sui-attr');
  });

  it('resolves the bound element&apos;s OWN children — the Q22 regression guard', () => {
    // INVERTED FROM ITS ORIGINAL MEANING. This asserted that the carrier resolved
    // siblings where a native attribute binding did NOT: `resolveNode` early-returned
    // on a filled binding, so binding the `<a>` directly left `data-sui-bind="title"`
    // sitting over the placeholder text. 0.36.0 recurses, so the native path is now the
    // one under test — and if that recursion ever regresses, every product card on
    // every storefront reverts to placeholder text with nothing else to catch it.
    const html = render(repeat(card(), 'items'), host);
    expect(html).toContain('Aurora Lamp');
    expect(html).toContain('Dune Chair');
    expect(html).not.toContain('data-sui-bind');
    expect(html).not.toContain('Name');
  });

  it('binds each repeated item to ITS OWN url (scope, not the first item)', () => {
    const html = render(repeat(el('div', 'grid', { children: [card()] }), 'items'), host);
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(['/products/aurora-lamp', '/products/dune-chair']);
  });

  it('emits NO attribute when the value resolves empty (an un-clickable card)', () => {
    // The one behaviour the native path does NOT restore on its own: `fillValue` writes
    // `href=""`, which is an anchor that silently reloads the current page — worse than
    // no link, because it still looks clickable. `dropEmptyUrlAttrs` is what removes it.
    const empty: ResolveHost = { ...host, resolveCollection: () => [{ title: 'X', url: '' }] };
    const html = render(repeat(card(), 'items'), empty);
    expect(html).not.toContain('href');
  });

  it('drops an AUTHORED empty url too, not just a bound one', () => {
    // Strictly broader than the carrier it replaced: a half-finished link somebody left
    // in the tree is the same dead anchor, and was previously untouched.
    expect(render(el('a', 'x', { attrs: { href: '' }, text: 'Read more' }))).not.toContain('href');
    expect(render(el('img', 'x', { attrs: { src: '', alt: 'x' } }))).not.toContain('src=');
  });

  it('leaves an empty NON-url attribute alone', () => {
    // `alt=""` is the correct way to mark an image decorative, and an empty `value` is a
    // legitimately empty field. Scrubbing every empty attribute would break both.
    const html = render(el('img', 'x', { attrs: { src: '/a.png', alt: '' } }));
    expect(html).toContain('alt=""');
  });

  it('renders an unbound tree unchanged (static page, no host)', () => {
    const html = render(card());
    expect(html).not.toContain('<input');
    expect(html).not.toContain('href');
  });

  it('a bound href still passes through silica&apos;s URL sanitiser', () => {
    const evil: ResolveHost = {
      ...host,
      resolveCollection: () => [{ title: 'X', url: 'javascript:alert(1)' }],
    };
    // toHtml's sanitizeElement runs isSafeUrl over href — the payload is dropped,
    // exactly as it would be for an authored href. Binding grants no bypass.
    expect(render(repeat(card(), 'items'), evil)).not.toContain('javascript:');
  });

  it('the render primitive scrubs, so the storefront never ships a dead anchor', () => {
    const html = renderSilicaBody(repeat(el('div', 'grid', { children: [card()] }), 'items'), {
      host,
    });
    expect(html).toContain('href="/products/aurora-lamp"');
    expect(html).not.toContain('<input');
  });
});

describe('boundAttrs', () => {
  it('reports the attribute a node fills at render time', () => {
    // Without this a product card is an `<a>` with no href — indistinguishable from an
    // anchor somebody forgot to finish, which is exactly how site-lint used to read it.
    expect(boundAttrs(card())).toEqual(['href']);
  });

  it('is empty for a text binding and for an unbound node', () => {
    expect(boundAttrs(bind(el('h3', '', { text: 'Name' }), 'title'))).toEqual([]);
    expect(boundAttrs(el('a', '', { attrs: { href: '/x' } }))).toEqual([]);
  });
});
