import { describe, expect, it } from 'vitest';
import { bindingRoot, bindingSourceKey, collectBindingPaths } from './runtime';
import {
  EMAIL_PERSONALIZED_ROOTS,
  commerceCategorySource,
  treeIsEmailPersonalized,
} from './binding';
import type { BuilderNode } from './node';

function node(type: string, over: Partial<BuilderNode> = {}): BuilderNode {
  return { id: `${type}-1`, type, props: {}, ...over };
}

describe('bindingRoot / bindingSourceKey', () => {
  it('reduces a path to its leading segment', () => {
    expect(bindingRoot('recipient.firstName')).toBe('recipient');
    expect(bindingRoot('commerce.product')).toBe('commerce');
    expect(bindingRoot('cart[0]')).toBe('cart');
    expect(bindingRoot('item.title')).toBe('item');
    expect(bindingRoot('')).toBe('');
  });

  it('keeps the second segment for two-level module sources', () => {
    expect(bindingSourceKey('commerce.product')).toBe('commerce.product');
    expect(bindingSourceKey('cms.blog_post')).toBe('cms.blog_post');
    expect(bindingSourceKey('cms.blog_post.title')).toBe('cms.blog_post');
  });

  it('returns the bare root for single-level sources and "" for scope-relative', () => {
    expect(bindingSourceKey('recipient')).toBe('recipient');
    expect(bindingSourceKey('order.totalLabel')).toBe('order');
    expect(bindingSourceKey('item.title')).toBe('');
    expect(bindingSourceKey('index')).toBe('');
  });
});

describe('commerceCategorySource', () => {
  it('builds a parameterized commerce.category.<handle> array source with product fields', () => {
    const src = commerceCategorySource('studio-goods', 'Studio Goods');
    expect(src.key).toBe('commerce.category.studio-goods');
    expect(src.label).toBe('Category: Studio Goods');
    expect(src.module).toBe('commerce');
    expect(src.cardinality).toBe('array');
    expect(src.recordType).toBe('product');
    // same shape as the whole-catalog product source — a card bound inside resolves
    // item.title / item.price / item.image / item.url.
    const keys = src.fields.map((f) => f.key);
    expect(keys).toEqual(expect.arrayContaining(['title', 'price', 'image', 'url', 'handle']));
  });

  it('keeps the source key a clean three-segment dotted path (picker + resolver agree)', () => {
    // handles are kebab-case (no dots) so `bindingSourceKey` reduces to `commerce.category`
    // and the resolver walks commerce → category → <handle> off the root.
    expect(commerceCategorySource('new-arrivals', 'New Arrivals').key).toBe(
      'commerce.category.new-arrivals'
    );
  });
});

describe('collectBindingPaths', () => {
  it('walks the tree depth-first collecting every binding path', () => {
    const tree: BuilderNode = node('Section', {
      children: [
        node('Heading', { binding: { path: 'recipient.firstName' } }),
        node('Grid', {
          binding: { path: 'commerce.product' },
          children: [node('Text', { binding: { path: 'item.priceLabel' } })],
        }),
        node('Text', { props: { text: 'static' } }), // no binding — skipped
      ],
    });
    expect(collectBindingPaths(tree)).toEqual([
      'recipient.firstName',
      'commerce.product',
      'item.priceLabel',
    ]);
  });
});

describe('treeIsEmailPersonalized', () => {
  it('is false for a static tree and a per-send (products/promotion/cms) tree', () => {
    const staticTree = node('Section', {
      children: [node('Heading', { props: { text: 'Hello' } })],
    });
    expect(treeIsEmailPersonalized(staticTree)).toBe(false);

    const perSend = node('Section', {
      binding: { path: 'commerce.product' },
      children: [
        node('Heading', { binding: { path: 'item.title' } }),
        node('Text', { binding: { path: 'cms.blog_post' } }),
      ],
    });
    expect(treeIsEmailPersonalized(perSend)).toBe(false);
  });

  it('is true when any node binds a per-recipient source', () => {
    for (const root of EMAIL_PERSONALIZED_ROOTS) {
      const tree = node('Section', {
        children: [node('Text', { binding: { path: `${root}.whatever` } })],
      });
      expect(treeIsEmailPersonalized(tree)).toBe(true);
    }
  });

  it('detects a personalized container even when the leaf reads item.*', () => {
    // A Card bound to `order` (object) scopes its children to item.* — the signal
    // is the container's `order` binding, not the leaf's `item.numberLabel`.
    const tree = node('Section', {
      children: [
        node('Card', {
          binding: { path: 'order' },
          children: [node('Text', { binding: { path: 'item.numberLabel' } })],
        }),
      ],
    });
    expect(treeIsEmailPersonalized(tree)).toBe(true);
  });
});
