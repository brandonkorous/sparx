'use client';

// STOCK COUNTS — the sessions where you count what is actually on the shelf and
// correct the numbers when they disagree.
//
// This file owns the pane — filters, window, toolbar. The table is
// counts-list-table.tsx and what a count may honestly say about itself is
// counts-list-summary.ts.
//
// ── Creating a count is a PANE, in its "new" state ────────────────────────
//
// A new count is the same surface as an open one, started empty — so the "+"
// opens the detail pane at {id:'new'} rather than a modal. There is real work in
// starting a count (choosing where, choosing what), a durable thing you return
// to, and it takes minutes not seconds. A modal clears none of those bars.
//
// ── Two empty states ──────────────────────────────────────────────────────
//
// Nothing matches the filters · no count has ever been started. The second
// invites the first count; the first must not, or someone who filtered to
// "Applied" and has none yet is told to go start counting when they are mid-way
// through their first session two filters away.

import { useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { Card, EmptyState, NativeSelect, SearchInput } from '@wizeworks/silicaui-react';
import { faClipboardList, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { ListPagination, MAX_TAKE, type PageSize } from '../../components/list-pagination';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { useStockLocations } from './data';
import { useCounts, type CountRow, type CountStatus } from './counts-data';
import { CountsListEmpty } from './counts-list-empty';
import { CountsListTable } from './counts-list-table';
import { CountsUnpricedNotice } from './counts-list-unpriced';
import { anyUnpriced } from './counts-list-summary';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
const MODULE = 'inventory';

/** Same modifier contract as every other list in the app. */
function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

const STATUS_OPTIONS: { value: CountStatus; label: string }[] = [
  { value: 'counting', label: 'Being counted' },
  { value: 'review', label: 'Ready to apply' },
  { value: 'approved', label: 'Approved' },
  { value: 'posted', label: 'Applied' },
  { value: 'cancelled', label: 'Discarded' },
];

export function CountsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | CountStatus>('');
  const [locationId, setLocationId] = useState('');

  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [page, setPage] = useState(1);
  const [take, setTake] = useState<number>(25);

  const skip = (page - 1) * pageSize;
  const locations = useStockLocations();
  const activeLocations = (locations.data?.items ?? []).filter((location) => location.isActive);
  const locationName = activeLocations.find((location) => location.id === locationId)?.name ?? null;

  const { data, isLoading, isFetching, dataUpdatedAt, isError, refetch } = useCounts({
    q: search.trim(),
    ...(status ? { status } : {}),
    ...(locationId ? { warehouseId: locationId } : {}),
    take,
    skip,
  });

  const rows = data?.items ?? [];
  const total = data?.total;
  const narrowed = search.trim() !== '' || status !== '' || locationId !== '';

  const resetWindow = () => {
    setPage(1);
    setTake(pageSize);
  };

  const openCount = (count: CountRow, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('inventory.counts.detail', { id: count.id }, { target: targetFor(event) });
  };

  const body = () => {
    if (isError) {
      return (
        <EmptyState
          icon={<Icon glyph={faClipboardList} className="size-6" aria-hidden />}
          title="Could not load your counts"
          description="This is a problem reaching the server. Your counts are unaffected — the list just could not be read just now."
        />
      );
    }

    if (isLoading) {
      return <PaneWaiting label="Loading counts…" />;
    }

    if (rows.length === 0) {
      return (
        <CountsListEmpty
          ctx={ctx}
          module={MODULE}
          filtered={narrowed}
          locationName={locationName}
        />
      );
    }

    return <CountsListTable rows={rows} onOpen={openCount} />;
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Stock count controls"
        search={
          <div className="max-w-xs min-w-0 flex-1">
            <SearchInput
              size="sm"
              aria-label="Search counts"
              placeholder="Count number or location…"
              value={search}
              onValueChange={(next) => {
                setSearch(next);
                resetWindow();
              }}
            />
          </div>
        }
        primaryAction={{
          label: 'New count',
          icon: faPlus,
          onClick: (event) => {
            ctx.open(
              'inventory.counts.detail',
              { id: 'new' },
              { target: event.shiftKey ? 'beside' : 'tab' }
            );
          },
          title: 'Start a new count',
        }}
        controls={
          <>
            <NativeSelect
              size="sm"
              className="max-w-40 shrink"
              aria-label="Show counts that are"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as '' | CountStatus);
                resetWindow();
              }}
            >
              <option value="">Any status</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              size="sm"
              className="max-w-40 shrink"
              aria-label="Show counts at"
              value={locationId}
              onChange={(event) => {
                setLocationId(event.target.value);
                resetWindow();
              }}
            >
              <option value="">Every location</option>
              {activeLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </NativeSelect>
          </>
        }
        views={{
          target: '/inventory/counts',
          params: { q: search.trim(), status, warehouse: locationId },
          onApply: (next) => {
            setSearch(next.q ?? '');
            setStatus((next.status ?? '') as '' | CountStatus);
            setLocationId(next.warehouse ?? '');
            resetWindow();
          },
        }}
        refresh={
          /* ALWAYS the last child of a list toolbar — see RefreshButton. */
          <RefreshButton
            isFetching={isFetching}
            updatedAt={data ? dataUpdatedAt : undefined}
            onRefresh={() => {
              void refetch();
            }}
          />
        }
      />

      {/* Full width — the base-100 card lifted off the recessed pane. Matches the
          house list convention: the table fills the pane. */}
      {/* Only when a row on screen actually says "No cost yet". A standing
          notice about costs on a screen where every figure is real is noise. */}
      {anyUnpriced(rows) ? (
        <CountsUnpricedNotice
          onOpen={() => {
            ctx.open('inventory.costing.uncosted', {}, { target: 'tab' });
          }}
        />
      ) : null}

      <Card className="min-h-0 flex-1 overflow-y-auto">{body()}</Card>

      <div className="shrink-0">
        <ListPagination
          shown={rows.length}
          firstRow={rows.length === 0 ? 0 : skip + 1}
          total={total}
          page={page}
          pageSize={pageSize}
          canLoadMore={take < MAX_TAKE}
          busy={isFetching}
          onLoadMore={() => {
            setTake((current) => Math.min(current + pageSize, MAX_TAKE));
          }}
          onPageChange={(next) => {
            setPage(next);
            setTake(pageSize);
          }}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
            setTake(size);
          }}
        />
      </div>
    </div>
  );
}
