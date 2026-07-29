'use client';

// Undo/redo that survives someone else editing (docs/126 §4.5).
//
// silica's built-in history is a whole-SITE snapshot stack: every edit pushes a clone
// of the document and undo swaps the whole thing back. Correct for one author alone,
// and unusable with company — restoring a snapshot taken before a co-editor's
// paragraph landed would delete that paragraph, on a page the person pressing Ctrl+Z
// never opened. The engine knows, so `applyRemoteOps` throws the local stack away on
// the way in. Safe, but the cost lands on the author: in sparx an agent editing
// alongside you over MCP is a designed-for workflow, so the undo history evaporates
// mid-session with nothing on screen to explain why.
//
// So the host owns the history instead, which is what `setHistoryDelegate` is for.
// An entry holds the action's ops (replay them to REDO — every op carries an absolute
// value, so re-applying IS the original edit) and their INVERSE, computed at the moment
// the action happened, while the previous document was still in hand. Undo applies the
// inverse through `applyRemoteOps`, which is targeted: it names the one node the action
// touched and leaves everything else — including work that arrived from someone else in
// between — alone. That is what lets the stack stay alive across a co-editor's edit
// rather than being discarded.
//
// THE INVERSE IS THE ENGINE'S NOW (silicaui 0.36.0, doc 139 §8). sparx used to compute
// it in `@sparx/builder-schemas/silica-op-invert`, which could not be faithful for two
// ops no host can invert from outside: `symbol.set` that CREATES (undoing it needs a
// detach cascade of ids only the engine mints) and `node.setText` (which flattens
// `children`, so the structure is not in the op — it now inverts into the new
// `node.setChildren`). `editor.inverseOf(ops, before)` handles both, so that module is
// deleted rather than extended.
//
// `inverseOf` lives on the EDITOR, which only exists inside `<Builder>` — and the
// studio records history from `onChange`, which fires outside it. So this component
// publishes the bound function upward through `invertRef`, the same way `stacksRef`
// passes the stacks downward.
//
// Mounted INSIDE `<Builder>` (via `toolbarSlot`) so `useEditor()` resolves to the live
// engine. Renders nothing.

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useEditor } from '@wizeworks/silicaui-builder/react';
import type { HistoryDelegate, Op } from '@wizeworks/silicaui-builder/react';
import type { Site } from '@wizeworks/silicaui-html';

/** One undoable action. */
export interface HistoryEntry {
  /** What the action did — replayed verbatim to redo it. */
  ops: Op[];
  /** What puts it back. */
  inverse: Op[];
}

export interface HistoryStacks {
  undo: HistoryEntry[];
  redo: HistoryEntry[];
}

/** How many actions are held. Deep enough to cover a working session, bounded so a
 *  long one can't grow the tab's memory without limit — each entry carries whole
 *  subtrees for inserts and removals. */
export const HISTORY_LIMIT = 100;

/** Compute the ops that undo `ops`, given the document as it stood before them.
 *  `null` when the batch cannot be faithfully reversed. */
export type InvertOps = (ops: readonly Op[], before: Site) => Op[] | null;

interface Props {
  /** The stacks, owned by the studio (it records; this drives). A ref, not state:
   *  silica reads `canUndo()` synchronously during its own event dispatch, so the
   *  value has to be current the instant it is asked, not after a render. */
  stacksRef: MutableRefObject<HistoryStacks>;
  /** Filled with `editor.inverseOf` on mount, so the studio — which records from
   *  `onChange`, outside `<Builder>` — can reach an API that only exists inside it. */
  invertRef: MutableRefObject<InvertOps | null>;
  /** Bumped by the studio each time it records or drops an action. */
  revision: number;
  /** The document moved: here is the result, and the ops that produced it — they
   *  still have to reach the server and the other people in the session. */
  onApplied: (site: Site, ops: Op[]) => void;
}

export function CollaborativeHistory({ stacksRef, invertRef, revision, onApplied }: Props) {
  const editor = useEditor();
  const onAppliedRef = useRef(onApplied);
  onAppliedRef.current = onApplied;

  // Published in an effect rather than during render: a ref write in a render body is
  // not safe under Strict Mode's double-invoke. The studio can only call this from a
  // user edit, which is necessarily after mount — and if it somehow ran first, the
  // studio treats a missing inverter exactly like an un-invertible batch, which is the
  // conservative answer rather than a silently wrong undo.
  useEffect(() => {
    invertRef.current = (ops, before) => editor.inverseOf(ops, before);
    return () => {
      invertRef.current = null;
    };
  }, [editor, invertRef]);

  const delegate = useMemo<HistoryDelegate>(() => {
    // The stacks are mutated BEFORE the document moves: `applyRemoteOps` emits a
    // change event, and silica re-reads `canUndo`/`canRedo` during that dispatch —
    // so the toolbar would show the previous availability if the pop happened after.
    const step = (from: 'undo' | 'redo'): void => {
      const stacks = stacksRef.current;
      const entry = stacks[from].pop();
      if (!entry) return;
      stacks[from === 'undo' ? 'redo' : 'undo'].push(entry);
      const ops = from === 'undo' ? entry.inverse : entry.ops;
      // Ops whose subject is already gone are DROPPED rather than failed — that is
      // what makes them commute under concurrent editing. If every one dropped, the
      // canvas did not move (someone else already deleted what this step addressed),
      // so there is nothing to save and marking the pane dirty would be a lie.
      const { applied } = editor.applyRemoteOps(ops);
      if (applied === 0) return;
      // `applyRemoteOps` is otherwise silent — it never comes back out of
      // `onChange`, because a remote op must not echo to its sender. That silence
      // applies to us too, so the studio is told here instead. Without it an undo
      // would move the canvas and never be saved: the operator would reload to find
      // the change they undid still there.
      onAppliedRef.current(editor.extractSite(), ops);
    };
    return {
      undo: () => step('undo'),
      redo: () => step('redo'),
      canUndo: () => stacksRef.current.undo.length > 0,
      canRedo: () => stacksRef.current.redo.length > 0,
    };
  }, [editor, stacksRef]);

  useEffect(() => {
    editor.setHistoryDelegate(delegate);
    // Handing history back on unmount restores the local snapshot stack, which is
    // the right behavior for a session with nobody else in it.
    return () => editor.setHistoryDelegate(undefined);
  }, [editor, delegate]);

  // Re-announce the delegate after the studio records an action.
  //
  // silica reads `canUndo()` during the very event that tells the host about the
  // edit, and the toolbar's listener is registered before the host's — so the button
  // could sit greyed out for one action longer than it should. Re-setting the same
  // delegate emits a `replace`, which is the engine's own way of saying "read me
  // again"; it runs in an effect, after the dispatch has unwound.
  useEffect(() => {
    if (revision > 0) editor.setHistoryDelegate(delegate);
  }, [editor, delegate, revision]);

  return null;
}
