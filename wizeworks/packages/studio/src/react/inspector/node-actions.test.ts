import { describe, expect, it } from 'vitest';
import { applyTreeOp } from '../../ops/apply-tree';
import { findPlace } from '../../tree/walk';
import type { ElementNode, Node } from '@wizeworks/silicaui-html';
import { el } from '../../testing/fixtures';

/** What the Move up / Move down buttons compute, in isolation from React. */
function nudge(root: Node, id: string, delta: -1 | 1) {
  const place = findPlace(root, id);
  if (!place?.parent?.id) return undefined;
  const siblings = place.parent.children ?? [];
  const to = place.index + delta;
  if (to < 0 || to >= siblings.length) return undefined;
  return applyTreeOp(root, { kind: 'node.move', id, parentId: place.parent.id, index: to });
}

const tree = () => el('root', [el('a'), el('b'), el('c')]);

/** The ids of a node's direct children, in order — what a reorder changes. */
function ids(root: Node): string[] {
  const children = (root as ElementNode).children ?? [];
  return children.map((child) =>
    typeof child === 'string' ? child : ((child as ElementNode).id ?? '')
  );
}

describe('moving a node one step among its siblings', () => {
  // Reordering used to be drag-only: native HTML5 drag, which touch never
  // delivers, and arrow keys in Layers that move the SELECTION rather than the
  // node. On a phone the order of a page was fixed at whatever it happened to be.

  it('moves down', () => {
    const moved = nudge(tree(), 'a', 1);
    expect(ids(moved!.root)).toEqual(['b', 'a', 'c']);
  });

  it('moves up', () => {
    const moved = nudge(tree(), 'c', -1);
    expect(ids(moved!.root)).toEqual(['a', 'c', 'b']);
  });

  it('refuses to walk off either end', () => {
    expect(nudge(tree(), 'a', -1)).toBeUndefined();
    expect(nudge(tree(), 'c', 1)).toBeUndefined();
  });

  it('round-trips, so one press back is one press', () => {
    const down = nudge(tree(), 'a', 1)!;
    const up = nudge(down.root, 'a', -1)!;
    expect(ids(up.root)).toEqual(['a', 'b', 'c']);
  });

  it('leaves the document root alone — it has no siblings to move among', () => {
    expect(nudge(tree(), 'root', 1)).toBeUndefined();
  });
});
