// The tri-state is the whole feature, so it is tested as one: the two empty-looking
// states must never collapse into each other, and a dangling id must never quietly
// become the default.

import { describe, expect, it } from 'vitest';

import {
  FRAME_NONE,
  frameMissingMessage,
  resolvePageFrame,
  storedFrameId,
  type PageFrameChoice,
} from './page-frame';

const LAYOUTS = new Set(['a1b2c3d4-0000-4000-8000-000000000001']);
const ID = 'a1b2c3d4-0000-4000-8000-000000000001';
const GONE = 'a1b2c3d4-0000-4000-8000-00000000dead';

describe('resolvePageFrame', () => {
  it('treats an absent frame id as the site default', () => {
    // Both null and undefined: the column is null, and a DTO that omits the field
    // entirely (an older publish, an MCP client that never set it) must mean the same
    // thing. If these ever diverged, every legacy page would change appearance.
    expect(resolvePageFrame(null, LAYOUTS)).toEqual({ kind: 'default' });
    expect(resolvePageFrame(undefined, LAYOUTS)).toEqual({ kind: 'default' });
  });

  it('treats the sentinel as explicitly BARE, not as the default', () => {
    // The distinction this whole type exists for. Folding 'none' into 'default' puts a
    // header back on a landing page that was built without one.
    expect(resolvePageFrame(FRAME_NONE, LAYOUTS)).toEqual({ kind: 'none' });
  });

  it('resolves a real layout id', () => {
    expect(resolvePageFrame(ID, LAYOUTS)).toEqual({ kind: 'named', frameId: ID });
  });

  it('reports a DANGLING id instead of falling back to the default', () => {
    // A deleted or renamed shell. Rendering bare is the safe answer; restoring the
    // default would put back chrome the author deliberately moved away from, and that
    // is the failure nobody notices until a customer sees it.
    expect(resolvePageFrame(GONE, LAYOUTS)).toEqual({ kind: 'missing', frameId: GONE });
  });

  it('accepts an array as well as a set', () => {
    expect(resolvePageFrame(ID, [ID])).toEqual({ kind: 'named', frameId: ID });
    expect(resolvePageFrame(ID, [])).toEqual({ kind: 'missing', frameId: ID });
  });
});

describe('storedFrameId', () => {
  it('round-trips every state', () => {
    const cases: PageFrameChoice[] = [
      { kind: 'default' },
      { kind: 'none' },
      { kind: 'named', frameId: ID },
    ];
    for (const choice of cases) {
      expect(resolvePageFrame(storedFrameId(choice), LAYOUTS)).toEqual(choice);
    }
  });

  it('PRESERVES a dangling id rather than resetting it', () => {
    // Opening page settings and pressing Save without touching the frame must not
    // silently rewrite the author's choice — the shell may be about to come back
    // (a rename in progress, a half-finished import).
    expect(storedFrameId({ kind: 'missing', frameId: GONE })).toBe(GONE);
  });

  it('stores the site default as NULL, not as the sentinel', () => {
    expect(storedFrameId({ kind: 'default' })).toBeNull();
    expect(storedFrameId({ kind: 'none' })).toBe(FRAME_NONE);
  });
});

describe('frameMissingMessage', () => {
  it('tells a non-technical owner what they will SEE', () => {
    const msg = frameMissingMessage('Spring campaign');
    expect(msg).toContain('Spring campaign');
    expect(msg).toContain('header and footer');
    // No jargon that only means something to whoever wrote the schema.
    expect(msg).not.toMatch(/frame_id|dangling|null|uuid/i);
  });
});
