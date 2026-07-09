// The silica-engine binding seam (docs/118 §4) — locks the ONE ref vocabulary
// that the built-in picker, the engine's `scopeAt`, and sparx's resolver must all
// agree on. If `toSilicaDataSources` keys, `scopeAt` matching, and the resolver's
// scope-relative rule ever drift apart, a bound page silently renders empty — so
// these drive the real silicaui-html `scopeAt` against the mapper's output and
// the resolver against a realistic data root.

import { describe, expect, it } from 'vitest';
import type { Node } from '@wizeworks/silicaui-html';
import { scopeAt } from '@wizeworks/silicaui-html';

import { COMMERCE_SOURCES, SITE_SOURCES } from './binding';
import { createSilicaResolver } from './silica-resolve';
import { toSilicaDataSources } from './silica-data-sources';
import { encodeBindingRef } from './binding-ref';
import { PINS_ROOT, SOURCES_ROOT, entityPinKey, collectionSourceKey } from './runtime';

/** A minimal silica ancestor node that establishes a `collection` scope on `ref`. */
const scopeNode = (ref: string): Node =>
  ({ kind: 'element', tag: 'div', data: { kind: 'collection', ref } }) as Node;

describe('toSilicaDataSources — the picker/engine catalog', () => {
  const sources = toSilicaDataSources([...COMMERCE_SOURCES, ...SITE_SOURCES]);

  it('keeps each source root key as the scope ref (`commerce.product`, `product`, `site.identity`)', () => {
    const keys = sources.map((s) => s.key);
    expect(keys).toEqual(
      expect.arrayContaining(['commerce.product', 'product', 'site.identity', 'site.social'])
    );
  });

  it('keeps field keys scope-relative (`title`, not `commerce.product.title`)', () => {
    const product = sources.find((s) => s.key === 'commerce.product');
    expect(product?.fields?.map((f) => f.key)).toEqual(
      expect.arrayContaining(['id', 'handle', 'title', 'price', 'images'])
    );
  });

  it('passes cardinality through 1:1 so the picker filters collections correctly', () => {
    expect(sources.find((s) => s.key === 'commerce.product')?.cardinality).toBe('array');
    expect(sources.find((s) => s.key === 'product')?.cardinality).toBe('object');
    expect(sources.find((s) => s.key === 'site.social')?.cardinality).toBe('array');
  });

  it("silica's scopeAt narrows to a source's item fields under a matching collection ancestor", () => {
    const scoped = scopeAt(sources, [scopeNode('commerce.product')]);
    // Now the pickable fields are the product's own — `title`, `price`, … keyed short.
    expect(scoped.map((s) => s.key)).toEqual(expect.arrayContaining(['title', 'price', 'images']));
    // …and the top-level source keys are no longer in scope (you bind item fields now).
    expect(scoped.some((s) => s.key === 'commerce.product')).toBe(false);
  });
});

describe('createSilicaResolver — the scope-relative ref rule', () => {
  // Shaped exactly like `buildPreviewData` / `loadBuilderData` build it: dotted
  // source keys are NESTED (`setAtPath`), so `commerce.product` lives at
  // root.commerce.product and `site.identity` at root.site.identity.
  const root = {
    commerce: {
      product: [
        { id: 'p1', title: 'Aurora Lamp', price: 149, images: [{ url: '/a.png' }] },
        { id: 'p2', title: 'Dune Chair', price: 320, images: [] },
      ],
    },
    product: { id: 'p9', title: 'Solo Desk', price: 210 },
    site: { identity: { name: 'Northwind', tagline: 'Built to last' } },
    [PINS_ROOT]: { [entityPinKey('product', 'p1')]: { title: 'Pinned Aurora' } },
    [SOURCES_ROOT]: { [collectionSourceKey({ from: 'all' })]: [{ title: 'Src A' }] },
  };
  const resolver = createSilicaResolver({ root });

  it('resolves a top-level collection ref to the array (no scope)', () => {
    expect(resolver.resolveCollection('commerce.product', {})).toHaveLength(2);
  });

  it('resolves a value ref item-relatively once a scope is active', () => {
    const [first] = resolver.resolveCollection('commerce.product', {});
    // Inside the repeat, the picker writes the short field key `title`.
    expect(resolver.resolveBinding('title', { item: first }).value).toBe('Aurora Lamp');
    expect(resolver.resolveBinding('price', { item: first }).value).toBe(149);
  });

  it('treats an object source as a collection-of-one (detail page scope)', () => {
    const items = resolver.resolveCollection('product', {});
    expect(items).toHaveLength(1);
    expect(resolver.resolveBinding('title', { item: items[0] }).value).toBe('Solo Desk');
  });

  it('resolves a top-level dotted path when no scope is active (site chrome)', () => {
    expect(resolver.resolveBinding('site.identity.name', {}).value).toBe('Northwind');
  });

  it('keeps a nested collection scope-relative (images array within the product item)', () => {
    const [first] = resolver.resolveCollection('commerce.product', {});
    // A repeat on the `images` field, scoped to the product item.
    expect(resolver.resolveCollection('images', { item: first })).toHaveLength(1);
  });

  it('leaves JSON entity-pin / collection-source refs ABSOLUTE even inside a scope', () => {
    const pinRef = encodeBindingRef({ entity: 'product', id: 'p1' });
    const srcRef = encodeBindingRef({ source: { from: 'all' } });
    // A stray enclosing item must NOT re-root an absolute bind to `item.*`.
    expect(resolver.resolveBinding(pinRef, { item: { title: 'noise' } }).value).toEqual({
      title: 'Pinned Aurora',
    });
    expect(resolver.resolveCollection(srcRef, { item: { title: 'noise' } })).toEqual([
      { title: 'Src A' },
    ]);
  });
});
