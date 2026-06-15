// The clipboard codec is a data round-trip (docs/builder/05 §2.5): copy → paste
// must reproduce the subtree with FRESH ids (so a paste never collides with its
// source) and stay interchangeable with the Import/Export path. These lock the
// single-node bare form, the multi-node envelope, the fresh-id guarantee, and the
// reject path for junk text.

import { describe, expect, it } from 'vitest';
import { serializeClipboard, parseClipboard } from './editor-clipboard';
import type { BuilderNode } from './model';

const button: BuilderNode = {
  id: 'button-1',
  type: 'Button',
  props: { label: 'Buy now' },
  class: 'st-btn st-c-primary',
};

const card: BuilderNode = {
  id: 'card-1',
  type: 'Card',
  props: {},
  children: [{ id: 'heading-1', type: 'Heading', props: { text: 'Hi' } }],
};

function allIds(node: BuilderNode): string[] {
  return [node.id, ...(node.children ?? []).flatMap(allIds)];
}

describe('serializeClipboard', () => {
  it('serializes a single node as a bare, import-compatible tree', () => {
    const json = JSON.parse(serializeClipboard([button])) as Record<string, unknown>;
    expect(json.type).toBe('Button');
    expect(json.class).toBe('st-btn st-c-primary');
    // No envelope wrapper for the single-node case.
    expect(json.format).toBeUndefined();
  });

  it('wraps a multi-node selection in a clipboard envelope', () => {
    const json = JSON.parse(serializeClipboard([button, card])) as Record<string, unknown>;
    expect(json.type).toBe('clipboard');
    expect(Array.isArray(json.nodes)).toBe(true);
    expect((json.nodes as unknown[]).length).toBe(2);
  });

  it('is empty for an empty selection', () => {
    expect(serializeClipboard([])).toBe('');
  });
});

describe('parseClipboard', () => {
  it('round-trips a single node with fresh ids', () => {
    const out = parseClipboard(serializeClipboard([button]));
    expect(out).not.toBeNull();
    expect(out).toHaveLength(1);
    expect(out![0]!.type).toBe('Button');
    expect(out![0]!.class).toBe('st-btn st-c-primary');
    expect(out![0]!.id).not.toBe('button-1'); // regenerated
  });

  it('round-trips a multi-node selection, regenerating every id', () => {
    const out = parseClipboard(serializeClipboard([button, card]));
    expect(out).toHaveLength(2);
    const ids = out!.flatMap(allIds);
    expect(ids).not.toContain('button-1');
    expect(ids).not.toContain('card-1');
    expect(ids).not.toContain('heading-1');
    // Structure preserved (the card still has its heading child).
    expect(out![1]!.children).toHaveLength(1);
  });

  it('accepts a full exported page document as one subtree', () => {
    const doc = JSON.stringify({
      format: 'sparx.builder/v1',
      type: 'page',
      name: 'Home',
      kind: 'singleton',
      tree: card,
    });
    const out = parseClipboard(doc);
    expect(out).toHaveLength(1);
    expect(out![0]!.type).toBe('Card');
  });

  it('rejects non-JSON and non-Builder text', () => {
    expect(parseClipboard('not json')).toBeNull();
    expect(parseClipboard('{"hello":"world"}')).toBeNull();
  });
});
