'use client';

// Turn the thing you have selected into a saved piece.
//
// The design does not move — it stays exactly where it is and becomes an INSTANCE
// of a new master. So the page looks identical afterwards, and from then on editing
// the master changes it here and anywhere else it is placed.
//
// One step, not two. Making an author save a piece and then go and place it back
// where they were standing is the kind of round trip that means nobody uses it.

import { useCallback, useState } from 'react';
import { Button, Input, useToast } from '@wizeworks/silicaui-react';
import { faBookmark } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { defaultMakeId } from '@wizeworks/silicaui-html';
import type { TreeDoc } from '@wizeworks/studio';
import { findNode, idOf } from '@wizeworks/studio';
import { useApply, useDoc, useDocSnapshot } from '@wizeworks/studio/react';
import { useCreatePiece } from '../../lib/studio/piece-data';

export function SaveAsPiece() {
  const doc = useDoc<TreeDoc>();
  const { selection } = useDocSnapshot();
  const apply = useApply();
  const createPiece = useCreatePiece();
  const toast = useToast();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const focusOnMount = useCallback((element: HTMLInputElement | null) => element?.focus(), []);

  const selectedId = selection[0];
  const node = selectedId ? findNode(doc.root, selectedId) : undefined;
  // Not the document's own root — saving a whole page as a piece and instancing it
  // into itself is a loop with no meaning. Not an existing instance either: that one
  // already follows a master. (The Outlet needs no test — it carries no id, so it can
  // never be the selection.)
  const eligible = Boolean(node && !node.instanceOf && selectedId !== idOf(doc.root));

  const run = async () => {
    const trimmed = name.trim();
    if (!node || !selectedId || !trimmed) return;
    try {
      // The master keeps the design; the instance left behind keeps its position and
      // its own classes, so nothing on the page moves.
      const piece = await createPiece.mutateAsync({ name: trimmed, root: structuredClone(node) });
      const replacement = {
        kind: 'element' as const,
        tag: 'div',
        id: defaultMakeId(),
        instanceOf: piece.id,
        ...(node.class ? { class: node.class } : {}),
      };
      const done = apply(`Save “${trimmed}” as a piece`, [
        { kind: 'node.replace', id: selectedId, node: replacement },
      ]);
      toast.add(
        done
          ? { title: `“${trimmed}” saved as a piece`, type: 'success' }
          : { title: 'That can’t be saved as a piece', type: 'error' }
      );
    } catch {
      toast.add({ title: 'The piece could not be saved', type: 'error' });
    } finally {
      setNaming(false);
      setName('');
    }
  };

  if (naming) {
    return (
      <span className="flex items-center gap-1">
        <Input
          size="sm"
          // Focus on mount via a ref, not `autoFocus`: the naming field REPLACES the
          // button that was just clicked, so the keyboard has to follow it or the
          // author is typing into nothing.
          ref={focusOnMount}
          value={name}
          placeholder="Name this piece"
          onChange={(event) => setName(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void run();
            if (event.key === 'Escape') setNaming(false);
          }}
        />
        <Button
          size="sm"
          color="primary"
          disabled={!name.trim() || createPiece.isPending}
          onClick={() => void run()}
        >
          {createPiece.isPending ? 'Saving…' : 'Save'}
        </Button>
      </span>
    );
  }

  return (
    <Button
      size="sm"
      variant="soft"
      color="primary"
      disabled={!eligible}
      title={
        eligible
          ? 'Save this as a piece you can use again'
          : 'Select something on the page to save it as a piece'
      }
      onClick={() => setNaming(true)}
    >
      <Icon glyph={faBookmark} className="size-4" aria-hidden />
      Save as piece
    </Button>
  );
}
