import { describe, expect, it } from 'vitest';
import type { Node } from '@wizeworks/silicaui-html';
import { applyTreeOp } from './apply-tree';
import type { TreeOp } from './types';
import { findNode, findPlace } from '../tree/walk';
import { el } from '../testing/fixtures';

/** Apply an op, then apply the inverse it handed back. The tree must come out
 *  structurally identical — that property IS undo, so it is what every case here
 *  asserts rather than checking the shape of the inverse by hand. */
function roundTrip(root: Node, op: TreeOp): { after: Node; restored: Node } {
  const applied = applyTreeOp(root, op);
  expect(applied, `op ${op.kind} was refused`).toBeDefined();
  const undone = applyTreeOp(applied!.root, applied!.inverse);
  expect(undone, `inverse of ${op.kind} was refused`).toBeDefined();
  return { after: applied!.root, restored: undone!.root };
}

const tree = (): Node =>
  el('root', [el('a', ['first']), el('b', [el('b1', ['nested'])]), el('c', ['third'], 'section')]);

describe('structural ops', () => {
  it('inserts a node and mints an ordering key for it', () => {
    const applied = applyTreeOp(tree(), {
      kind: 'node.insert',
      parentId: 'root',
      index: 1,
      node: el('new', ['hello']),
    });
    const inserted = findNode(applied!.root, 'new');
    expect(inserted).toBeDefined();
    // Without an `ord` the node sorts correctly today and arbitrarily the moment
    // anyone else inserts beside it.
    expect(inserted?.ord).toBeTypeOf('string');
    expect(findPlace(applied!.root, 'new')?.index).toBe(1);
  });

  it('round-trips an insert', () => {
    const { after, restored } = roundTrip(tree(), {
      kind: 'node.insert',
      parentId: 'root',
      index: 0,
      node: el('new'),
    });
    expect(findNode(after, 'new')).toBeDefined();
    expect(findNode(restored, 'new')).toBeUndefined();
    expect(restored).toEqual(tree());
  });

  it('round-trips a removal back into the same slot', () => {
    const { after, restored } = roundTrip(tree(), { kind: 'node.remove', id: 'b' });
    expect(findNode(after, 'b')).toBeUndefined();
    expect(findPlace(restored, 'b')?.index).toBe(1);
    expect(findNode(restored, 'b1')).toBeDefined();
  });

  it('round-trips a move between parents', () => {
    const { after, restored } = roundTrip(tree(), {
      kind: 'node.move',
      id: 'a',
      parentId: 'b',
      index: 0,
    });
    expect(findPlace(after, 'a')?.parent?.id).toBe('b');
    expect(findPlace(restored, 'a')?.parent?.id).toBe('root');
    expect(findPlace(restored, 'a')?.index).toBe(0);
  });

  it('refuses a move into the node’s own subtree', () => {
    // The tree would stop being a tree: every walk recurses forever, and it
    // surfaces as a hung tab rather than an error.
    expect(
      applyTreeOp(tree(), { kind: 'node.move', id: 'b', parentId: 'b1', index: 0 })
    ).toBeUndefined();
  });

  it('refuses an op whose subject is gone', () => {
    expect(applyTreeOp(tree(), { kind: 'node.remove', id: 'ghost' })).toBeUndefined();
    expect(
      applyTreeOp(tree(), { kind: 'node.setClass', id: 'ghost', value: 'p-4' })
    ).toBeUndefined();
  });

  it('refuses to remove the root', () => {
    expect(applyTreeOp(tree(), { kind: 'node.remove', id: 'root' })).toBeUndefined();
  });
});

