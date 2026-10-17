'use client';

// TABLE — silica's, with the defaults every console list needs.
//
// Sparx had no table of its own: 171 screens imported silica's `Table` directly, so
// a list-wide rule could only be written into each of them, and the next list
// written missed it. Piggles has rendered every table through one composition like
// this for months (piggles/apps/workbench/components/table.tsx). This is its twin,
// so the two consoles change together (sparx persona issue 274).
//
// Three defaults, each one for a measured defect:
//
//   • Rows stack in a narrow pane. Below a 36rem pane (a phone, or a pane beside two
//     others) each row becomes a block instead of running past the right edge, where
//     the state and the row's own button live. About 150 lists did (issue 274).
//     A table that must keep its grid says `stack={false}`, with a comment why.
//   • The scroll wrapper fills its parent (`h-full`), so in the list shape
//     `<Card className="min-h-0 flex-1 overflow-y-auto"><Table … /></Card>` a wide
//     table's scrollbar sits at the foot of the card, not under row two. Inert where
//     the parent is auto-height. `wrapperClassName` replaces it, never merges.
//   • A code stays on one line (issue 238): a monospace cell that is not a figure
//     never breaks "O-000033" at its hyphen.
//
// Workbench-only on purpose: `@wizeworks/ui` is not a general component library.

import { forwardRef } from 'react';
import { Table as SilicaTable, type TableProps } from '@wizeworks/silicaui-react';

export type { TableProps, TableSize } from '@wizeworks/silicaui-react';

/** A code in a table is one thing and stays on one line (sparx persona issue 238). */
const CODES_ON_ONE_LINE = '[&_td.font-mono:not(.tabular-nums)]:whitespace-nowrap';

/**
 * Silica's `Table`, stacked in a narrow pane, with its scroll wrapper filling its
 * parent and codes kept on one line. Every other prop passes through and `ref`
 * still lands on the `<table>`.
 */
export const Table = forwardRef<HTMLTableElement, TableProps>(function Table(
  { wrapperClassName, className, stack = true, ...rest },
  ref
) {
  return (
    <SilicaTable
      ref={ref}
      stack={stack}
      wrapperClassName={wrapperClassName ?? 'h-full'}
      className={className ? `${CODES_ON_ONE_LINE} ${className}` : CODES_ON_ONE_LINE}
      {...rest}
    />
  );
});
