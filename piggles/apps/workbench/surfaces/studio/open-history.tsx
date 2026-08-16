'use client';

// The ways into a document's own panes, from the document.
//
// Both open BESIDE, never in place. Comparing a change with its history, or with the
// result, is the whole reason either pane exists — and one that replaced the canvas
// it describes would make that impossible in the one console built to show two
// things at once.

import { Button } from '@wizeworks/silicaui-react';
import { faClockRotateLeft, faEye } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useDoc } from '@wizeworks/studio/react';
import type { SurfaceContext } from '../../lib/surfaces/registry';

export function OpenHistory({ ctx }: { ctx: SurfaceContext }) {
  const doc = useDoc();
  return (
    <Button
      size="sm"
      shape="square"
      aria-label="History"
      title="Earlier versions of this"
      onClick={() =>
        ctx.open('builder.history', { docKind: doc.kind, docId: doc.id }, { target: 'beside' })
      }
    >
      <Icon glyph={faClockRotateLeft} className="size-4" aria-hidden />
    </Button>
  );
}

export function OpenPreview({ ctx }: { ctx: SurfaceContext }) {
  const doc = useDoc();
  return (
    <Button
      size="sm"
      shape="square"
      aria-label="Preview"
      title="See it as a visitor would"
      onClick={() =>
        ctx.open('builder.preview', { docKind: doc.kind, docId: doc.id }, { target: 'beside' })
      }
    >
      <Icon glyph={faEye} className="size-4" aria-hidden />
    </Button>
  );
}
