'use client';

// REORDER — what is running low and needs buying again.
//
// ── A worklist, not a catalogue ──────────────────────────────────────────
//
// Every row here is a (product × location) already at or below the level you
// asked to be warned at. The job of the screen is to scan those rows, pick the
// ones to act on, and turn them into draft purchase orders — grouped for you by
// supplier, because that is the shape of a real order. So it IS a table: each row
// carries several numbers you compare down a column (what's left, the trigger
// level, how many to order, how many are already coming), exactly the case the
// house rule keeps tables for.
//
// ── The headline is WHEN it runs out ──────────────────────────────────────
//
// "How little is left" tells you it is low; it does not tell you how long you
// have. The row now leads with days of cover — the available stock divided by how
// fast it actually sells (straight from the ledger, not a guess) — said in plain
// words: "Out in about 6 days", "Out around 12 Aug", or "Not selling" when nothing
// is drawing it down. Soonest-to-run-out is a sort, because the shortest cover is
// the most urgent thing to buy.
//
// ── The ORDER is money, not emptiness (docs/146 Phase 7.7) ────────────────
//
// The default sort is now what running out would COST: the demand that would
// have nowhere to come from before a replacement could land, priced at the
// selling price. "Least in stock first" ranks by how empty a shelf looks, and a
// buyer with forty rows and an hour does not need the emptiest shelf — they need
// the one whose emptiness costs the most. A fast £40 line four days out beats a
// dormant £2 one down to its last unit, every time.
//
// Every row carries the sentence explaining its own figure, and the supplier's
// delivery time says whether it was MEASURED from real deliveries or is just
// what the supplier claims — which is most of the difference between a reorder
// level that works and one that is optimistic by however much the supplier is.
// Clicking through opens the full calculation.
//
// ── Every narrowing is a SERVER query ────────────────────────────────────
//
// Search, the location and supplier filters, the sort and the paging all go to
// the API. Sorting the loaded page in the browser would answer "what is most
// urgent" with "the scarcest of the fifty rows in hand" — so the endpoint sorts
// and narrows the WHOLE low set, and this only renders the window it returns.
//
// ── Three empty states, three different problems ──────────────────────────
//
// Nothing matches the search or a filter · nothing is running low, which is GOOD
// news and says so warmly · no reorder rules exist yet, so nothing can ever warn
// you. The last two both look like an empty list and mean opposite things, which
// is why the summary read exists to tell them apart.

//
// This file owns the filters, the window over the data, and the routing. The
// table is reorder-list-table, the empty states reorder-list-empty, the toolbar
// reorder-list-toolbar, and choosing/drafting lives in reorder-selection.

import { Card } from '@wizeworks/silicaui-react';
import { PANE_SHELL } from '../../components/pane-toolbar';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import type { ReorderRow } from './reorder-data';
import { targetFor } from './reorder-shared';
import { useReorderPane } from './reorder-window';
import { ReorderDraftBar } from './reorder-draft-bar';
import { ReorderBody } from './reorder-list-body';
import { ReorderFooter } from './reorder-list-footer';
import { ReorderListToolbar } from './reorder-list-toolbar';

export function ReorderListSurface({ ctx }: { ctx: SurfaceContext }) {
  const p = useReorderPane();

  // Clicking a row opens the CALCULATION, not the stock item. On this screen the
  // question is always "should I buy this, and why does it say that" — and the
  // stock item is one click further on from there.
  const open = (row: ReorderRow, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open(
      'inventory.planning.explain',
      { variantId: row.variantId, warehouseId: row.warehouseId },
      { target: targetFor(event) }
    );
  };

  return (
    <div className={PANE_SHELL}>
      {/* The toolbar goes THROUGH the draft bar rather than above it: they share
          one grid cell, so choosing a line swaps what the strip shows without
          moving the table under the pointer. */}
      <ReorderDraftBar
        selection={p.selection}
        toolbar={
          <ReorderListToolbar
            filters={p.w.filters}
            onNarrow={p.onNarrow}
            onSort={p.w.onSort}
            locations={p.activeLocations}
            suppliers={p.activeSuppliers}
            isFetching={p.query.isFetching}
            updatedAt={p.query.data ? p.query.dataUpdatedAt : undefined}
            onRefresh={() => {
              void p.query.refetch();
            }}
          />
        }
      />

      {/* Full width — matches the house list convention: the table fills the pane. */}
      <Card className="min-h-0 flex-1 overflow-y-auto">
        <ReorderBody ctx={ctx} pane={p} onOpen={open} />
      </Card>

      <ReorderFooter pane={p} />
    </div>
  );
}
