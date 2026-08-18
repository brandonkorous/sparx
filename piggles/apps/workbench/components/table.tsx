'use client';

// TABLE — silica's, with the one default its scroll wrapper is missing.
//
// ── The defect ───────────────────────────────────────────────────────────────
//
// `<Table>` wraps itself in an `overflow-x: auto` div so a wide table scrolls
// instead of blowing out the pane. That div is content-height and carries no
// class of its own, so in the shape every list surface uses —
//
//   <Card className="min-h-0 flex-1 overflow-y-auto"><Table … /></Card>
//
// — the Card fills the pane and the wrapper does NOT. Two rows in a wide table
// and the horizontal scrollbar renders directly under row two, with the rest of
// the card empty below it. A scrollbar floating mid-card reads as the end of the
// content; it belongs at the foot of the surface it scrolls.
//
// ── Why `h-full`, and why it is safe to apply everywhere ─────────────────────
//
// A percentage height resolves only against a parent with a definite height.
// Inside the `flex-1` content Card that is true, so the wrapper fills the card
// and the scrollbar lands at its foot. Inside a `FormSection`, a sub-panel or a
// stacked detail column the parent is auto-height, `height: 100%` resolves to
// `auto`, and NOTHING changes. That selectivity is the point: the default is
// correct in the shape that has the bug and inert in the shape that does not, so
// no call site has to classify itself.
//
// Two consequences, both wanted:
//   • `overflow-x: auto` makes `overflow-y` compute to `auto` too, so a filled
//     wrapper becomes the vertical scroller and the Card's own `overflow-y-auto`
//     stands down — one scroller, not two fighting.
//   • `.table thead th { position: sticky; top: 0 }` resolves against the
//     nearest scrollport, which is now this wrapper. The header pins to the top
//     of the card instead of to the top of a card-sized scroller it shared.
//
// ── Why a composition and not a prop at the call sites ───────────────────────
//
// 163 surfaces render a table. Passing `wrapperClassName` at each one fixes the
// tables that exist and none of the tables anyone writes next week, which is the
// definition of a deferred fix. This is the single point of change: the default
// lives here, and if it ever needs to become something else it changes once.
//
// Workbench-only on purpose. `@piggles/ui` is not a general component library,
// and the only other app that renders a table is `web`, whose tables are
// marketing prose in auto-height sections — the shape this default is inert in.
// Nothing there would be served by the dependency.

import { forwardRef } from 'react';
import { Table as SilicaTable, type TableProps } from '@wizeworks/silicaui-react';

export type { TableProps, TableSize } from '@wizeworks/silicaui-react';

/**
 * Silica's `Table`, with the horizontal-scroll wrapper set to fill its parent.
 *
 * Identical to `@wizeworks/silicaui-react`'s in every other respect — every prop
 * passes through and `ref` still lands on the `<table>`.
 *
 * `wrapperClassName` REPLACES the default rather than merging with it, so a call
 * site that genuinely needs a different wrapper says so outright (and one that
 * wants to add to the default writes `h-full` alongside its own class). Merging
 * would be worse: class order in the attribute decides nothing in CSS, so an
 * `h-auto` appended to `h-full` would win or lose on stylesheet order.
 */
export const Table = forwardRef<HTMLTableElement, TableProps>(function Table(
  { wrapperClassName, ...rest },
  ref
) {
  return <SilicaTable ref={ref} wrapperClassName={wrapperClassName ?? 'h-full'} {...rest} />;
});
