import { describe, expect, it } from 'vitest';

import { canonicalEqual, mergeByKey, mergeTree, mergeValue, resolverFrom } from './merge';

// Silica element nodes — the only tree shape blueprints carry. `props` stands in
// for any merge-visible field; `children` may hold nodes OR raw text, which is the
// case the legacy BuilderNode merge never had to handle.
interface N {
  id: string;
  kind: 'element';
  tag: string;
  props: Record<string, unknown>;
  children?: (N | string)[];
}
const node = (
  id: string,
  tag: string,
  props: Record<string, unknown> = {},
  children?: (N | string)[]
): N => ({
  id,
  kind: 'element',
  tag,
  props,
  ...(children ? { children } : {}),
});
/** Element children only, for assertions that index by id. */
const kids = (n: N | undefined): N[] =>
  (n?.children ?? []).filter((c): c is N => typeof c === 'object');

describe('canonicalEqual', () => {
  it('is insensitive to key order and undefined-vs-absent', () => {
    expect(canonicalEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(canonicalEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(canonicalEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(canonicalEqual([1, 2], [2, 1])).toBe(false); // arrays are order-sensitive
    expect(canonicalEqual(null, undefined)).toBe(false);
  });
});

describe('mergeValue — scalars', () => {
  it('fast-forwards a field the tenant never touched (auto)', () => {
    const r = mergeValue('blue', 'blue', 'green'); // base==current, incoming changed
    expect(r.merged).toBe('green');
    expect(r.changed).toBe(true);
    expect(r.changes).toEqual([
      { path: '', type: 'auto', base: 'blue', mine: 'blue', theirs: 'green', taken: 'theirs' },
    ]);
  });

  it('keeps a tenant edit when upstream did not change (tenant-only, no change entry)', () => {
    const r = mergeValue('blue', 'red', 'blue'); // tenant changed, upstream same as base
    expect(r.merged).toBe('red');
    expect(r.changed).toBe(false);
    expect(r.changes).toEqual([]);
  });

  it('is a no-op when nothing moved', () => {
    const r = mergeValue('blue', 'blue', 'blue');
    expect(r.changed).toBe(false);
    expect(r.changes).toEqual([]);
  });

  it('auto-resolves when tenant and author independently reached the same value', () => {
    const r = mergeValue('blue', 'green', 'green');
    expect(r.merged).toBe('green');
    expect(r.changes).toEqual([]);
  });

  it('conflicts when both changed the same field, keeping the tenant by default (U1)', () => {
    const r = mergeValue('blue', 'red', 'green');
    expect(r.merged).toBe('red'); // mine wins by default
    expect(r.changes).toHaveLength(1);
    expect(r.changes[0]).toMatchObject({
      type: 'conflict',
      mine: 'red',
      theirs: 'green',
      taken: 'mine',
    });
  });

  it('takes theirs on a conflict when the resolution says so', () => {
    const r = mergeValue('blue', 'red', 'green', { resolve: () => 'theirs' });
    expect(r.merged).toBe('green');
    expect(r.changes[0]).toMatchObject({ type: 'conflict', taken: 'theirs' });
  });
});

describe('mergeValue — nested objects (theme presentation / brand)', () => {
  const base = { color: { primary: '#111', accent: '#222' }, radius: { lg: 8 } };

  it('fast-forwards untouched tokens while keeping the one the tenant changed', () => {
    // tenant changed accent only; author changed primary + radius.lg
    const current = { color: { primary: '#111', accent: '#ACC' }, radius: { lg: 8 } };
    const incoming = { color: { primary: '#999', accent: '#222' }, radius: { lg: 12 } };
    const r = mergeValue(base, current, incoming);
    expect(r.merged).toEqual({ color: { primary: '#999', accent: '#ACC' }, radius: { lg: 12 } });
    // color.primary fast-forwards per-leaf (tenant touched accent, so color recurses);
    // radius is untouched as a whole, so it fast-forwards as ONE change at `radius`.
    expect(r.changes.map((c) => c.path).sort()).toEqual(['color.primary', 'radius']);
    expect(r.changes.every((c) => c.type === 'auto')).toBe(true);
  });

  it('surfaces a per-token conflict when both changed the same token', () => {
    const current = { color: { primary: '#AAA', accent: '#222' }, radius: { lg: 8 } };
    const incoming = { color: { primary: '#999', accent: '#222' }, radius: { lg: 8 } };
    const r = mergeValue(base, current, incoming);
    expect(r.merged).toEqual({ color: { primary: '#AAA', accent: '#222' }, radius: { lg: 8 } });
    expect(r.changes).toHaveLength(1);
    expect(r.changes[0]).toMatchObject({ path: 'color.primary', type: 'conflict', taken: 'mine' });
  });

  it('adds a brand-new upstream token automatically (while a tenant edit elsewhere is kept)', () => {
    // tenant changed accent; author kept color and ADDED a new `space` token group.
    const current = { color: { primary: '#111', accent: '#ACC' }, radius: { lg: 8 } };
    const incoming = {
      color: { primary: '#111', accent: '#222' },
      radius: { lg: 8 },
      space: { section: 64 },
    };
    const r = mergeValue(base, current, incoming);
    expect(r.merged).toEqual({
      color: { primary: '#111', accent: '#ACC' },
      radius: { lg: 8 },
      space: { section: 64 },
    });
    expect(r.changes).toEqual([
      {
        path: 'space',
        type: 'auto',
        base: undefined,
        mine: undefined,
        theirs: { section: 64 },
        taken: 'theirs',
      },
    ]);
  });

  it('resolverFrom takes theirs only at the named paths', () => {
    const current = { color: { primary: '#AAA', accent: '#BBB' }, radius: { lg: 8 } };
    const incoming = { color: { primary: '#999', accent: '#CCC' }, radius: { lg: 8 } };
    const r = mergeValue(base, current, incoming, { resolve: resolverFrom(['color.primary']) });
    expect(r.merged).toEqual({ color: { primary: '#999', accent: '#BBB' }, radius: { lg: 8 } });
    const byPath = Object.fromEntries(r.changes.map((c) => [c.path, c.taken]));
    expect(byPath).toEqual({ 'color.primary': 'theirs', 'color.accent': 'mine' });
  });
});

describe('mergeTree — node-keyed silica-tree merge', () => {
  const base = node('root', 'section', { pad: 4 }, [
    node('a', 'h2', { text: 'Welcome' }),
    node('b', 'p', { text: 'Body' }),
  ]);

  it('applies independent edits to different nodes with no conflict', () => {
    // tenant edited node a; author edited node b
    const current = node('root', 'section', { pad: 4 }, [
      node('a', 'h2', { text: 'Howdy' }),
      node('b', 'p', { text: 'Body' }),
    ]);
    const incoming = node('root', 'section', { pad: 4 }, [
      node('a', 'h2', { text: 'Welcome' }),
      node('b', 'p', { text: 'New body' }),
    ]);
    const r = mergeTree(base, current, incoming);
    const merged = r.merged as N;
    expect(kids(merged).find((c) => c.id === 'a')?.props.text).toBe('Howdy'); // tenant kept
    expect(kids(merged).find((c) => c.id === 'b')?.props.text).toBe('New body'); // author applied
    expect(r.changes.every((c) => c.type === 'auto')).toBe(true);
  });

  it('conflicts when tenant and author edit the same node field (keeps tenant)', () => {
    const current = node('root', 'section', { pad: 4 }, [
      node('a', 'h2', { text: 'Howdy' }),
      node('b', 'p', { text: 'Body' }),
    ]);
    const incoming = node('root', 'section', { pad: 4 }, [
      node('a', 'h2', { text: 'Greetings' }),
      node('b', 'p', { text: 'Body' }),
    ]);
    const r = mergeTree(base, current, incoming);
    const merged = r.merged as N;
    expect(kids(merged).find((c) => c.id === 'a')?.props.text).toBe('Howdy'); // tenant wins
    expect(r.changes.filter((c) => c.type === 'conflict')).toHaveLength(1);
  });

  it('adds an author-added node', () => {
    const current = base;
    const incoming = node('root', 'section', { pad: 4 }, [
      node('a', 'h2', { text: 'Welcome' }),
      node('b', 'p', { text: 'Body' }),
      node('c', 'button', { label: 'Shop' }),
    ]);
    const r = mergeTree(base, current, incoming);
    const merged = r.merged as N;
    expect(kids(merged).map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(r.changes).toHaveLength(1);
    expect(r.changes[0]).toMatchObject({ type: 'auto', path: 'tree/c' });
  });

  it('removes a node the author dropped that the tenant never touched', () => {
    const current = base; // tenant untouched
    const incoming = node('root', 'section', { pad: 4 }, [node('a', 'h2', { text: 'Welcome' })]);
    const r = mergeTree(base, current, incoming);
    const merged = r.merged as N;
    expect(kids(merged).map((c) => c.id)).toEqual(['a']); // b removed
  });

  // Silica text children have no id, so they cannot be keyed. These two cover the
  // atomic fallback — the path that would silently DROP text if it were merged by
  // id, since every string child would match nothing and vanish.
  it('fast-forwards a text child the tenant never touched', () => {
    const b = node('root', 'section', {}, [node('a', 'h2', {}, ['Welcome'])]);
    const current = b;
    const incoming = node('root', 'section', {}, [node('a', 'h2', {}, ['Welcome back'])]);
    const r = mergeTree(b, current, incoming);
    const heading = kids(r.merged as N).find((c) => c.id === 'a');
    expect(heading?.children).toEqual(['Welcome back']);
  });

  it('keeps the tenant text when both sides edited it, and never loses the string', () => {
    const b = node('root', 'section', {}, [node('a', 'h2', {}, ['Welcome'])]);
    const current = node('root', 'section', {}, [node('a', 'h2', {}, ['Our shop'])]);
    const incoming = node('root', 'section', {}, [node('a', 'h2', {}, ['Welcome back'])]);
    const r = mergeTree(b, current, incoming);
    const heading = kids(r.merged as N).find((c) => c.id === 'a');
    expect(heading?.children).toEqual(['Our shop']);
    expect(r.changes.some((c) => c.type === 'conflict')).toBe(true);
  });

  it('KEEPS a node the author dropped if the tenant edited it (never lose work, U3)', () => {
    const current = node('root', 'section', { pad: 4 }, [
      node('a', 'h2', { text: 'Welcome' }),
      node('b', 'p', { text: 'My custom body' }), // tenant edited b
    ]);
    const incoming = node('root', 'section', { pad: 4 }, [node('a', 'h2', { text: 'Welcome' })]);
    const r = mergeTree(base, current, incoming);
    const merged = r.merged as N;
    expect(kids(merged).find((c) => c.id === 'b')?.props.text).toBe('My custom body'); // kept
  });
});

describe('mergeByKey — variant prices keyed by SKU', () => {
  const base = [
    { sku: 'A', priceCents: 1000 },
    { sku: 'B', priceCents: 2000 },
  ];

  it("keeps a tenant's price edit while the author's edit to another SKU applies", () => {
    const current = [
      { sku: 'A', priceCents: 1500 }, // tenant raised A
      { sku: 'B', priceCents: 2000 },
    ];
    const incoming = [
      { sku: 'A', priceCents: 1000 }, // author left A
      { sku: 'B', priceCents: 2500 }, // author raised B
    ];
    const r = mergeByKey(base, current, incoming, 'sku');
    const merged = r.merged as { sku: string; priceCents: number }[];
    expect(merged.find((v) => v.sku === 'A')?.priceCents).toBe(1500); // tenant kept
    expect(merged.find((v) => v.sku === 'B')?.priceCents).toBe(2500); // author applied
  });

  it('adds an author-added SKU and removes an author-removed untouched SKU', () => {
    const current = base;
    const incoming = [
      { sku: 'A', priceCents: 1000 },
      { sku: 'C', priceCents: 3000 }, // B dropped, C added
    ];
    const r = mergeByKey(base, current, incoming, 'sku');
    const merged = r.merged as { sku: string }[];
    expect(merged.map((v) => v.sku).sort()).toEqual(['A', 'C']);
  });
});

describe('mergeValue — atomic opt-out', () => {
  it('does not recurse into a path flagged atomic (handed off to a tree merge)', () => {
    const base = { tree: { id: 'a', n: 1 } };
    const current = { tree: { id: 'a', n: 2 } };
    const incoming = { tree: { id: 'a', n: 3 } };
    const r = mergeValue(base, current, incoming, { atomic: (p) => p === 'tree' });
    // whole `tree` is a single conflict (kept mine), not a per-field merge of `n`
    expect(r.changes).toHaveLength(1);
    expect(r.changes[0]).toMatchObject({ path: 'tree', type: 'conflict' });
    expect(r.merged).toEqual({ tree: { id: 'a', n: 2 } });
  });
});
