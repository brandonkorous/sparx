'use client';

// The last row of a list that has no pager.
//
// Two facts, one on each end: how to open a row, and how many rows there are.
// Twelve surfaces wrote this row out by hand, and three things went wrong that
// none of them could have fixed alone:
//
//   • THE COUNT WAS UNDERNEATH THE FLOATING TOOLS. Right-aligned in the pane's
//     bottom-right corner, which is where the workspace tools float. Measured on
//     the Customers list, 2026-09-30: of a 56px "38 in total", 53px was covered,
//     and it read "38 ... total". The pager solved this for itself in issue 772
//     and the answer stayed there, because a copied row has nothing to inherit
//     through. [[feedback_a_fix_leaves_its_neighbour_behind]]
//   • THE COUNT WAS 12px. `text-xs`, under the workbench's 14px caption floor,
//     beside a hint that had already been lifted OFF that floor — in the same
//     div, on the same line. [[feedback_base_font_size_16px]]
//   • THE WORDING DRIFTED. "in total", "to do", "open", and a `<p>` in one place
//     against a `<Text>` in another.
//
// The surface still chooses its own words, because the words describe ITS rows.
// It no longer chooses the layout, the ink or the corner.
//
// The Piggles console carries the same component under the same name — the two
// consoles are one product shape, and check:console-parity holds them level.

import { Text } from '@wizeworks/silicaui-react';
import { CANVAS_CORNER_CLEARANCE } from './canvas-corner';
import { RowOpenHint } from './row-open-hint';

export function ListFooter({
  shown,
  count,
  hint,
  hintClassName,
}: {
  /** Rows on screen. With none, the open hint is instructions for nothing. */
  shown: number;
  /** The one-line summary, already worded by the surface — `countLabel` writes
   *  the usual one. Null to say nothing, which is not the same as zero. */
  count: string | null;
  /** What a row IS, for the open hint. Omit for "Click to open". */
  hint?: string;
  hintClassName?: string;
}) {
  return (
    // `flex-wrap` and a column gap: the row gives way by dropping to a second
    // line rather than by squashing the count, which is the same choice the
    // pager row makes one component along.
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 px-1">
      {shown > 0 ? <RowOpenHint what={hint} className={hintClassName} /> : null}
      {count === null ? null : (
        // `shrink-0`: left shrinkable this is what gave way when the row ran out
        // of width, and a clipped number is worse than a wrapped row.
        <Text className={`shrink-0 text-sm ${CANVAS_CORNER_CLEARANCE}`}>{count}</Text>
      )}
    </div>
  );
}
