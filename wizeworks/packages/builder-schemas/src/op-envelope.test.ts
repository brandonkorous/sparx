import { describe, expect, it } from 'vitest';

import { BuilderOpEnvelope, BuilderOpTarget, SiteSyncInput } from './site-sync';

// The op envelope is the ONLY part of an op the server validates (docs/126 §2). It must
// accept any op the engine emits — pinning just `target` + `kind` and passing the rest
// through opaquely — so a new op kind never needs a server schema change.
describe('BuilderOpEnvelope', () => {
  it('accepts an op and PRESERVES the fields it does not validate', () => {
    const parsed = BuilderOpEnvelope.parse({
      target: { scope: 'page', id: 'p1' },
      kind: 'node.insert',
      parentId: 'n0',
      ord: 'a0',
      node: { kind: 'element', tag: 'section' },
    });
    // Opaque pass-through: the whole op survives so it can be stored verbatim.
    expect(parsed.parentId).toBe('n0');
    expect((parsed.node as { tag: string }).tag).toBe('section');
  });

  it('accepts an unknown future op kind — the server must not gate on the vocabulary', () => {
    expect(() =>
      BuilderOpEnvelope.parse({ target: { scope: 'page', id: 'p1' }, kind: 'node.someNewThing' })
    ).not.toThrow();
  });

  it('rejects an op with no target', () => {
    expect(() => BuilderOpEnvelope.parse({ kind: 'node.setText' })).toThrow();
  });

  it('rejects an op with no kind', () => {
    expect(() => BuilderOpEnvelope.parse({ target: { scope: 'frame' } })).toThrow();
  });

  it('caps op_kind at the column width so a bad payload cannot overflow the log', () => {
    expect(() =>
      BuilderOpEnvelope.parse({ target: { scope: 'site' }, kind: 'x'.repeat(33) })
    ).toThrow();
  });
});

describe('BuilderOpTarget', () => {
  it('requires an id for page and symbol scopes', () => {
    expect(() => BuilderOpTarget.parse({ scope: 'page' })).toThrow();
    expect(() => BuilderOpTarget.parse({ scope: 'symbol' })).toThrow();
    expect(BuilderOpTarget.parse({ scope: 'page', id: 'p1' })).toEqual({ scope: 'page', id: 'p1' });
  });

  it('takes NO id for the singleton frame and site scopes', () => {
    expect(BuilderOpTarget.parse({ scope: 'frame' })).toEqual({ scope: 'frame' });
    expect(BuilderOpTarget.parse({ scope: 'site' })).toEqual({ scope: 'site' });
  });
});

describe('SiteSyncInput op fields', () => {
  it('accepts a sync with ops + baseSeq + batchId', () => {
    const parsed = SiteSyncInput.parse({
      pages: [{ id: 'p1', name: 'Home', slug: '/', root: { kind: 'element', tag: 'div' } }],
      ops: [{ target: { scope: 'page', id: 'p1' }, kind: 'node.setText' }],
      baseSeq: 7,
      batchId: 'batch-123',
    });
    expect(parsed.ops).toHaveLength(1);
    expect(parsed.baseSeq).toBe(7);
  });

  it('still accepts a sync with NO ops — the MCP / blueprint path is unchanged', () => {
    const parsed = SiteSyncInput.parse({
      pages: [{ id: 'p1', name: 'Home', slug: '/', root: { kind: 'element', tag: 'div' } }],
    });
    expect(parsed.ops == null).toBe(true);
    expect(parsed.baseSeq == null).toBe(true);
  });

  it('rejects a negative baseSeq', () => {
    expect(() =>
      SiteSyncInput.parse({
        pages: [{ id: 'p1', name: 'Home', slug: '/', root: { kind: 'element', tag: 'div' } }],
        baseSeq: -1,
      })
    ).toThrow();
  });
});