describe('field ops', () => {
  it('round-trips a class, including back to unset', () => {
    const { after, restored } = roundTrip(tree(), {
      kind: 'node.setClass',
      id: 'a',
      value: 'p-4 bg-primary',
    });
    expect(findNode(after, 'a')?.class).toBe('p-4 bg-primary');
    // Previously ABSENT, so the inverse must delete the key rather than set it to
    // an empty string — `class=""` is a different document.
    expect(findNode(restored, 'a')).not.toHaveProperty('class');
  });

  it('round-trips text', () => {
    const { after, restored } = roundTrip(tree(), {
      kind: 'node.setText',
      id: 'a',
      value: 'changed',
    });
    expect(findNode(after, 'a')?.children).toEqual(['changed']);
    expect(findNode(restored, 'a')?.children).toEqual(['first']);
  });

  it('refuses to set text on a node holding elements', () => {
    // Accepting it would delete the subtree and call it an edit.
    expect(applyTreeOp(tree(), { kind: 'node.setText', id: 'b', value: 'wipe' })).toBeUndefined();
  });

  it('round-trips a tag, and refuses one on a non-element', () => {
    const { after, restored } = roundTrip(tree(), {
      kind: 'node.setTag',
      id: 'c',
      value: 'article',
    });
    expect((findNode(after, 'c') as { tag: string }).tag).toBe('article');
    expect((findNode(restored, 'c') as { tag: string }).tag).toBe('section');

    const withComponent = el('root', [{ kind: 'component', id: 'btn', component: 'Button' }]);
    expect(
      applyTreeOp(withComponent, { kind: 'node.setTag', id: 'btn', value: 'div' })
    ).toBeUndefined();
  });

  it('round-trips a prop on a component node', () => {
    const root = el('root', [
      { kind: 'component', id: 'btn', component: 'Button', props: { size: 'md' } },
    ]);
    const { after, restored } = roundTrip(root, {
      kind: 'node.setProp',
      id: 'btn',
      key: 'size',
      value: 'lg',
    });
    expect((findNode(after, 'btn') as { props?: Record<string, unknown> }).props?.size).toBe('lg');
    expect((findNode(restored, 'btn') as { props?: Record<string, unknown> }).props?.size).toBe(
      'md'
    );
  });

  it('round-trips an attribute back to absent', () => {
    const { after, restored } = roundTrip(tree(), {
      kind: 'node.setAttr',
      id: 'a',
      key: 'aria-label',
      value: 'First',
    });
    expect((findNode(after, 'a') as { attrs?: Record<string, unknown> }).attrs).toEqual({
      'aria-label': 'First',
    });
    expect((findNode(restored, 'a') as { attrs?: Record<string, unknown> }).attrs).toEqual({});
  });

  it('refuses a prop on an element and an attribute on a component', () => {
    // Each would produce a node that typechecks and renders as neither kind.
    expect(
      applyTreeOp(tree(), { kind: 'node.setProp', id: 'a', key: 'size', value: 'lg' })
    ).toBeUndefined();
    const root = el('root', [{ kind: 'component', id: 'btn', component: 'Button' }]);
    expect(
      applyTreeOp(root, { kind: 'node.setAttr', id: 'btn', key: 'id', value: 'x' })
    ).toBeUndefined();
  });
});

describe('replacing a node with one that carries a DIFFERENT id', () => {
  // Save as piece does exactly this: the selected section is swapped for an
  // instance node standing in its place.
  const swap = (): TreeOp => ({
    kind: 'node.replace',
    id: 'a',
    node: { ...el('instance'), instanceOf: 'tenant:welcome_band' },
  });

  it('round-trips, because the inverse addresses the id now IN the tree', () => {
    // Inverted against the DEPARTED id, this batch had no applicable inverse.
    // `DocumentStore.undo` refuses one it cannot apply and pushes it back, so the
    // Undo button stayed enabled and did nothing, however many times it was
    // pressed — the author could not take back the one action that reshaped
    // their page.
    const { after, restored } = roundTrip(tree(), swap());
    expect(findNode(after, 'a')).toBeUndefined();
    expect(findNode(after, 'instance')).toBeDefined();
    expect(restored).toEqual(tree());
  });

  it('redoes after the undo, back to the instance', () => {
    const applied = applyTreeOp(tree(), swap())!;
    const undone = applyTreeOp(applied.root, applied.inverse)!;
    const again = applyTreeOp(undone.root, swap());
    expect(again).toBeDefined();
    expect(findNode(again!.root, 'instance')).toBeDefined();
  });

  it('refuses a replacement with no id at all', () => {
    // An unaddressable node renders correctly and can never be selected, dropped
    // on, or undone — the same failure the id healing on open exists to prevent.
    const idFree = { kind: 'element' as const, tag: 'div', children: [] };
    expect(applyTreeOp(tree(), { kind: 'node.replace', id: 'a', node: idFree })).toBeUndefined();
  });
});
