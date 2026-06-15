'use client';

// The undo/redo toolbar control (docs/builder/05 §2.1) — the pointer counterpart
// to ⌘Z / ⌘⇧Z, shown in every Builder toolbar. Disabled at the ends of the
// history so the buttons honestly reflect what's available.

import { Redo2, Undo2 } from 'lucide-react';

export function UndoRedoButtons({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}) {
  return (
    <div className="bx-undoredo" role="group" aria-label="History">
      <button
        type="button"
        className="bx-undoredo__btn"
        aria-label="Undo"
        title="Undo"
        disabled={!canUndo}
        onClick={onUndo}
      >
        <Undo2 aria-hidden />
      </button>
      <button
        type="button"
        className="bx-undoredo__btn"
        aria-label="Redo"
        title="Redo"
        disabled={!canRedo}
        onClick={onRedo}
      >
        <Redo2 aria-hidden />
      </button>
    </div>
  );
}
