// The commerce composites (docs/103 Tier 1a) earn their keep ONLY through the
// binding spine — a tree that validates but lost its `repeat` / `add-to-cart` would
// look fine and sell nothing. These tests pin the spine wiring so a careless edit to
// the data-as-code trees is caught at build, not in production.

import { describe, it, expect } from 'vitest';
import { COMMERCE_CATALOG } from './commerce';
import type { BuilderNode } from '../node';
import { bindingKind } from '../node';

function find(node: BuilderNode, pred: (n: BuilderNode) => boolean): BuilderNode | undefined {
  if (pred(node)) return node;
  for (const c of node.children ?? []) {
    const hit = find(c, pred);
    if (hit) return hit;
  }
  return undefined;
}

function findWithAncestors(
  node: BuilderNode,
  pred: (n: BuilderNode) => boolean,
  trail: BuilderNode[] = []
): BuilderNode[] | undefined {
  if (pred(node)) return [...trail, node];
  for (const c of node.children ?? []) {
    const hit = findWithAncestors(c, pred, [...trail, node]);
    if (hit) return hit;
  }
  return undefined;
}

const byKey = (key: string): BuilderNode => COMMERCE_CATALOG.find((e) => e.key === key)!.tree;

const isAddToCart = (n: BuilderNode): boolean => n.binding?.action === 'add-to-cart';
const isRepeater = (n: BuilderNode): boolean => bindingKind(n.binding) === 'collection';

describe('commerce composites — spine wiring', () => {
  it('product_card binds item.* fields and ships a working add-to-cart', () => {
    const tree = byKey('product_card');
    expect(find(tree, (n) => n.binding?.path === 'item.title')).toBeTruthy();
    expect(find(tree, (n) => n.binding?.path === 'item.images')).toBeTruthy();
    expect(find(tree, (n) => n.binding?.path === 'item.price')).toBeTruthy();
    expect(find(tree, isAddToCart)).toBeTruthy();
  });

  it('product_grid repeats a card over a collection source, with add-to-cart inside the scope', () => {
    const tree = byKey('product_grid');
    const repeater = find(tree, isRepeater);
    expect(repeater?.binding?.source).toEqual({ from: 'all', limit: 6 });
    // The add-to-cart must be a DESCENDANT of the repeater, or it resolves no product.
    const trail = findWithAncestors(tree, isAddToCart);
    expect(trail?.some(isRepeater), 'add-to-cart must sit inside the repeater scope').toBe(true);
  });

  it('product_spotlight binds the product and carries a cohesive buy-box', () => {
    const tree = byKey('product_spotlight');
    expect(find(tree, (n) => n.binding?.path === 'item.title')).toBeTruthy();
    expect(find(tree, (n) => n.binding?.path === 'item.images')).toBeTruthy();
    expect(find(tree, (n) => n.type === 'BuyBox')).toBeTruthy();
  });
});
