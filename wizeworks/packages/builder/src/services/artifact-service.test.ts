import { describe, expect, it } from 'vitest';

import { canonicalJson, hashTree } from './artifact-service';

describe('canonicalJson', () => {
  it('is INSENSITIVE to object key order', () => {
    // The whole dedupe rests on this, and it is not hypothetical: Postgres JSONB does
    // NOT preserve key order. Writing `{kind, tag}` and reading it back gives `{tag,
    // kind}` — verified against the local database. Under plain JSON.stringify that
    // round trip changes the address, so every publish would store a fresh copy of
    // every unchanged page and the history would show edits that never happened.
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
  });

  it('survives the JSONB round trip that actually breaks JSON.stringify', () => {
    const authored = {
      kind: 'element',
      tag: 'section',
      children: [{ kind: 'element', tag: 'h1' }],
    };
    // What Postgres hands back — same content, keys reordered at every level.
    const fromDb = { tag: 'section', kind: 'element', children: [{ tag: 'h1', kind: 'element' }] };
    expect(JSON.stringify(authored)).not.toBe(JSON.stringify(fromDb));
    expect(hashTree(authored)).toBe(hashTree(fromDb));
  });

  it('is SENSITIVE to array order', () => {
    // Array order is document order — two children swapped is a real edit.
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });

  it('sorts keys at every depth, not just the root', () => {
    const a = { root: { z: { b: 1, a: 2 }, y: [{ d: 1, c: 2 }] } };
    const b = { root: { y: [{ c: 2, d: 1 }], z: { a: 2, b: 1 } } };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });

  it('drops undefined members so the canonical form matches what round-trips', () => {
    // `undefined` vanishes under JSON.stringify, so a tree carrying one must hash the
    // same as the tree that comes back from storage without it.
    expect(canonicalJson({ a: 1, b: undefined })).toBe(canonicalJson({ a: 1 }));
  });

  it('keeps null, which is a real value in a silica tree', () => {
    expect(canonicalJson({ a: null })).not.toBe(canonicalJson({}));
  });
});

describe('hashTree', () => {
  it('is a stable 64-char sha256 hex digest', () => {
    const hash = hashTree({ kind: 'element', tag: 'section' });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashTree({ tag: 'section', kind: 'element' })).toBe(hash);
  });

  it('changes when the content changes', () => {
    expect(hashTree({ kind: 'element', tag: 'section' })).not.toBe(
      hashTree({ kind: 'element', tag: 'div' })
    );
  });

  it('distinguishes a missing key from a null one', () => {
    // Publishing a page that DROPPED a prop must not resolve to the same artifact as
    // one that set it to null — they render differently.
    expect(hashTree({ a: 1 })).not.toBe(hashTree({ a: 1, b: null }));
  });

  it('addresses a manifest, so two identical publishes share a release hash', () => {
    const manifest = [
      { ownerKind: 'page', ownerId: 'p1', hash: 'a'.repeat(64) },
      { ownerKind: 'symbols', ownerId: 'prop', hash: 'b'.repeat(64) },
    ];
    expect(hashTree(manifest)).toBe(hashTree(structuredClone(manifest)));
  });
});
