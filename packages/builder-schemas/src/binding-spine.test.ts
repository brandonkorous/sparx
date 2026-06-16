// The v2 binding spine (docs/98 Pillar 7) — the contract that lets a node pin to
// a concrete product, repeat a specific collection, and trigger a cart action.
// These tests lock the schema's back-compat + new kinds, the classifier, the
// kind-aware resolver, and the ref-walk the data loaders batch-fetch from.

import { describe, expect, it } from 'vitest';

import { BindingSchema, BuilderNodeSchema, bindingKind, bindingIsProductScope } from './node';
import {
  collectBindingRefs,
  collectionSourceKey,
  entityPinKey,
  resolveBinding,
  type Scope,
} from './runtime';
import { parsePageImport } from './import-export';

describe('BindingSchema — back-compat + the new kinds', () => {
  it('still accepts a legacy field binding `{ path }`', () => {
    expect(BindingSchema.safeParse({ path: 'item.title' }).success).toBe(true);
  });

  it('accepts a product entity pin and rejects one missing its id', () => {
    expect(BindingSchema.safeParse({ entity: 'product', id: 'p1' }).success).toBe(true);
    expect(BindingSchema.safeParse({ entity: 'product' }).success).toBe(false);
  });

  it('requires cmsType for a cms entity pin', () => {
    expect(BindingSchema.safeParse({ entity: 'cms', id: 'e1' }).success).toBe(false);
    expect(BindingSchema.safeParse({ entity: 'cms', id: 'e1', cmsType: 'post' }).success).toBe(
      true
    );
  });

  it('accepts collection sources; `all` needs no id but the others do', () => {
    expect(BindingSchema.safeParse({ source: { from: 'all' } }).success).toBe(true);
    expect(BindingSchema.safeParse({ source: { from: 'collection', id: 'c1' } }).success).toBe(
      true
    );
    expect(BindingSchema.safeParse({ source: { from: 'category' } }).success).toBe(false);
  });

  it('accepts an action binding with an optional href', () => {
    expect(BindingSchema.safeParse({ action: 'add-to-cart' }).success).toBe(true);
    expect(BindingSchema.safeParse({ action: 'link', href: '/products' }).success).toBe(true);
  });
});

describe('bindingKind — precedence', () => {
  it('classifies each kind, most-specific first', () => {
    expect(bindingKind(undefined)).toBeUndefined();
    expect(bindingKind({})).toBeUndefined();
    expect(bindingKind({ path: 'item.title' })).toBe('field');
    expect(bindingKind({ entity: 'product', id: 'p1' })).toBe('entity');
    expect(bindingKind({ source: { from: 'all' } })).toBe('collection');
    expect(bindingKind({ action: 'add-to-cart' })).toBe('action');
    // action wins over a stray path; collection over a stray entity.
    expect(bindingKind({ action: 'link', path: 'x' })).toBe('action');
    expect(bindingKind({ source: { from: 'all' }, entity: 'product', id: 'p' })).toBe('collection');
  });
});

describe('bindingIsProductScope', () => {
  it('is true for a product pin and any collection source, false otherwise', () => {
    expect(bindingIsProductScope({ entity: 'product', id: 'p1' })).toBe(true);
    expect(bindingIsProductScope({ source: { from: 'collection', id: 'c1' } })).toBe(true);
    expect(bindingIsProductScope({ entity: 'cms', id: 'e1', cmsType: 'post' })).toBe(false);
    expect(bindingIsProductScope({ path: 'item.title' })).toBe(false);
    expect(bindingIsProductScope(undefined)).toBe(false);
  });
});

describe('source + pin keys', () => {
  it('builds stable keys', () => {
    expect(collectionSourceKey({ from: 'all' })).toBe('all');
    expect(collectionSourceKey({ from: 'collection', id: 'c1' })).toBe('collection:c1');
    expect(collectionSourceKey({ from: 'category', id: 'k2' })).toBe('category:k2');
    expect(entityPinKey('product', 'p9')).toBe('product:p9');
  });
});

describe('resolveBinding — kind-aware resolution', () => {
  const scope: Scope = {
    root: {
      __pins: { 'product:p1': { title: 'Pinned' } },
      __sources: { 'collection:c1': [{ title: 'A' }, { title: 'B' }] },
      commerce: { product: [{ title: 'All-0' }] },
    },
    item: { title: 'Scoped' },
  };

  it('resolves a field path against the scope (unchanged)', () => {
    expect(resolveBinding(scope, { path: 'item.title' })).toEqual('Scoped');
    expect(resolveBinding(scope, { path: 'commerce.product[0].title' })).toEqual('All-0');
  });

  it('resolves an entity pin from __pins', () => {
    expect(resolveBinding(scope, { entity: 'product', id: 'p1' })).toEqual({ title: 'Pinned' });
    expect(resolveBinding(scope, { entity: 'product', id: 'missing' })).toBeUndefined();
  });

  it('resolves a collection source from __sources (array → iterate)', () => {
    expect(resolveBinding(scope, { source: { from: 'collection', id: 'c1' } })).toHaveLength(2);
    expect(resolveBinding(scope, { source: { from: 'all' } })).toBeUndefined();
  });

  it('resolves nothing for an action binding or an absent binding', () => {
    expect(resolveBinding(scope, { action: 'add-to-cart' })).toBeUndefined();
    expect(resolveBinding(scope, undefined)).toBeUndefined();
  });
});

describe('collectBindingRefs — what the loaders batch-fetch', () => {
  it('dedupes entity pins + collection sources across the tree', () => {
    const tree = {
      binding: { source: { from: 'collection', id: 'c1' } },
      children: [
        { binding: { entity: 'product', id: 'p1' } },
        { binding: { entity: 'product', id: 'p1' } }, // dup
        {
          binding: { source: { from: 'collection', id: 'c1' } }, // dup
          children: [
            { binding: { entity: 'cms', id: 'e9', cmsType: 'post' } },
            { binding: { action: 'add-to-cart' } }, // not a ref
            { binding: { path: 'item.title' } }, // not a ref
          ],
        },
      ],
    };
    const refs = collectBindingRefs(tree);
    expect(refs.sources).toEqual([{ from: 'collection', id: 'c1' }]);
    expect(refs.entities).toEqual([
      { entity: 'product', id: 'p1' },
      { entity: 'cms', id: 'e9', cmsType: 'post' },
    ]);
  });
});

describe('an entity binding survives the node schema + import path', () => {
  it('round-trips on a real node tree', () => {
    const res = parsePageImport({
      type: 'Card',
      binding: { entity: 'product', id: 'p1', label: 'Diesel Injector' },
      children: [
        { type: 'AddToCart', binding: { action: 'add-to-cart' }, props: { label: 'Buy' } },
      ],
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.tree.binding?.entity).toBe('product');
      expect(res.tree.binding?.id).toBe('p1');
      expect(res.tree.children?.[0]?.binding?.action).toBe('add-to-cart');
    }
  });

  it('BuilderNodeSchema rejects a malformed entity pin (no id)', () => {
    const bad = BuilderNodeSchema.safeParse({
      id: 'n1',
      type: 'Card',
      props: {},
      binding: { entity: 'product' },
    });
    expect(bad.success).toBe(false);
  });
});
