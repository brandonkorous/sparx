'use client';

// Editing the words where they are, rather than in a box beside them.
//
// A double-click on any node that holds only text drops a caret in it. That is
// the first thing anybody tries with text they can see, and until this existed
// it did nothing at all — the words could only be changed through the
// Inspector's Words field, which is correct, discoverable once you know the
// Design/Settings split, and on the far side of the screen from the sentence
// being written (issue #019).
//
// ── WHAT OWNS THE TEXT WHILE IT IS BEING TYPED ──────────────────────────────
//
// The element does. React renders the node's children as they were when editing
// began and is never handed different ones until the edit commits, so it has no
// reason to touch the text node — which is what lets the caret survive a hover,
// a selection change or a theme edit landing in another pane. The tree only
// learns about it at the end, through `node.setText`: the same op the Inspector
// applies, so undo, the dirty flag and a second pane on the same document all
// behave exactly as they do for every other edit.
//
// Committing on BLUR rather than on every keystroke is the same decision the
// Words box already made. An op per character would bury the undo stack under
// forty entries for one sentence.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClipboardEvent, FocusEvent, KeyboardEvent, MouseEvent, RefObject } from 'react';
import type { Node } from '@wizeworks/silicaui-html';
import type { StudioOp } from '../../ops/types';
import { findNode, ownText } from '../../tree/walk';
import { idOfElement, nodeElementAt } from './hit';
import { caretAt, pasteAsText, swallowsSpace, textIn, typeSpace } from './text-edit';

interface Options {
  frameRef: RefObject<HTMLDivElement | null>;
  /**
   * The canvas itself, to hand focus back to when an edit ends at the keyboard.
   *
   * Without it, finishing an edit left focus on nothing (the element stops being
   * editable, so the browser drops it to the document) and the pane's own
   * shortcuts — undo, delete, duplicate — went dead until something was clicked.
   */
  container: HTMLElement | null;
  root: Node;
  /** Whether this id belongs to the document being edited, not the chrome. */
  editable: (id: string | undefined) => boolean;
  select: (ids: string[]) => void;
  apply: (label: string, ops: StudioOp[]) => boolean;
}

export interface InlineText {
  /** The node being typed into, or null. Handed to the renderer. */
  editingId: string | null;
  /** Start on a double-click. Ignored on anything that is not plain words. */
  onDoubleClick: (event: MouseEvent<HTMLElement>) => void;
  /** Enter finishes, Escape puts the old words back. */
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  /** Clicking away finishes too — the caret leaving IS the commit. */
  onBlur: (event: FocusEvent<HTMLElement>) => void;
  /** Paste arrives as words, never as markup. */
  onPaste: (event: ClipboardEvent<HTMLElement>) => void;
}

export function useInlineText({
  frameRef,
  container,
  root,
  editable,
  select,
  apply,
}: Options): InlineText {
  const [editingId, setEditingId] = useState<string | null>(null);
  const startedWithRef = useRef('');
  const caretRef = useRef<{ x: number; y: number } | null>(null);

  const elementOf = useCallback(
    (id: string | null): HTMLElement | null =>
      id ? (frameRef.current?.querySelector<HTMLElement>(`[data-studio-editing]`) ?? null) : null,
    [frameRef]
  );

  // The caret goes in after the element has actually become editable — a frame
  // early and the browser has nowhere to put it.
  useEffect(() => {
    const element = elementOf(editingId);
    const point = caretRef.current;
    if (!element || !point) return;
    caretRef.current = null;
    caretAt(element, point.x, point.y);
  }, [editingId, elementOf]);

  /** Hand focus back to the canvas — only when the edit ended AT the keyboard.
   *  On a click elsewhere, focus belongs wherever they clicked. */
  const returnFocus = useCallback(() => {
    container?.focus({ preventScroll: true });
  }, [container]);

  const finish = useCallback(
    (keyboard = false) => {
      const element = elementOf(editingId);
      const id = editingId;
      setEditingId(null);
      if (keyboard) returnFocus();
      if (!element || !id) return;
      const value = textIn(element);
      if (value === startedWithRef.current) return;
      apply('Edit words', [{ kind: 'node.setText', id, value }]);
    },
    [apply, editingId, elementOf, returnFocus]
  );

  const cancel = useCallback(() => {
    const element = elementOf(editingId);
    // Put the words back in the DOM directly: React still believes they were
    // never changed, so it will not do it for us.
    if (element) element.textContent = startedWithRef.current;
    setEditingId(null);
    returnFocus();
  }, [editingId, elementOf, returnFocus]);

  const onDoubleClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const frame = frameRef.current;
      if (!frame) return;
      const element = nodeElementAt(event.target, frame);
      const id = idOfElement(element);
      if (!element || !id || !editable(id)) return;
      const node = findNode(root, id);
      const text = node ? ownText(node) : undefined;
      if (!node || node.locked || text === undefined) return;
      // A BOUND node draws a value from somewhere else — a product's real name,
      // the business's own email address. Typing over it would edit a fallback
      // nobody sees. Select it anyway: the Inspector says where the words come
      // from, and a double-click that does NOTHING reads as a broken editor.
      if (node.data?.kind === 'value') {
        select([id]);
        return;
      }
      startedWithRef.current = text;
      caretRef.current = { x: event.clientX, y: event.clientY };
      select([id]);
      setEditingId(id);
    },
    [editable, frameRef, root, select]
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (!editingId) return;
      if (event.key === 'Enter') {
        // A heading is one line. Enter finishing the edit is both what a
        // single-line field does and the only way to keep a `<br>` — which the
        // tree has no way to hold — out of the words.
        event.preventDefault();
        finish(true);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        cancel();
        return;
      }
      if (event.key === ' ' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        // Some controls answer the space bar by activating themselves even while
        // they are contenteditable, so the character never lands. Type it for
        // them; `swallowsSpace` says which ones need it and why (issue 264).
        const element = elementOf(editingId);
        if (!element || !swallowsSpace(element)) return;
        event.preventDefault();
        typeSpace();
      }
    },
    [cancel, editingId, elementOf, finish]
  );

  /**
   * Finish when the CARET leaves — not when anything in the pane loses focus.
   *
   * React's `onBlur` is `focusout`, which bubbles: every focus change anywhere
   * under the canvas arrives here. The pane itself takes focus during the very
   * click sequence that starts an edit, so an unguarded handler committed and
   * closed the edit in the same millisecond it opened — the caret appeared and
   * was gone before the author could type a character.
   */
  const onBlur = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      if (!editingId) return;
      if (event.target !== elementOf(editingId)) return;
      finish();
    },
    [editingId, elementOf, finish]
  );

  const onPaste = useCallback(
    (event: ClipboardEvent<HTMLElement>) => {
      if (!editingId) return;
      pasteAsText(event);
    },
    [editingId]
  );

  return { editingId, onDoubleClick, onKeyDown, onBlur, onPaste };
}
