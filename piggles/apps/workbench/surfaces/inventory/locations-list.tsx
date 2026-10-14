'use client';

// LOCATIONS: every place you keep stock, as a table like every other list. The
// columns disclose with @container; the name cell is the one that GIVES
// (`max-w-0 w-full`), so the state badge is never shoved off the right edge.

// Every narrowing (search, kind, "show closed", paging) is a SERVER filter; sieving
// the loaded window would answer "which of my 3PLs" from fifty rows in hand.

// Three empty states: nothing matches, nothing exists yet, the load failed. Telling
// someone with twelve locations to set up their first is the worse mistake.

import { useState } from 'react';
import { Card } from '@wizeworks/silicaui-react';
import { ListPagination, MAX_TAKE, type PageSize } from '../../components/list-pagination';
import { PANE_SHELL } from '../../components/pane-toolbar';
import { LocationsListToolbar } from './locations-list-toolbar';
import { LocationsListEmpty } from './locations-list-empty';
import { LocationsListTable } from './locations-list-table';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { locationTypeLabel, useLocations, type Location } from './locations-data';
import { RowOpenHint } from '../../components/row-open-hint';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
const MODULE = 'inventory';

const DETAIL_KEY = 'inventory.warehouses.detail';

/** Same modifier contract as every other list in the app. */
function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/** What to try when nothing matched — naming ONLY what is actually narrowing the
 *  list, so no one goes hunting for a filter they never set. */
function emptyAdvice(search: string, typeLabel: string | null, includeClosed: boolean): string {
  const parts: string[] = [];
  if (search) parts.push('Try part of a location’s name or its code.');
  if (typeLabel) parts.push(`You are only seeing “${typeLabel}” places. Switch to every kind.`);
  if (!includeClosed) parts.push('Closed locations are hidden. Turn them on to include those.');
  return parts.join(' ');
}

/** Filters, paging and the locations they select. */
function useLocationsList() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [includeClosed, setIncludeClosed] = useState(false);

  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(1);
  const [take, setTake] = useState<number>(50);

  const skip = (page - 1) * pageSize;

  const query = useLocations({
    q: search.trim(),
    ...(type ? { type } : {}),
    includeClosed,
    take,
    skip,
  });

  // Only an explicit search or kind filter counts as "narrowed". "Show closed" is
  // OFF by default, so a brand-new account must reach the create prompt, not advice.
  const narrowed = search.trim() !== '' || type !== '';

  // Anything that changes which rows match returns to the first window.
  const resetWindow = () => {
    setPage(1);
    setTake(pageSize);
  };

  const filters = { search, setSearch, type, setType, includeClosed, setIncludeClosed };
  const paging = { pageSize, setPageSize, page, setPage, take, setTake, skip, resetWindow };
  return {
    ...filters,
    ...paging,
    query,
    rows: query.data?.items ?? [],
    total: query.data?.total,
    typeLabel: type ? locationTypeLabel(type) : null,
    narrowed,
  };
}

type LocationsList = ReturnType<typeof useLocationsList>;

function LocationsListFooter({ list }: { list: LocationsList }) {
  const { rows, skip, total, page, pageSize, take } = list;
  return (
    <div className="shrink-0">
      <ListPagination
        shown={rows.length}
        firstRow={rows.length === 0 ? 0 : skip + 1}
        total={total}
        page={page}
        pageSize={pageSize}
        canLoadMore={take < MAX_TAKE}
        busy={list.query.isFetching}
        onLoadMore={() => {
          list.setTake((current) => Math.min(current + pageSize, MAX_TAKE));
        }}
        onPageChange={(next) => {
          list.setPage(next);
          list.setTake(pageSize);
        }}
        onPageSizeChange={(size) => {
          list.setPageSize(size);
          list.setPage(1);
          list.setTake(size);
        }}
      />
      {rows.length > 0 ? <RowOpenHint /> : null}
    </div>
  );
}

function LocationsListBody({
  list,
  onOpen,
  onNew,
}: {
  list: LocationsList;
  onOpen: (location: Location, event: { shiftKey: boolean; altKey: boolean }) => void;
  onNew: () => void;
}) {
  const { query, rows } = list;
  if (query.isError || query.isPending || rows.length === 0) {
    return (
      <LocationsListEmpty
        module={MODULE}
        isError={query.isError}
        error={query.error}
        isPending={query.isPending}
        narrowed={list.narrowed}
        advice={emptyAdvice(list.search.trim(), list.typeLabel, list.includeClosed)}
        includeClosed={list.includeClosed}
        onRetry={() => {
          void query.refetch();
        }}
        onNew={onNew}
      />
    );
  }
  return <LocationsListTable rows={rows} onOpen={onOpen} />;
}

function LocationsListBar({
  list,
  onNew,
}: {
  list: LocationsList;
  onNew: (event: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  const { query, resetWindow } = list;
  // The toolbar does NOT wrap: a second line shoves the grid down. Things give way
  // instead and the search box absorbs what is left.
  return (
    <LocationsListToolbar
      search={list.search}
      onSearch={(next) => {
        list.setSearch(next);
        resetWindow();
      }}
      type={list.type}
      onType={(next) => {
        list.setType(next);
        resetWindow();
      }}
      includeClosed={list.includeClosed}
      onIncludeClosed={(next) => {
        list.setIncludeClosed(next);
        resetWindow();
      }}
      onNew={onNew}
      isFetching={query.isFetching}
      updatedAt={query.data ? query.dataUpdatedAt : undefined}
      onRefresh={() => {
        void query.refetch();
      }}
    />
  );
}

export function LocationsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const list = useLocationsList();

  const openNew = (event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open(DETAIL_KEY, { id: 'new' }, { target: targetFor(event) });
  };

  const open = (location: Location, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open(DETAIL_KEY, { id: location.id }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      <LocationsListBar list={list} onNew={openNew} />

      {/* Full width: the base-100 card lifts the rows off the recessed pane. */}
      <Card className="min-h-0 flex-1 overflow-y-auto">
        <LocationsListBody
          list={list}
          onOpen={open}
          onNew={() => {
            openNew({ shiftKey: false, altKey: false });
          }}
        />
      </Card>

      <LocationsListFooter list={list} />
    </div>
  );
}
