// Undo correctness is the load-bearing piece of Phase 5 (docs/builder/05 §5: a
// history that misses a mutation or desyncs causes "lost work"). These lock the
// pure reducers: seed → push → undo/redo navigation, redo-tail truncation, the
// bounded trim, and the boundary no-ops.

import { describe, expect, it } from 'vitest';
import {
  backHistory,
  canRedo,
  canUndo,
  emptyHistory,
  forwardHistory,
  pushHistory,
  seedHistory,
} from './editor-history';

describe('seedHistory', () => {
  it('starts with one entry, nothing to undo or redo', () => {
    const h = seedHistory('a');
    expect(h).toEqual({ stack: ['a'], index: 0 });
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
  });
});

describe('pushHistory', () => {
  it('appends a new present and enables undo', () => {
    const h = pushHistory(seedHistory('a'), 'b');
    expect(h).toEqual({ stack: ['a', 'b'], index: 1 });
    expect(canUndo(h)).toBe(true);
    expect(canRedo(h)).toBe(false);
  });

  it('seeds from an empty history (push before seed)', () => {
    const h = pushHistory(emptyHistory<string>(), 'a');
    expect(h).toEqual({ stack: ['a'], index: 0 });
  });

  it('drops the redo tail when pushing after an undo', () => {
    let h = seedHistory('a');
    h = pushHistory(h, 'b');
    h = pushHistory(h, 'c');
    h = backHistory(h).state; // now at 'b', with 'c' in the redo tail
    h = pushHistory(h, 'd'); // branching off 'b' discards 'c'
    expect(h.stack).toEqual(['a', 'b', 'd']);
    expect(h.index).toBe(2);
    expect(canRedo(h)).toBe(false);
  });

  it('trims the oldest entry past the limit, keeping the present last', () => {
    let h = seedHistory(0);
    for (let i = 1; i <= 5; i += 1) h = pushHistory(h, i, 3);
    expect(h.stack).toEqual([3, 4, 5]);
    expect(h.index).toBe(2);
  });
});

describe('backHistory / forwardHistory', () => {
  it('undo returns the prior snapshot and moves the index', () => {
    let h = pushHistory(seedHistory('a'), 'b');
    const back = backHistory(h);
    expect(back.snapshot).toBe('a');
    expect(back.state.index).toBe(0);
    h = back.state;
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(true);
  });

  it('redo returns the next snapshot and moves the index', () => {
    let h = pushHistory(seedHistory('a'), 'b');
    h = backHistory(h).state;
    const fwd = forwardHistory(h);
    expect(fwd.snapshot).toBe('b');
    expect(fwd.state.index).toBe(1);
  });

  it('undo at the oldest is a null no-op', () => {
    const h = seedHistory('a');
    const back = backHistory(h);
    expect(back.snapshot).toBeNull();
    expect(back.state).toBe(h);
  });

  it('redo at the newest is a null no-op', () => {
    const h = pushHistory(seedHistory('a'), 'b');
    const fwd = forwardHistory(h);
    expect(fwd.snapshot).toBeNull();
    expect(fwd.state).toBe(h);
  });

  it('round-trips a multi-step edit history', () => {
    let h = seedHistory('s0');
    h = pushHistory(h, 's1');
    h = pushHistory(h, 's2');
    // undo, undo → back at s0
    const u1 = backHistory(h);
    expect(u1.snapshot).toBe('s1');
    const u2 = backHistory(u1.state);
    expect(u2.snapshot).toBe('s0');
    // redo → s1 again
    const r1 = forwardHistory(u2.state);
    expect(r1.snapshot).toBe('s1');
  });
});
