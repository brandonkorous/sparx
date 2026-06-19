import { describe, expect, it } from 'vitest';

import { resolveBindingHandles, type InstallResult } from './blueprint-installer';
import type { BuilderNode } from '@sparx/builder-schemas';

/** A minimal InstallResult carrying just the handle→id maps the rewrite reads. */
function fakeResult(over: Partial<InstallResult> = {}): InstallResult {
  return {
    assets: {},
    categories: {},
    collections: {},
    products: [],
    components: [],
    theme: null,
    layoutId: null,
    pages: [],
    emails: [],
    content: [],
    counts: {},
    ...over,
  };
}

describe('resolveBindingHandles', () => {
  it('rewrites a category collection-source handle to the created id', () => {
    const tree: BuilderNode = {
      id: 'root',
      type: 'Section',
      props: {},
      children: [
        {
          id: 'grid',
          type: 'Section',
          props: {},
          binding: { source: { from: 'category', id: 'acai-bowls' } },
          children: [{ id: 'card', type: 'Card', props: {} }],
        },
      ],
    };
    const out = resolveBindingHandles(
      tree,
      fakeResult({ categories: { 'acai-bowls': 'cat-uuid-1' } })
    );
    expect(out.children?.[0]?.binding?.source).toEqual({ from: 'category', id: 'cat-uuid-1' });
  });

  it('rewrites a collection source and an entity pin by handle', () => {
    const tree: BuilderNode = {
      id: 'root',
      type: 'Section',
      props: {},
      children: [
        {
          id: 'g',
          type: 'Section',
          props: {},
          binding: { source: { from: 'collection', id: 'signature-bowls', limit: 6 } },
        },
        {
          id: 'pin',
          type: 'Card',
          props: {},
          binding: { entity: 'product', id: 'midnight-acai' },
        },
      ],
    };
    const out = resolveBindingHandles(
      tree,
      fakeResult({
        collections: { 'signature-bowls': 'coll-uuid' },
        products: [{ handle: 'midnight-acai', id: 'prod-uuid' }],
      })
    );
    expect(out.children?.[0]?.binding?.source).toEqual({
      from: 'collection',
      id: 'coll-uuid',
      limit: 6,
    });
    expect(out.children?.[1]?.binding?.id).toBe('prod-uuid');
  });

  it('leaves `all` sources and unknown handles untouched, and never mutates the input', () => {
    const tree: BuilderNode = {
      id: 'root',
      type: 'Section',
      props: {},
      binding: { source: { from: 'all', limit: 24 } },
      children: [
        {
          id: 'c',
          type: 'Section',
          props: {},
          binding: { source: { from: 'category', id: 'not-installed' } },
        },
      ],
    };
    const out = resolveBindingHandles(tree, fakeResult({ categories: { other: 'x' } }));
    expect(out.binding?.source).toEqual({ from: 'all', limit: 24 });
    expect(out.children?.[0]?.binding?.source).toEqual({ from: 'category', id: 'not-installed' });
    // input untouched (fresh tree returned)
    expect(out).not.toBe(tree);
  });
});
