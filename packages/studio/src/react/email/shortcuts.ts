'use client';

// Keyboard shortcuts for an email pane.
//
// Scoped to the pane element, not to `window` — the console runs several panes at
// once and can tear one into its own window, so a document-level listener would
// let ⌘Z here undo an edit in the page pane beside it.

import { useEffect, type RefObject } from 'react';
import { defaultMakeId } from '@wizeworks/silicaui-html';
import type { EmailDoc } from '../../documents/types';
import type { DocumentStore } from '../../session/document-store';
import { stampEmailTree } from '../../email/edit';
import { findEmailPlace } from '../../email/walk';

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function useEmailShortcuts(
  ref: RefObject<HTMLElement | null>,
  store: DocumentStore<EmailDoc>
): void {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      // A Delete inside a text field is a character, not a block, and the two are
      // indistinguishable by the time the event reaches here.
      if (isTyping(event.target)) return;
      const mod = event.metaKey || event.ctrlKey;
      const root = store.current.document.root;
      const id = store.selectedIds[0];

      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
        return;
      }

      if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        store.redo();
        return;
      }

      if (event.key === 'Escape') {
        store.select([]);
        return;
      }

      if (!id) return;
      const place = findEmailPlace(root, id);
      if (!place?.parent || place.node.locked) return;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        // Select the parent, not nothing: an author deleting three blocks in a row
        // should not have to re-aim between each one.
        const parent = place.parent.id;
        if (store.apply('Delete', [{ kind: 'email.remove', id }])) store.select([parent]);
        return;
      }

      if (mod && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        const copy = stampEmailTree(structuredClone(place.node), defaultMakeId);
        const inserted = store.apply('Duplicate', [
          {
            kind: 'email.insert',
            parentId: place.parent.id,
            index: place.index + 1,
            node: copy,
          },
        ]);
        if (inserted) store.select([copy.id]);
      }
    };

    element.addEventListener('keydown', onKeyDown);
    return () => element.removeEventListener('keydown', onKeyDown);
  }, [ref, store]);
}
