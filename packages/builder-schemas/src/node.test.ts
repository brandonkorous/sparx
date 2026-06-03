// Node-model schema tests — focused on the docs/47 class-first `class` field.
// The field is the keystone of the class-first authoring model: it must be
// OPTIONAL (legacy trees omit it), bounded, and — critically — survive the
// import path, since BuilderNodeSchema is a strict object that would otherwise
// strip an unknown key and silently drop authored classes on round-trip.

import { describe, expect, it } from 'vitest';
import { BuilderNodeSchema, DEFAULT_BOX } from './node';
import { parsePageImport } from './import-export';

function leaf(extra: Record<string, unknown> = {}) {
  return { id: 'n1', type: 'Heading', box: DEFAULT_BOX, props: {}, ...extra };
}

describe('BuilderNode.class', () => {
  it('is optional — a legacy node without it validates', () => {
    const parsed = BuilderNodeSchema.safeParse(leaf());
    expect(parsed.success).toBe(true);
    if (parsed.success) expect('class' in parsed.data).toBe(false);
  });

  it('preserves a class string (not stripped by the strict object)', () => {
    const parsed = BuilderNodeSchema.safeParse(leaf({ class: 'hero bg-base-100' }));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.class).toBe('hero bg-base-100');
  });

  it('rejects a class string past the length cap', () => {
    const parsed = BuilderNodeSchema.safeParse(leaf({ class: 'x'.repeat(501) }));
    expect(parsed.success).toBe(false);
  });
});

describe('class survives the import path', () => {
  it('round-trips through parsePageImport on a bare node tree', () => {
    const res = parsePageImport({
      type: 'Section',
      class: 'navbar bg-base-100 shadow-sm',
      children: [{ type: 'Heading', class: 'sf-h sf-h--1', props: { text: 'Hi' } }],
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.tree.class).toBe('navbar bg-base-100 shadow-sm');
      expect(res.tree.children?.[0]?.class).toBe('sf-h sf-h--1');
    }
  });
});
