'use client';

// Is this builder narrow enough that its bar has to fold?
//
// A viewport query is the wrong instrument, for the same reason the console's list
// toolbars do not use one: the same 500px bar happens on a phone AND in a pane
// docked beside a second builder on a 27" monitor. Only the PANE's width answers
// it.
//
// WHY THIS IS SAFE FROM THE OSCILLATION TRAP. Measuring an element and then
// changing what is inside it is how a responsive toolbar starts flickering: fold
// because it overflows, and now it fits, so unfold, so it overflows. This is
// immune because the element it measures is the builder ROOT — a `h-full` child of
// the pane, whose width is set by the pane and cannot be changed by anything the
// bar does.
//
// A FIXED THRESHOLD, not a measurement of the controls. The list toolbars measure
// because a list's inventory is unknowable — a surface hands them any number of
// filters. A builder's is not: this package owns every control on the bar, and the
// app adds a known handful, so the width the bar needs can simply be worked out
// once. Worked out, the widest of the three (a page: three device buttons, the
// light/dark pair, undo, redo, Preview, History, Save as piece, Save, Publish) asks
// for about 771px. Hence the number below, with room over it rather than under.
//
// The two controls on the bar whose width is not ours — the theme picker, which
// wears a theme's NAME, and the piece namer, which is a text field — are capped at
// their call sites so that arithmetic keeps holding.

import { useEffect, useState, type RefObject } from 'react';

/** Below this pane width the builder bar cannot hold its chrome and stay one row. */
export const BUILDER_COLLAPSE_PX = 800;

/**
 * True once the builder has been measured and is under `threshold`.
 *
 * Starts false, so the first paint — which has no measurement — shows the full bar
 * rather than flashing a folded one onto every wide pane.
 */
export function useBuilderFit(
  ref: RefObject<HTMLElement | null>,
  threshold: number = BUILDER_COLLAPSE_PX
): boolean {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (typeof width === 'number' && width > 0) setCollapsed(width < threshold);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [ref, threshold]);

  return collapsed;
}
