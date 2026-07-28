import { describe, expect, it } from 'vitest';

import { resolveBindingHandles, type InstallResult } from './blueprint-installer';
import { encodeBindingRef, type SilicaNode } from '@sparx/builder-schemas';

/** A minimal InstallResult carrying just the handle→id maps the rewrite reads. */
function fakeResult(over: Partial<InstallResult> = {}): InstallResult {
  return {
    assets: {},
    categories: {},
    collections: {},
    products: [],
    theme: null,
    pages: [],
    emails: [],
    sequences: [],
    content: [],
    counts: {},
    ...over,
  };
}

/** Read a node's `data.ref` through the record shape — `data` is not declared on
 *  every member of the silica `Node` union. */
const refOf = (n: SilicaNode | string | undefined): string | undefined => {
  if (typeof n !== 'object' || n === null) return undefined;
  const data = (n as unknown as Record<string, unknown>).data as { ref?: unknown } | undefined;
  return typeof data?.ref === 'string' ? data.ref : undefined;
};

const kids = (n: SilicaNode): (SilicaNode | string)[] =>
  ((n as unknown as Record<string, unknown>).children as (SilicaNode | string)[]) ?? [];

const el = (id: string, extra: Record<string, unknown> = {}): SilicaNode =>
  ({ id, kind: 'element', tag: 'div', ...extra }) as unknown as SilicaNode;

describe('resolveBindingHandles', () => {
  it('rewrites a product entity pin from handle to the created id', () => {
    const tree = el('root', {
      children: [
        el('pin', {
          data: {
            ref: encodeBindingRef({ entity: 'commerce', id: 'midnight-acai' }),
            kind: 'value',
          },
        }),
      ],
    });
    const out = resolveBindingHandles(
      tree,
      fakeResult({ products: [{ handle: 'midnight-acai', id: 'prod-uuid' }] })
    );
    expect(refOf(kids(out)[0])).toBe(encodeBindingRef({ entity: 'commerce', id: 'prod-uuid' }));
  });

  it('rewrites a CMS entity pin from entry slug to the created id', () => {
    const tree = el('root', {
      children: [
        el('pin', {
          data: { ref: encodeBindingRef({ entity: 'cms', id: 'hello-world' }), kind: 'value' },
        }),
      ],
    });
    const out = resolveBindingHandles(
      tree,
      fakeResult({ content: [{ typeKey: 'blog_post', slug: 'hello-world', id: 'entry-uuid' }] })
    );
    expect(refOf(kids(out)[0])).toBe(encodeBindingRef({ entity: 'cms', id: 'entry-uuid' }));
  });

  // Collection binds address their source by HANDLE and the storefront builds its
  // data root under those same handle keys, so the ref an author wrote is already
  // the ref that resolves — rewriting one would break it.
  it('leaves a handle-addressed collection ref alone', () => {
    const tree = el('root', {
      children: [el('grid', { data: { ref: 'commerce.category.acai-bowls', kind: 'collection' } })],
    });
    const out = resolveBindingHandles(
      tree,
      fakeResult({ categories: { 'acai-bowls': 'cat-uuid-1' } })
    );
    expect(refOf(kids(out)[0])).toBe('commerce.category.acai-bowls');
  });

  it('leaves an unresolvable pin untouched rather than blanking it', () => {
    const ref = encodeBindingRef({ entity: 'commerce', id: 'not-installed' });
    const tree = el('root', { children: [el('pin', { data: { ref, kind: 'value' } })] });
    const out = resolveBindingHandles(tree, fakeResult({ products: [{ handle: 'x', id: 'y' }] }));
    expect(refOf(kids(out)[0])).toBe(ref);
  });

  it('preserves text children and never mutates the input', () => {
    const tree = el('root', {
      children: [el('h', { children: ['Welcome'] }), 'loose text'],
    });
    const out = resolveBindingHandles(tree, fakeResult());
    expect(kids(out)[1]).toBe('loose text');
    expect(kids(kids(out)[0] as SilicaNode)[0]).toBe('Welcome');
    expect(out).not.toBe(tree);
  });
});
