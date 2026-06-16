// Node-id minting (model.ts) is load-bearing for the whole editor: ids are React
// keys, dnd-kit sortable ids, and the data-layer-id selectors — AND they're saved
// with the tree. A from-zero counter that resets on every page load / HMR re-mints
// the SAME id (`el:nav-1-38`) and collides with nodes saved in an earlier session,
// which trips React's duplicate-key guard AND silently disables layer dragging
// (dnd-kit needs unique sortable ids). These lock the global-uniqueness guarantee.

import { describe, expect, it, vi } from 'vitest';
import type { BuilderNode } from './model';
import { makeId, cloneWithFreshIds } from './model';

function allIds(node: BuilderNode): string[] {
  return [node.id, ...(node.children ?? []).flatMap(allIds)];
}

describe('makeId', () => {
  it('mints unique ids within a session', () => {
    const ids = new Set(Array.from({ length: 2000 }, () => makeId('el:div')));
    expect(ids.size).toBe(2000);
  });

  it('does not re-mint the same id across a page reload (the persisted-id collision bug)', async () => {
    // A reload is a module reload: simulate two independent sessions with
    // resetModules + re-import. With the old from-zero counter both sessions
    // produced `el:nav-1-38`; a freshly stamped node then collided with one saved
    // earlier. The ids MUST differ across sessions.
    vi.resetModules();
    const sessionA = await import('./model');
    const firstA = sessionA.makeId('el:nav');
    vi.resetModules();
    const sessionB = await import('./model');
    const firstB = sessionB.makeId('el:nav');
    expect(firstB).not.toBe(firstA);
  });
});

describe('cloneWithFreshIds', () => {
  it('two clones of the same tree share no ids (stamping a catalog entry twice)', () => {
    const tree: BuilderNode = {
      id: 'cat_nav_1',
      type: 'el:nav',
      props: {},
      children: [{ id: 'cat_div_2', type: 'el:div', props: {} }],
    };
    const a = cloneWithFreshIds(tree);
    const b = cloneWithFreshIds(tree);
    const idsA = new Set(allIds(a));
    expect(
      allIds(b).some((id) => idsA.has(id)),
      'second clone reuses an id'
    ).toBe(false);
    expect(allIds(a), 'clone retains a source id').not.toContain('cat_nav_1');
  });
});
