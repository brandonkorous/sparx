'use client';

// What fills the card: the worklist, or one of the four kinds of nothing.

import type { SurfaceContext } from '../../lib/surfaces/registry';
import { InlineWaiting } from '../../components/inline-waiting';
import type { ReorderRow } from './reorder-data';
import type { ReorderPane } from './reorder-window';
import { ReorderListTable } from './reorder-list-table';
import {
  NoReorderRules,
  NothingMatches,
  NothingNeedsReordering,
  ReorderLoadFailed,
} from './reorder-list-empty';

export function ReorderBody({
  ctx,
  pane,
  onOpen,
}: {
  ctx: SurfaceContext;
  pane: ReorderPane;
  onOpen: (row: ReorderRow, event: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  const { rows, selection, query, w } = pane;
  if (query.isError) return <ReorderLoadFailed />;
  if (query.isLoading) return <InlineWaiting label="Working out what needs reordering…" />;

  if (rows.length === 0) {
    if (w.narrowed) {
      return (
        <NothingMatches
          search={w.filters.search.trim()}
          locationName={pane.locationName}
          supplierName={pane.supplierName}
        />
      );
    }
    // No filters and still empty: two opposite meanings. No rule anywhere means
    // nothing can warn you; every rule comfortably above its trigger is the
    // whole point working.
    if (pane.policyCount === 0) return <NoReorderRules ctx={ctx} />;
    return <NothingNeedsReordering />;
  }

  return <ReorderListTable rows={rows} selection={selection} onOpen={onOpen} />;
}
