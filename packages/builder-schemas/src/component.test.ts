// Tenant-component expansion + validation tests (docs/53), focused on the gap
// work: exact-version expansion, propSpec→zod coercion, binding-slot
// substitution, nesting (recursive expand + cycle/depth checks), and the
// bulk-upgrade re-pin. These are the pure pieces the editor + publish both rely
// on, so a bug here would either mis-render the preview or ship a broken tree.

import { describe, expect, it } from 'vitest';
import { DEFAULT_BOX, type BuilderNode } from './node';
import {
  checkNestingGraph,
  coerceInstanceProps,
  collectBindingSlots,
  customType,
  expandComponentTree,
  expandCustomNodes,
  makeBindSlotPath,
  propSpecToZod,
  readComponentRef,
  repinComponentRefs,
  REF_KEY,
  type PropSpec,
  type ResolvedComponentVersion,
} from './component';

function node(extra: Partial<BuilderNode> & Pick<BuilderNode, 'id' | 'type'>): BuilderNode {
  return { box: { ...DEFAULT_BOX }, props: {}, ...extra };
}

describe('propSpecToZod / coerceInstanceProps', () => {
  const spec: PropSpec[] = [
    { key: 'count', label: 'Count', kind: 'number' },
    { key: 'on', label: 'On', kind: 'boolean' },
    { key: 'title', label: 'Title', kind: 'text' },
  ];

  it('coerces declared values to their kind', () => {
    const out = coerceInstanceProps(spec, { count: '3', on: 'true', title: 'Hi' });
    expect(out.count).toBe(3);
    expect(out.on).toBe(true);
    expect(out.title).toBe('Hi');
  });

  it('drops a value that cannot validate, keeping the rest', () => {
    const out = coerceInstanceProps(spec, { count: 'not-a-number', title: 'Hi' });
    expect('count' in out).toBe(false);
    expect(out.title).toBe('Hi');
  });

  it('"false" string coerces to boolean false (no truthy footgun)', () => {
    const out = coerceInstanceProps(spec, { on: 'false' });
    expect(out.on).toBe(false);
  });

  it('propSpecToZod builds an object with every slot optional', () => {
    const schema = propSpecToZod(spec);
    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({ count: 5, on: false, title: 'x' }).success).toBe(true);
  });
});

describe('expandComponentTree', () => {
  const propSpec: PropSpec[] = [
    { key: 'headline', label: 'Headline', kind: 'text', default: 'Default' },
  ];

  it('fills a prop slot from the instance value', () => {
    const tree = node({ id: 'h', type: 'Heading', props: { text: { $prop: 'headline' } } });
    const out = expandComponentTree(tree, { headline: 'Hello' }, propSpec, 'p1');
    expect(out.props.text).toBe('Hello');
    expect(out.id).toBe('p1~h');
  });

  it('falls back to the propSpec default when the slot is empty', () => {
    const tree = node({ id: 'h', type: 'Heading', props: { text: { $prop: 'headline' } } });
    const out = expandComponentTree(tree, {}, propSpec, 'p1');
    expect(out.props.text).toBe('Default');
  });

  it('substitutes a $bind slot with the instance binding override', () => {
    const tree = node({
      id: 'list',
      type: 'Section',
      binding: { path: makeBindSlotPath('items') },
    });
    const out = expandComponentTree(tree, {}, [], 'p1', { items: 'commerce.products' });
    expect(out.binding).toEqual({ path: 'commerce.products' });
  });

  it('drops the binding when a $bind slot has no override', () => {
    const tree = node({
      id: 'list',
      type: 'Section',
      binding: { path: makeBindSlotPath('items') },
    });
    const out = expandComponentTree(tree, {}, [], 'p1', {});
    expect(out.binding).toBeUndefined();
  });
});

