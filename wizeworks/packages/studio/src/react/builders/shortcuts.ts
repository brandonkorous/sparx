'use client';

// Keyboard shortcuts for a builder pane.
//
// Scoped to the pane element, not to `window`. The workbench runs several panes
// at once and can tear one into its own window, so a document-level listener
// would let ⌘Z in the theme pane undo an edit in the page pane — which is exactly
// the cross-talk per-document history exists to prevent.
//
// Nothing fires while the author is typing. A `Delete` inside a text field is a
// character, not a block, and the two are indistinguishable by the time the event
// reaches here unless the target is checked.

import { useEffect, type RefObject } from 'react';
import { defaultMakeId, stampTree } from '@wizeworks/silicaui-html';
import type { StudioDoc, TreeDoc } from '../../documents/types';
import type { DocumentStore } from '../../session/document-store';
import { containsOutlet, findNode, findPlace, isAddressable } from '../../tree/walk';

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Can this node be removed?
 *
 * The Outlet is the one node a layout cannot lose — it is where every page goes,
 * and a layout without one renders the chrome and nothing else. So the guard is
 * on the SUBTREE, not the node: deleting the wrapper around the Outlet takes the
 * Outlet with it, and the author would not see that until the site was live.
 */
export function canRemove(doc: TreeDoc, id: string): boolean {
  const node = findNode(doc.root, id);
  if (!node || node.locked) return false;
  if (isAddressable(doc.root) && doc.root.id === id) return false;
  if (containsOutlet(node)) return false;
  return true;
}

/**
 * Undo and redo, for ANY document.
 *
 * Separate from the tree shortcuts below because a theme has no nodes to delete
 * or duplicate but has exactly the same undo stack — and a pane that can be
 * edited and not undone is worse than one that cannot be edited.
 */
export function useUndoShortcuts(
  ref: RefObject<HTMLElement | null>,
  store: DocumentStore<never> | DocumentStore<StudioDoc> | DocumentStore<TreeDoc>
): void {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (isTyping(event.target)) return;
      const mod = event.metaKey || event.ctrlKey;

      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
        return;
      }

      if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        store.redo();
      }
    };

    element.addEventListener('keydown', onKeyDown);
    return () => element.removeEventListener('keydown', onKeyDown);
  }, [ref, store]);
}

export function useBuilderShortcuts(
  ref: RefObject<HTMLElement | null>,
  store: DocumentStore<TreeDoc>
): void {
  useUndoShortcuts(ref, store);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (isTyping(event.target)) return;
      const mod = event.metaKey || event.ctrlKey;
      const doc = store.current;
      const id = store.selectedIds[0];

      if (event.key === 'Escape') {
        store.select([]);
        return;
      }

      if (!id) return;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (!canRemove(doc, id)) return;
        event.preventDefault();
        // Select the parent, not nothing: an author deleting three blocks in a row
        // should not have to re-aim between each one.
        const parent = findPlace(doc.root, id)?.parent?.id;
        if (store.apply('Delete', [{ kind: 'node.remove', id }])) {
          store.select(parent ? [parent] : []);
        }
        return;
      }

      if (mod && event.key.toLowerCase() === 'd') {
        const place = findPlace(doc.root, id);
        if (!place?.parent?.id) return;
        event.preventDefault();
        const copy = stampTree(structuredClone(place.node), defaultMakeId);
        if (!isAddressable(copy) || !copy.id) return;
        if (
          store.apply('Duplicate', [
            { kind: 'node.insert', parentId: place.parent.id, index: place.index + 1, node: copy },
          ])
        ) {
          store.select([copy.id]);
        }
      }
    };

    element.addEventListener('keydown', onKeyDown);
    return () => element.removeEventListener('keydown', onKeyDown);
  }, [ref, store]);
}
