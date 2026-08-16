// Undo and redo for ONE document.
//
// Per document, not per session, and that is not a policy choice — it falls out
// of the model. A theme, a layout and a page are three documents; ⌘Z in the theme
// pane can only mean "undo the theme edit", because the page pane's last action
// was never on the same stack to begin with.
//
// A redo entry is the batch itself rather than a re-inverted copy. Undoing a batch
// puts the document back into the state its `ops` were authored against, so
// replaying those same ops is exactly the redo — no second inversion, and no
// chance of the two drifting.

import type { OpBatch } from '../ops/types';

/** How many actions deep undo goes. Deliberately finite: the stack holds whole
 *  node subtrees in its inverses, and an unbounded one is a slow leak in a pane
 *  somebody leaves open all day. */
export const HISTORY_LIMIT = 200;

export class History {
  private undoStack: OpBatch[] = [];
  private redoStack: OpBatch[] = [];

  constructor(private readonly limit: number = HISTORY_LIMIT) {}

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** What undo would undo, for a tooltip or a menu label. */
  get undoLabel(): string | undefined {
    return this.undoStack.at(-1)?.label;
  }

  get redoLabel(): string | undefined {
    return this.redoStack.at(-1)?.label;
  }

  /** A new authored action. Clears redo — the branch it described no longer exists. */
  record(batch: OpBatch): void {
    this.undoStack.push(batch);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  /** Take the next batch to undo. The caller applies its `inverse`, then calls
   *  `pushRedo` with the same batch. */
  popUndo(): OpBatch | undefined {
    return this.undoStack.pop();
  }

  pushRedo(batch: OpBatch): void {
    this.redoStack.push(batch);
  }

  /** Take the next batch to redo. The caller re-applies its `ops`, then calls
   *  `pushUndo` with the same batch. */
  popRedo(): OpBatch | undefined {
    return this.redoStack.pop();
  }

  pushUndo(batch: OpBatch): void {
    this.undoStack.push(batch);
  }

  /**
   * Drop everything. For a forced resync — the stacks describe a lineage the
   * document no longer has, and replaying them would apply edits to nodes that
   * moved or went away under a different author's write.
   */
  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
