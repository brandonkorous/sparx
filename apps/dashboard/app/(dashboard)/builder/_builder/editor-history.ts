'use client';

// The editor's undo/redo engine (docs/builder/05 §2.1) — a bounded, linear
// snapshot history that BOTH editor brains (use-builder-editor's single tree and
// use-studio-editor's two zones) layer over their existing tree-op + autosave
// flow. It is deliberately generic over the snapshot type `S`: a single-tree
// editor stores `{ tree, selection }`, the studio stores `{ layout, page,
// selection }` — the engine only ever stores, truncates, and replays opaque
// snapshots, so the SAME, separately-tested history covers every surface and
// can't drift between them.
//
// Model: a linear `stack` of snapshots with an `index` pointing at the PRESENT.
//   · `seed`     resets the stack to a single baseline (a new document loaded /
//                a different page switched in — undo never crosses that boundary).
//   · `push`     records a new present after a mutation, dropping any redo tail
//                and trimming the oldest when over `limit` (docs/builder/05: "last
//                ~100 states").
//   · `back`     time-travels one step toward the past, returning the snapshot to
//                restore (or null at the boundary).
//   · `forward`  the inverse.
// The pure reducers below hold the entire correctness surface (the doc's §5
// "undo correctness is the load-bearing piece"); the hook is a thin reactive
// wrapper so toolbar buttons can read canUndo/canRedo.

import * as React from 'react';

/** The default history depth — generous enough that real editing sessions never
 *  hit it, bounded so a long session can't grow memory without limit. */
export const HISTORY_LIMIT = 100;

export interface HistoryState<S> {
  /** Snapshots oldest→newest. `stack[index]` is the present. */
  stack: S[];
  /** Index of the present snapshot. -1 only before the first `seed`. */
  index: number;
}

/** A fresh, empty history (no baseline yet). */
export function emptyHistory<S>(): HistoryState<S> {
  return { stack: [], index: -1 };
}

/** Reset the history to a single baseline snapshot — the present, with nothing to
 *  undo or redo. Called when a document first loads and when the edited document
 *  identity changes (page switch), so undo can't replay across an unrelated tree. */
export function seedHistory<S>(initial: S): HistoryState<S> {
  return { stack: [initial], index: 0 };
}

/** Record `next` as the new present: drop any redo tail (everything after the
 *  present), append, and trim the oldest entries past `limit` (keeping the index
 *  on the present). A no-op-shaped call still advances — callers only push on a
 *  real mutation. */
export function pushHistory<S>(
  state: HistoryState<S>,
  next: S,
  limit = HISTORY_LIMIT
): HistoryState<S> {
  // Past + present, dropping the redo tail; then the new present.
  const kept = state.index >= 0 ? state.stack.slice(0, state.index + 1) : [];
  const stack = [...kept, next];
  // Trim from the front when over the cap; the present is always the last entry.
  const overflow = Math.max(0, stack.length - limit);
  const trimmed = overflow > 0 ? stack.slice(overflow) : stack;
  return { stack: trimmed, index: trimmed.length - 1 };
}

/** Step one snapshot toward the past. Returns the moved history plus the snapshot
 *  to RESTORE, or `{ state, snapshot: null }` when already at the oldest. */
export function backHistory<S>(state: HistoryState<S>): {
  state: HistoryState<S>;
  snapshot: S | null;
} {
  if (state.index <= 0) return { state, snapshot: null };
  const index = state.index - 1;
  return { state: { ...state, index }, snapshot: state.stack[index]! };
}

/** Step one snapshot toward the future. Returns the moved history plus the
 *  snapshot to RESTORE, or `{ state, snapshot: null }` when already at the newest. */
export function forwardHistory<S>(state: HistoryState<S>): {
  state: HistoryState<S>;
  snapshot: S | null;
} {
  if (state.index < 0 || state.index >= state.stack.length - 1) return { state, snapshot: null };
  const index = state.index + 1;
  return { state: { ...state, index }, snapshot: state.stack[index]! };
}

export function canUndo<S>(state: HistoryState<S>): boolean {
  return state.index > 0;
}
export function canRedo<S>(state: HistoryState<S>): boolean {
  return state.index >= 0 && state.index < state.stack.length - 1;
}

// ── Reactive hook ─────────────────────────────────────────────────────────────

export interface History<S> {
  /** Reset to a single baseline (document load / switch). */
  seed: (initial: S) => void;
  /** Record a new present after a mutation. */
  push: (next: S) => void;
  /** Undo — returns the snapshot to restore, or null at the boundary. */
  undo: () => S | null;
  /** Redo — returns the snapshot to restore, or null at the boundary. */
  redo: () => S | null;
  canUndo: boolean;
  canRedo: boolean;
}

/** The history hook the editor brains use. The stack lives in a ref (so `undo`/
 *  `redo` can return the restore snapshot synchronously to the caller, which then
 *  applies + autosaves it), with a render tick driving the reactive canUndo/canRedo
 *  the toolbar buttons read. */
export function useHistory<S>(limit = HISTORY_LIMIT): History<S> {
  const ref = React.useRef<HistoryState<S>>(emptyHistory<S>());
  const [, force] = React.useReducer((n: number) => n + 1, 0);

  const seed = React.useCallback((initial: S) => {
    ref.current = seedHistory(initial);
    force();
  }, []);

  const push = React.useCallback(
    (next: S) => {
      ref.current = pushHistory(ref.current, next, limit);
      force();
    },
    [limit]
  );

  const undo = React.useCallback((): S | null => {
    const { state, snapshot } = backHistory(ref.current);
    if (snapshot === null) return null;
    ref.current = state;
    force();
    return snapshot;
  }, []);

  const redo = React.useCallback((): S | null => {
    const { state, snapshot } = forwardHistory(ref.current);
    if (snapshot === null) return null;
    ref.current = state;
    force();
    return snapshot;
  }, []);

  return {
    seed,
    push,
    undo,
    redo,
    canUndo: canUndo(ref.current),
    canRedo: canRedo(ref.current),
  };
}
