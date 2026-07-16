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
const scopeNode = (ref: string): Node => ({
  kind: 'element',
  tag: 'div',
  data: { kind: 'collection', ref },
});

describe('toSilicaDataSources — the picker/engine catalog', () => {
  const sources = toSilicaDataSources([...COMMERCE_SOURCES, ...SITE_SOURCES]);

  it('keeps each source root key as the scope ref (`commerce.product`, `product`, `site.identity`)', () => {
    const keys = sources.map((s) => s.key);
    expect(keys).toEqual(
      expect.arrayContaining(['commerce.product', 'product', 'site.identity', 'site.social'])
    );
  });

  it('qualifies field keys under their source (`commerce.product.title`, not `title`)', () => {
    // A bare key is a ref FRAGMENT, not a ref: five sources share PRODUCT_FIELDS, so a
    // bare `title` is emitted five times — five colliding picker options (React key
    // warnings) that all mean the same thing, and none of which resolve at the root.
    const product = sources.find((s) => s.key === 'commerce.product');
    expect(product?.fields?.map((f) => f.key)).toEqual(
      expect.arrayContaining([
        'commerce.product.id',
        'commerce.product.title',
        'commerce.product.price',
      ])
    );
  });

  it('emits NO duplicate option value across the whole catalog', () => {
    // The invariant behind the React duplicate-key warnings: silica keys each picker
    // option by its value, and the value IS the ref. Two sources sharing a field shape
    // must not collide.
    const flat = (srcs: typeof sources, out: string[] = []): string[] => {
      for (const s of srcs) {
        if (s.cardinality === 'scalar') out.push(s.key);
        if (s.fields) flat(s.fields as typeof sources, out);
      }
      return out;
    };
    const values = flat(sources);
    expect(new Set(values).size).toBe(values.length);
  });

  it('passes cardinality through 1:1 so the picker filters collections correctly', () => {
    expect(sources.find((s) => s.key === 'commerce.product')?.cardinality).toBe('array');
    expect(sources.find((s) => s.key === 'product')?.cardinality).toBe('object');
    expect(sources.find((s) => s.key === 'site.social')?.cardinality).toBe('array');
  });

  it("silica's scopeAt narrows to a source's item fields under a matching collection ancestor", () => {
    const scoped = scopeAt(sources, [scopeNode('commerce.product')]);
    // Narrowing still works after qualification: `scopeAt` matches an ancestor's
    // collection ref against a SOURCE key, which is untouched — only FIELD keys changed.
    expect(scoped.map((s) => s.key)).toEqual(
      expect.arrayContaining([
        'commerce.product.title',
        'commerce.product.price',
        'commerce.product.images',
      ])
    );
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
    const [first] = resolver.resolveCollection('commerce.product', {})!;
    // A BARE field key (code-authored composites, and trees authored before refs were
    // qualified) is already item-relative and must keep working.
    expect(resolver.resolveBinding('title', { item: first })!.value).toBe('Aurora Lamp');
    expect(resolver.resolveBinding('price', { item: first })!.value).toBe(149);
  });

  it('resolves the QUALIFIED ref the picker now writes, against the repeat item', () => {
    // The round trip that carries the fix: inside a repeat the picker offers
    // `commerce.product.title` (qualified, so it cannot collide with the other four
    // product-shaped sources), and the value lives on `scope.item` — so the source
    // prefix has to come off. Get this wrong and every bound product grid renders empty.
    const [first] = resolver.resolveCollection('commerce.product', {})!;
    expect(resolver.resolveBinding('commerce.product.title', { item: first })!.value).toBe(
      'Aurora Lamp'
    );
    // A DIFFERENT product-shaped source resolves against the same item — the prefix is
    // just scope noise once a repeat is active.
    expect(resolver.resolveBinding('commerce.featured.price', { item: first })!.value).toBe(149);
  });

  it('reports an unknown qualified ref rather than blanking the node', () => {
    const [first] = resolver.resolveCollection('commerce.product', {})!;
    expect(resolver.resolveBinding('commerce.product.nope', { item: first })).toBeUndefined();
  });

  it('treats an object source as a collection-of-one (detail page scope)', () => {
    const items = resolver.resolveCollection('product', {})!;
    expect(items).toHaveLength(1);
    expect(resolver.resolveBinding('title', { item: items[0] })!.value).toBe('Solo Desk');
  });

  it('resolves a top-level dotted path when no scope is active (site chrome)', () => {
    expect(resolver.resolveBinding('site.identity.name', {})!.value).toBe('Northwind');
  });

  it('keeps a nested collection scope-relative (images array within the product item)', () => {
    const [first] = resolver.resolveCollection('commerce.product', {})!;
    // A repeat on the `images` field, scoped to the product item.
    expect(resolver.resolveCollection('images', { item: first })).toHaveLength(1);
  });

  it('leaves JSON entity-pin / collection-source refs ABSOLUTE even inside a scope', () => {
    const pinRef = encodeBindingRef({ entity: 'product', id: 'p1' });
    const srcRef = encodeBindingRef({ source: { from: 'all' } });
    // A stray enclosing item must NOT re-root an absolute bind to `item.*`.
    expect(resolver.resolveBinding(pinRef, { item: { title: 'noise' } })!.value).toEqual({
      title: 'Pinned Aurora',
    });
    expect(resolver.resolveCollection(srcRef, { item: { title: 'noise' } })).toEqual([
      { title: 'Src A' },
    ]);
  });
});