describe('expandCustomNodes (nesting)', () => {
  // inner → a leaf component; outer → references inner.
  const inner: ResolvedComponentVersion = {
    tree: node({ id: 'in', type: 'Heading', props: { text: 'inner' } }),
    propSpec: [],
  };
  const outer: ResolvedComponentVersion = {
    tree: node({
      id: 'out',
      type: 'Section',
      children: [
        node({ id: 'ref', type: customType('inner'), props: { [REF_KEY]: { version: 1 } } }),
      ],
    }),
    propSpec: [],
  };
  const resolve = (key: string): ResolvedComponentVersion | null =>
    key === 'inner' ? inner : key === 'outer' ? outer : null;

  it('recursively expands a component nested inside another', () => {
    const page = node({
      id: 'root',
      type: 'Section',
      children: [
        node({ id: 'place', type: customType('outer'), props: { [REF_KEY]: { version: 1 } } }),
      ],
    });
    const out = expandCustomNodes(page, resolve);
    // No custom:* type survives anywhere.
    const types: string[] = [];
    const walk = (n: BuilderNode) => {
      types.push(n.type);
      (n.children ?? []).forEach(walk);
    };
    walk(out);
    expect(types.some((t) => t.startsWith('custom:'))).toBe(false);
    expect(types).toContain('Heading');
  });

  it('drops an unresolved placement rather than leaving a custom node', () => {
    const page = node({
      id: 'root',
      type: 'Section',
      children: [
        node({ id: 'place', type: customType('gone'), props: { [REF_KEY]: { version: 1 } } }),
      ],
    });
    const out = expandCustomNodes(page, resolve);
    expect(out.children).toEqual([]);
  });
});

describe('checkNestingGraph', () => {
  it('accepts an acyclic shallow reference', () => {
    const graph = new Map<string, string[]>([['b', []]]);
    expect(checkNestingGraph('a', ['b'], graph)).toEqual([]);
  });

  it('rejects a direct self-reference', () => {
    const graph = new Map<string, string[]>();
    expect(checkNestingGraph('a', ['a'], graph).length).toBeGreaterThan(0);
  });

  it('rejects a transitive cycle (a→b→a)', () => {
    const graph = new Map<string, string[]>([['b', ['a']]]);
    expect(checkNestingGraph('a', ['b'], graph).length).toBeGreaterThan(0);
  });

  it('rejects nesting deeper than the limit', () => {
    // a→b→c→d→e→f→g is 6 edges below `a`, past MAX (5).
    const graph = new Map<string, string[]>([
      ['b', ['c']],
      ['c', ['d']],
      ['d', ['e']],
      ['e', ['f']],
      ['f', ['g']],
      ['g', []],
    ]);
    expect(checkNestingGraph('a', ['b'], graph).length).toBeGreaterThan(0);
  });
});

describe('repinComponentRefs', () => {
  it('re-pins every matching placement and reports a change', () => {
    const tree = node({
      id: 'root',
      type: 'Section',
      children: [
        node({ id: 'p1', type: customType('cta'), props: { [REF_KEY]: { version: 1 } } }),
        node({
          id: 'p2',
          type: customType('cta'),
          props: { [REF_KEY]: { version: 1 }, headline: 'x' },
        }),
      ],
    });
    const { tree: out, changed } = repinComponentRefs(tree, 'cta', 3);
    expect(changed).toBe(true);
    expect(readComponentRef(out.children![0]!.props)?.version).toBe(3);
    // Instance props are preserved across the re-pin.
    expect(out.children![1]!.props.headline).toBe('x');
  });

  it('is a no-op (changed=false) when already on the target version', () => {
    const tree = node({
      id: 'root',
      type: 'Section',
      children: [node({ id: 'p1', type: customType('cta'), props: { [REF_KEY]: { version: 2 } } })],
    });
    const { changed } = repinComponentRefs(tree, 'cta', 2);
    expect(changed).toBe(false);
  });
});

describe('collectBindingSlots', () => {
  it('derives distinct slots from $bind paths, labelled by node name', () => {
    const tree = node({
      id: 'root',
      type: 'Section',
      children: [
        node({
          id: 'a',
          type: 'Section',
          box: { ...DEFAULT_BOX, name: 'Product list' },
          binding: { path: makeBindSlotPath('items') },
        }),
        node({ id: 'b', type: 'Section', binding: { path: makeBindSlotPath('items') } }),
      ],
    });
    const slots = collectBindingSlots(tree);
    expect(slots).toEqual([{ key: 'items', label: 'Product list' }]);
  });
});
