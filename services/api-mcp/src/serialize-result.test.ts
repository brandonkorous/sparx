// Regression: a tool that succeeds with no payload must still produce valid MCP content.
//
// `publish_product` (and every other thin wrapper over a `Promise<void>` service) used to
// return `{ type: 'text', text: JSON.stringify(undefined) }` — and `JSON.stringify(undefined)`
// is `undefined`, not the string "undefined". That fails the MCP SDK's own result schema, so
// the CLIENT saw a protocol error for a call that had already committed its write and
// published its event. The agent then believes the action failed and retries a completed
// mutation, which is worse than either succeeding or failing cleanly.

import { describe, expect, it } from 'vitest';

import { serializeResult } from './server';

describe('serializeResult', () => {
  it('turns a void return into an explicit success, not the invalid `undefined`', () => {
    const text = serializeResult(undefined);
    expect(typeof text).toBe('string');
    expect(JSON.parse(text)).toEqual({ ok: true });
  });

  it('passes real payloads through unchanged', () => {
    expect(JSON.parse(serializeResult({ id: 'p1', handle: 'thing' }))).toEqual({
      id: 'p1',
      handle: 'thing',
    });
    expect(JSON.parse(serializeResult([1, 2, 3]))).toEqual([1, 2, 3]);
  });

  it('keeps null distinct from void — null is a real value a tool may mean', () => {
    expect(serializeResult(null)).toBe('null');
  });
});
