import { describe, expect, it } from 'vitest';

import { extractNodeIndex } from './silica-node-index';
import type { SilicaNode } from './site-sync';

const node = (n: Record<string, unknown>): SilicaNode => n as unknown as SilicaNode;

describe('extractNodeIndex', () => {
  it('emits EVERY node, so the type census sees the full population', () => {
    const tree = node({
      kind: 'element',
      tag: 'section',
      id: 'a',
      children: [
        node({ kind: 'element', tag: 'h1', id: 'b' }),
        node({ kind: 'component', component: 'Button', id: 'c' }),
      ],
    });
    const rows = extractNodeIndex(tree);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.type)).toEqual(['section', 'h1', 'Button']);
  });

  it('drops bare-string children rather than indexing them as nodes', () => {
    // `Child = Node | string` — text children have no id and no kind.
    const tree = node({ kind: 'element', tag: 'p', id: 'a', children: ['hello', 'world'] });
    expect(extractNodeIndex(tree)).toHaveLength(1);
  });

  it('indexes a node with NO id rather than skipping it', () => {
    // Template/block nodes carry no id but can still hold a binding, and a binding
    // is exactly what makes a node worth indexing.
    const tree = node({
      kind: 'element',
      tag: 'div',
      children: [node({ kind: 'component', component: 'Image', data: { ref: 'title' } })],
    });
    const rows = extractNodeIndex(tree);
    expect(rows).toHaveLength(2);
    expect(rows[1]?.nodeId).toBeNull();
  });

  it('records the symbol a node instantiates', () => {
    const tree = node({
      kind: 'element',
      tag: 'div',
      id: 'a',
      children: [node({ kind: 'element', tag: 'div', id: 'b', instanceOf: 'sym-hero' })],
    });
    expect(extractNodeIndex(tree)[1]?.symbolId).toBe('sym-hero');
  });

  it('does NOT recurse into a symbol instance', () => {
    // An instance expands to a clone of the master at render. Recursing would count
    // the master's nodes once per instance, so "where is this symbol used" would
    // report node counts instead of placements — and the master is already indexed
    // once as its own owner.
    const tree = node({
      kind: 'element',
      tag: 'div',
      id: 'root',
      children: [
        node({
          kind: 'element',
          tag: 'div',
          id: 'inst',
          instanceOf: 'sym-hero',
          children: [node({ kind: 'element', tag: 'h1', id: 'stale-clone' })],
        }),
      ],
    });
    const rows = extractNodeIndex(tree);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.nodeId)).toEqual(['root', 'inst']);
  });

  it('splits a PINNED record binding into entity + id', () => {
    const tree = node({
      kind: 'component',
      component: 'Card',
      id: 'a',
      data: { ref: JSON.stringify({ entity: 'commerce', id: 'prod-42' }) },
    });
    const [row] = extractNodeIndex(tree);
    expect(row?.bindingEntity).toBe('commerce');
    expect(row?.bindingId).toBe('prod-42');
  });

  it('leaves binding columns null for a scope-relative or collection ref', () => {
    // Neither names a record whose deletion this node depends on: a bare path names
    // a FIELD, a source names a SOURCE.
    const scoped = extractNodeIndex(
      node({ kind: 'element', tag: 'p', data: { ref: 'item.title' } })
    );
    expect(scoped[0]?.bindingEntity).toBeNull();

    const source = extractNodeIndex(
      node({
        kind: 'element',
        tag: 'div',
        data: { ref: JSON.stringify({ source: { from: 'commerce.product' } }) },
      })
    );
    expect(source[0]?.bindingId).toBeNull();
  });

  it('falls back to the kind when a node names no tag or component', () => {
    expect(extractNodeIndex(node({ kind: 'outlet' }))[0]?.type).toBe('outlet');
  });
});
