// The content composites (docs/103 Tier 1b) earn their keep through the binding
// spine's record-display half — a tree that lost its `cms.<type>` repeater or its
// `item.body` Prose would validate and publish nothing useful. Pin the wiring.

import { describe, it, expect } from 'vitest';
import { CONTENT_CATALOG } from './content';
import type { BuilderNode } from '../node';

function find(node: BuilderNode, pred: (n: BuilderNode) => boolean): BuilderNode | undefined {
  if (pred(node)) return node;
  for (const c of node.children ?? []) {
    const hit = find(c, pred);
    if (hit) return hit;
  }
  return undefined;
}

const byKey = (key: string): BuilderNode => CONTENT_CATALOG.find((e) => e.key === key)!.tree;

describe('content composites — spine wiring', () => {
  it('featured_article binds the entry’s cover, title, and excerpt', () => {
    const tree = byKey('featured_article');
    expect(find(tree, (n) => n.binding?.path === 'item.featuredImage')).toBeTruthy();
    expect(find(tree, (n) => n.binding?.path === 'item.title')).toBeTruthy();
    expect(find(tree, (n) => n.binding?.path === 'item.excerpt')).toBeTruthy();
  });

  it('article_body renders the rich body through a bound Prose leaf', () => {
    const tree = byKey('article_body');
    const prose = find(tree, (n) => n.type === 'Prose');
    expect(prose?.binding?.path).toBe('item.body');
    expect(find(tree, (n) => n.binding?.path === 'item.title')).toBeTruthy();
  });

  it('post_grid repeats a card over a cms.<type> collection', () => {
    const tree = byKey('post_grid');
    const repeater = find(tree, (n) => n.binding?.path === 'cms.blog_post');
    expect(repeater, 'a container must bind the cms.blog_post array').toBeTruthy();
    // The card inside reads each post via item.*
    expect(find(repeater!, (n) => n.binding?.path === 'item.title')).toBeTruthy();
  });
});
