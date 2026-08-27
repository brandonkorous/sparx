'use client';

// Which of the five things the stock list is currently showing: a failed load,
// a wait, one of the several kinds of nothing, or the table.
//
// Split from the pane because choosing WHICH answer this is has nothing to do
// with holding the filters that produced it — the same seam that already put
// the empty states in stock-list-empty.tsx.

import { EmptyState } from '@wizeworks/silicaui-react';
import { faBoxes } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneWaiting } from '../../components/pane-waiting';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import type { CatalogMatch, SortDirection, StockLevel, StockSortKey } from './data';
import { StockListEmpty } from './stock-list-empty';
import { StockListTable } from './stock-list-table';
import type { StockLevelFilter } from './stock-list-toolbar';

interface BodyProps {
  ctx: SurfaceContext;
  rows: StockLevel[];
  isError: boolean;
  isLoading: boolean;
  search: string;
  locationId: string;
  locationName: string | null;
  level: StockLevelFilter;
  narrowed: boolean;
  catalogMatches: CatalogMatch[];
  checkingCatalog: boolean;
  sort: { key: StockSortKey; dir: SortDirection };
  onSort: (key: StockSortKey) => void;
  onOpen: (row: StockLevel, event: { shiftKey: boolean; altKey: boolean }) => void;
  onExplain: (row: StockLevel) => void;
}

export function StockListBody(props: BodyProps) {
  // A failed load REPLACES the table. Rendering an empty grid under live
  // filters invites someone to conclude they have no stock.
  if (props.isError) {
    return (
      <EmptyState
        icon={<Icon glyph={faBoxes} className="size-6" aria-hidden />}
        title="Could not load your stock"
        description="This is a problem reaching the server. Your stock is unaffected — the numbers just could not be read just now."
      />
    );
  }

  if (props.isLoading) {
    return <PaneWaiting label="Loading stock…" />;
  }

  if (props.rows.length === 0) {
    return (
      <StockListEmpty
        ctx={props.ctx}
        search={props.search}
        locationId={props.locationId}
        locationName={props.locationName}
        level={props.level}
        narrowed={props.narrowed}
        catalogMatches={props.catalogMatches}
        checkingCatalog={props.checkingCatalog}
      />
    );
  }

  return (
    <StockListTable
      rows={props.rows}
      sort={props.sort}
      onSort={props.onSort}
      onOpen={props.onOpen}
      onExplain={props.onExplain}
    />
  );
}
