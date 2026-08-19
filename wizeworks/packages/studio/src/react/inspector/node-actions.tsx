'use client';

// Move, Duplicate and Delete, for the node you have selected.
//
// Duplicate and Delete were reachable ONLY from the keyboard — ⌘D and Delete —
// which made them unreachable twice over. A phone has no Delete key, so an author on a touch
// device could add a block to their page and then never remove it; and a business
// owner on a laptop has no reason to know a shortcut nobody showed them. A
// capability with no visible control is a capability most people do not have.
//
// REORDERING was worse: drag in the Layers rail and nothing else. Native HTML5
// drag is not delivered by touch at all, and the arrow keys there move the
// selection rather than the node — so on a phone, and for anyone working from a
// keyboard, the order of a page was fixed at whatever it happened to be.
//
// In the Inspector header, beside the name of the thing they act on, because that
// is the one place on the screen that is already about the current selection.
// Per-row buttons in Layers would put them on every row to answer a question about
// one.

import { Button, Tooltip } from '@wizeworks/silicaui-react';
import { defaultMakeId, stampTree } from '@wizeworks/silicaui-html';
import type { AddressableNode } from '../../tree/walk';
import { findPlace, isAddressable } from '../../tree/walk';
import type { TreeDoc } from '../../documents/types';
import { isEditable } from '../../documents/types';
import { useDoc, useDocumentStore } from '../context';
import { canRemove } from '../builders/shortcuts';
import { StudioIcon } from '../icon';

export function NodeActions({ node }: { node: AddressableNode }) {
  const doc = useDoc<TreeDoc>();
  const store = useDocumentStore<TreeDoc>();
  const id = node.id;
  const place = id ? findPlace(doc.root, id) : undefined;

  const editable = isEditable(doc);
  const removable = Boolean(id && editable && canRemove(doc, id));
  // A copy needs somewhere to go. The document's own root has no parent, so it is
  // the one node that can be neither duplicated nor deleted.
  const duplicable = Boolean(id && editable && place?.parent?.id);

  const duplicate = () => {
    if (!id || !place?.parent?.id) return;
    const copy = stampTree(structuredClone(place.node), defaultMakeId);
    if (!isAddressable(copy) || !copy.id) return;
    const done = store.apply('Duplicate', [
      { kind: 'node.insert', parentId: place.parent.id, index: place.index + 1, node: copy },
    ]);
    if (done) store.select([copy.id]);
  };

  /** One step up or down among its siblings. `index` counts the parent's children
   *  AFTER the node is lifted out, which is why moving down adds one and up does not. */
  const nudge = (delta: -1 | 1) => {
    if (!id || !place?.parent?.id) return;
    const siblings = place.parent.children ?? [];
    const to = place.index + delta;
    if (to < 0 || to >= siblings.length) return;
    store.apply(delta < 0 ? 'Move up' : 'Move down', [
      { kind: 'node.move', id, parentId: place.parent.id, index: to },
    ]);
  };

  const siblingCount = (place?.parent?.children ?? []).length;
  const canUp = Boolean(id && editable && place?.parent?.id && place.index > 0);
  const canDown = Boolean(id && editable && place?.parent?.id && place.index < siblingCount - 1);

  const remove = () => {
    if (!id) return;
    // Select the parent, not nothing: an author clearing three blocks in a row
    // should not have to re-aim between each one.
    const parent = place?.parent?.id;
    if (store.apply('Delete', [{ kind: 'node.remove', id }])) {
      store.select(parent ? [parent] : []);
    }
  };

  return (
    <span className="flex shrink-0 items-center gap-0.5">
      <Tooltip content="Move it up">
        <Button
          size="sm"
          shape="square"
          aria-label="Move up"
          disabled={!canUp}
          onClick={() => nudge(-1)}
        >
          <StudioIcon name="arrow-up" className="inline-flex size-4" />
        </Button>
      </Tooltip>
      <Tooltip content="Move it down">
        <Button
          size="sm"
          shape="square"
          aria-label="Move down"
          disabled={!canDown}
          onClick={() => nudge(1)}
        >
          <StudioIcon name="arrow-down" className="inline-flex size-4" />
        </Button>
      </Tooltip>
      <Tooltip content="Make another one just like it">
        <Button
          size="sm"
          shape="square"
          aria-label="Duplicate"
          disabled={!duplicable}
          onClick={duplicate}
        >
          <StudioIcon name="copy" className="inline-flex size-4" />
        </Button>
      </Tooltip>
      {/* Removing something is destructive, so it says so. Undo is one press away
          and visible in the same pane, which is what makes a confirm unnecessary
          here and would not be if this were a save. */}
      <Tooltip content={removable ? 'Remove this from the page' : 'This one cannot be removed'}>
        <Button
          size="sm"
          shape="square"
          color="danger"
          variant="ghost"
          aria-label="Delete"
          disabled={!removable}
          onClick={remove}
        >
          <StudioIcon name="trash" className="inline-flex size-4" />
        </Button>
      </Tooltip>
    </span>
  );
}
