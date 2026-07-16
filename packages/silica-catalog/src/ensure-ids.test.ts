// Locks the studio's id-heal (the fix for the Navigator "two children with the same key
// `a`" crash on a legacy id-less frame): every non-outlet node ends up with a UNIQUE id,
// missing/duplicate ids are repaired, and an already-stamped tree is preserved untouched.

import { describe, expect, it } from 'vitest';
import { outlet, walk, type Node } from '@wizeworks/silicaui-html';

import { ensureUniqueIds } from './ensure-ids';

function ids(root: Node): (string | undefined)[] {
  const out: (string | undefined)[] = [];
  walk(root, (n) => {
    if (n.kind !== 'outlet') out.push((n as { id?: string }).id);
  });
  return out;
}

/** A frame-like id-less tree: a nav with several anchors (the real-world shape that
 *  collides — every id-less `<a>` becomes Navigator key "a"). */
const idlessFrame: Node = {
  kind: 'element',
  tag: 'div',
  children: [
    {
      kind: 'element',
      tag: 'nav',
      children: [
        { kind: 'element', tag: 'a', children: ['Home'] },
        { kind: 'element', tag: 'a', children: ['Shop'] },
        { kind: 'element', tag: 'a', children: ['About'] },
      ],
    },
    outlet(),
  ],
} as unknown as Node;

describe('ensureUniqueIds', () => {
  it('assigns a unique id to every non-outlet node in an id-less tree', () => {
    const healed = ids(ensureUniqueIds(idlessFrame));
    expect(healed.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
    expect(new Set(healed).size).toBe(healed.length); // all unique
  });

  it('repairs a duplicate id while leaving the tree otherwise intact', () => {
    const dupe: Node = {
      kind: 'element',
      tag: 'div',
      id: 'a',
      children: [
        { kind: 'element', tag: 'a', id: 'a', children: ['One'] },
        { kind: 'element', tag: 'a', id: 'b', children: ['Two'] },
      ],
    } as unknown as Node;
    const healed = ids(ensureUniqueIds(dupe));
    expect(new Set(healed).size).toBe(3); // the collision on 'a' is broken
    expect(healed).toContain('b'); // a unique id is preserved
  });

  it('is idempotent — a fully, uniquely-stamped tree keeps its exact ids', () => {
    const stamped: Node = {
      kind: 'element',
      tag: 'div',
      id: 'root-1',
      children: [{ kind: 'element', tag: 'span', id: 'kid-1', children: ['x'] }],
    } as unknown as Node;
    expect(ids(ensureUniqueIds(stamped))).toEqual(['root-1', 'kid-1']);
  });

  it('does not mutate the input tree (returns a clone)', () => {
    const input = structuredClone(idlessFrame);
    ensureUniqueIds(input);
    expect(ids(input).every((id) => id === undefined)).toBe(true);
  });
});
