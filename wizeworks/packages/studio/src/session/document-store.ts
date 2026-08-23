// One open document: its live state, its history, its selection, its subscribers.
//
// This is the thing a pane binds to. Panes do not hold documents — they hold a
// reference to the store, so the theme pane and the page pane looking at the same
// theme are looking at ONE object, and a token edit repaints both without a round
// trip through a server or a socket.
//
// `dirty` is counted, not diffed. A mark advances on each applied batch and
// retreats on undo, so undoing back to the last save reports clean — which a
// structural comparison would also get right, at the cost of walking the whole
// tree on every keystroke.

import type { DocumentRef, StudioDoc } from '../documents/types';
import { refOf } from '../documents/types';
import { applyOp } from '../ops/apply';
import type { StudioOp } from '../ops/types';
import { History } from './history';

export interface DocSnapshot<D extends StudioDoc = StudioDoc> {
  doc: D;
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  /** Ids the author has selected in THIS document, primary first. */
  selection: readonly string[];
}

export type StoreListener = () => void;

export class DocumentStore<D extends StudioDoc = StudioDoc> {
  private doc: D;
  private readonly history = new History();
  private readonly listeners = new Set<StoreListener>();
  private selection: string[] = [];
  private mark = 0;
  private savedMark = 0;
  private coalesceKey: string | undefined;
  private snapshot: DocSnapshot<D>;

  constructor(doc: D) {
    this.doc = doc;
    this.snapshot = this.build();
  }

  get ref(): DocumentRef {
    return refOf(this.doc);
  }

  get current(): D {
    return this.doc;
  }

  get dirty(): boolean {
    return this.mark !== this.savedMark;
  }

  /** For `useSyncExternalStore` — the same object until something actually changes. */
  getSnapshot = (): DocSnapshot<D> => this.snapshot;

  subscribe = (listener: StoreListener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /**
   * Apply one authored action.
   *
   * All-or-nothing: if any op in the batch is refused the document is left
   * exactly as it was. A partially applied batch has no inverse that restores it,
   * so accepting one would corrupt undo for every action after it.
   *
   * Returns false when the batch was refused, so a caller can say so rather than
   * leaving the author staring at a canvas that did not move.
   *
   * `coalesce` folds a CONTINUOUS action into one undo step. Repeat the same key
   * — one per control, e.g. `theme.setToken:light:--color-primary` — and the
   * previous batch is undone before these ops are applied, so what lands on the
   * stack still describes a single step from where the drag began. Without it a
   * color drag would push a batch per frame and push real work off the 200-deep
   * stack; with a key per control, moving to a DIFFERENT one starts a new step.
   */
  apply(label: string, ops: StudioOp[], coalesce?: string): boolean {
    if (!ops.length) return false;

    const top = this.history.peekUndo();
    const folding = top !== undefined && coalesce !== undefined && coalesce === this.coalesceKey;

    let next = folding && top ? this.run(top.inverse) : this.doc;
    if (!next) return false;

    const inverse: StudioOp[] = [];
    for (const op of ops) {
      const result = applyOp(next, op);
      if (!result) return false;
      next = result.doc;
      // Reversed as it is built: replaying the inverse start to finish must undo
      // the batch back to front.
      inverse.unshift(result.inverse);
    }

    this.doc = next as D;
    if (folding) this.history.replaceTop({ label, ops, inverse });
    else {
      this.history.record({ label, ops, inverse });
      this.mark += 1;
    }
    this.coalesceKey = coalesce;
    this.emit();
    return true;
  }

  undo(): boolean {
    const batch = this.history.popUndo();
    if (!batch) return false;
    const next = this.run(batch.inverse);
    if (!next) {
      // Put it back — a stack that silently drops what it could not apply leaves
      // redo describing a lineage the document never had.
      this.history.pushUndo(batch);
      return false;
    }
    this.doc = next as D;
    this.history.pushRedo(batch);
    this.mark -= 1;
    this.coalesceKey = undefined;
    this.emit();
    return true;
  }

  redo(): boolean {
    const batch = this.history.popRedo();
    if (!batch) return false;
    const next = this.run(batch.ops);
    if (!next) {
      this.history.pushRedo(batch);
      return false;
    }
    this.doc = next as D;
    this.history.pushUndo(batch);
    this.mark += 1;
    this.coalesceKey = undefined;
    this.emit();
    return true;
  }

  /** Apply a whole list against a scratch document, or nothing at all. */
  private run(ops: readonly StudioOp[], from: StudioDoc = this.doc): StudioDoc | undefined {
    let next: StudioDoc = from;
    for (const op of ops) {
      const result = applyOp(next, op);
      if (!result) return undefined;
      next = result.doc;
    }
    return next;
  }

  /** The server accepted this draft. `rev` is the revision it wrote. */
  markSaved(rev: number, publishedAt?: string | null, unpublished = true): void {
    this.doc = {
      ...this.doc,
      rev,
      ...(publishedAt !== undefined ? { publishedAt } : {}),
      unpublished,
    };
    this.savedMark = this.mark;
    this.coalesceKey = undefined;
    this.emit();
  }

  /** The server published this draft. */
  markPublished(publishedAt: string): void {
    this.doc = { ...this.doc, publishedAt, unpublished: false };
    this.emit();
  }

  /**
   * Replace the document wholesale — a reload, or a restore from history.
   * Clears undo: the stacks describe a lineage this document no longer has.
   */
  reset(doc: D): void {
    this.doc = doc;
    this.history.clear();
    this.selection = [];
    this.mark = 0;
    this.savedMark = 0;
    this.coalesceKey = undefined;
    this.emit();
  }

  select(ids: readonly string[]): void {
    const next = [...ids];
    if (next.length === this.selection.length && next.every((id, i) => id === this.selection[i])) {
      return;
    }
    this.selection = next;
    this.emit();
  }

  get selectedIds(): readonly string[] {
    return this.selection;
  }

  get undoLabel(): string | undefined {
    return this.history.undoLabel;
  }

  private build(): DocSnapshot<D> {
    return {
      doc: this.doc,
      dirty: this.dirty,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      selection: this.selection,
    };
  }

  private emit(): void {
    this.snapshot = this.build();
    for (const listener of this.listeners) listener();
  }
}
