import { describe, expect, it } from 'vitest';
import { EMAIL_CONTENT_BLOCKS } from './email-content-blocks';

/** Collect every node id in a subtree — the invariant that matters for a palette
 *  block is that ONE `make()` produces a tree with no internal id collisions (silica
 *  re-stamps on insert, but a well-formed factory shouldn't hand it dupes). */
function idsOf(node: unknown): string[] {
  if (!node || typeof node !== 'object') return [];
  const n = node as { id?: unknown; children?: unknown };
  const here = typeof n.id === 'string' ? [n.id] : [];
  const kids = Array.isArray(n.children) ? n.children.flatMap(idsOf) : [];
  return [...here, ...kids];
}

describe('EMAIL_CONTENT_BLOCKS', () => {
  it('every block is a single top-level section with a unique sx- key', () => {
    const keys = EMAIL_CONTENT_BLOCKS.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length); // no duplicate keys
    for (const item of EMAIL_CONTENT_BLOCKS) {
      expect(item.key).toMatch(/^sx-/); // never clashes with a built-in key
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.hint.length).toBeGreaterThan(0);
      const node = item.make() as { kind?: string };
      expect(node.kind).toBe('section'); // a body holds sections
    }
  });

  it('make() yields fresh, internally-unique node ids each call', () => {
    for (const item of EMAIL_CONTENT_BLOCKS) {
      const ids = idsOf(item.make());
      expect(new Set(ids).size).toBe(ids.length); // no dupes inside one block
      // Two independent inserts must not share ids (the layer-drag / React-key
      // footgun) — the factory advances the id counter on each call.
      const again = idsOf(item.make());
      expect(ids.some((id) => again.includes(id))).toBe(false);
    }
  });
});
