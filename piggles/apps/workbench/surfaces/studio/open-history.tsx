'use client';

// The ways into a document's own panes, from the document.
//
// Both open BESIDE, never in place. Comparing a change with its history, or with the
// result, is the whole reason either pane exists — and one that replaced the canvas
// it describes would make that impossible in the one console built to show two
// things at once.
//
// VALUES, NOT BUTTONS. A bar cannot fold a button — relocated into the overflow
// popover these would arrive as a bare eye and a bare clock, unlabelled glyphs in a
// menu with no position to read them by and no hover to explain them.
//
// As values the BAR picks the shape: icon-only with a tooltip while there is room,
// a labelled row once there is not. `compact` claims the glyph carries the action
// alone — true of an eye and a clock, false of a floppy disk, hence never a Save.

import { faClockRotateLeft, faEye } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useDoc, type BuilderAction } from '@wizeworks/studio/react';
import type { SurfaceContext } from '../../lib/surfaces/registry';

/** Earlier versions of this document, alongside it. */
export function useHistoryAction(ctx: SurfaceContext): BuilderAction {
  const doc = useDoc();
  return {
    label: 'History',
    title: 'Earlier versions of this',
    icon: <Icon glyph={faClockRotateLeft} className="size-4" aria-hidden />,
    compact: true,
    onClick: () =>
      ctx.open('builder.history', { docKind: doc.kind, docId: doc.id }, { target: 'beside' }),
  };
}

/** The document as a visitor would see it, alongside it. */
export function usePreviewAction(ctx: SurfaceContext): BuilderAction {
  const doc = useDoc();
  return {
    label: 'Preview',
    title: 'See it as a visitor would',
    icon: <Icon glyph={faEye} className="size-4" aria-hidden />,
    compact: true,
    onClick: () =>
      ctx.open('builder.preview', { docKind: doc.kind, docId: doc.id }, { target: 'beside' }),
  };
}
