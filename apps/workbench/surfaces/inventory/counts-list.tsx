'use client';

// STOCK COUNTS — the sessions where you count what is actually on the shelf and
// correct the numbers when they disagree.
//
// ── Cards, not a table ────────────────────────────────────────────────────
//
// A count is a session, not a numeric row: a location, a state, how far the
// counting has got, and the money value of the differences it found. Those do
// not line up into columns you scan down — they read as a small summary per
// session. So this is a card per count, one column, capped and centred, which
// also survives a pane docked at 320px without a horizontal scrollbar.
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
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Heading,
  NativeSelect,
  SearchInput,
  Text,
  Timestamp,
  ToolbarSeparator,
} from '@wizeworks/silicaui-react';
import { ClipboardCheck, ClipboardList, Plus } from 'lucide-react';
import { ListPagination, MAX_TAKE, type PageSize } from '../../components/list-pagination';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { formatCents, plural, useStockLocations } from './data';
import {
  countState,
  countTypeLabel,
  useCounts,
  type CountRow,
  type CountStatus,
} from './counts-data';

/** Same modifier contract as every other list in the app. */
function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/** The one summary line a card carries, tuned to what matters at each stage:
 *  progress while counting, the value of the differences once counted, what was
 *  corrected once applied. */
function summaryLine(count: CountRow): string {
  const items = plural(count.lineCount, 'item', 'items');
  switch (count.status) {
    case 'counting':
      return `${String(count.countedLineCount)} of ${items} counted`;
    case 'review':
    case 'approved':
      return count.varianceValueCents > 0
        ? `${items} counted · differences worth ${formatCents(count.varianceValueCents)}`
        : `${items} counted · everything matched`;
    case 'posted':
      return count.varianceValueCents > 0
        ? `${items} · ${formatCents(count.varianceValueCents)} of corrections applied`
        : `${items} · everything matched, nothing to correct`;
    case 'cancelled':
      return `${items} · discarded without changing any stock`;
    default:
      return items;
  }
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
          icon={<ClipboardList className="size-6" aria-hidden />}
          title="Could not load your counts"
          description="This is a problem reaching the server. Your counts are unaffected — the list just could not be read just now."
        />
      );
    }

    if (isLoading) {
      return (
        <p className="p-4 text-sm" role="status">
          Loading counts…
        </p>
      );
    }

    if (rows.length === 0) {
      return (
        <EmptyState
          icon={<ClipboardCheck className="size-6" aria-hidden />}
          title={narrowed ? 'Nothing matches that' : 'No stock counts yet'}
          description={
            narrowed
              ? locationName
                ? `No counts match those filters at ${locationName}. Clear the status, or switch back to every location.`
                : 'No counts match those filters. Try clearing the status filter or a different location.'
              : 'A stock count is where you count what is really on the shelf and put the numbers right. Start one, count each item, and apply it to correct your stock in one go.'
          }
          actions={
            narrowed ? undefined : (
              <Button
                size="sm"
                color="module"
                onClick={() => {
                  ctx.open('inventory.counts.detail', { id: 'new' }, { target: 'tab' });
                }}
              >
                <Plus className="size-4" aria-hidden />
                Start a count
              </Button>
            )
          }
        />
      );
    }

    return (
      <ul className="flex flex-col gap-2 p-2">
        {rows.map((count) => {
          const state = countState(count.status);
          return (
            <li key={count.id}>
              <button
                type="button"
                className="card bg-base-100 border-base-300 hover:border-base-content/20 flex w-full flex-col gap-1.5 border p-4 text-left"
                onClick={(event) => {
                  openCount(count, event);
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col">
                    <Heading level={3} className="min-w-0 truncate text-lg font-semibold">
                      {count.warehouseName ?? 'Stock count'}
                    </Heading>
                    <Text className="font-mono text-sm">{count.number}</Text>
                  </div>
                  <Badge color={state.tone} variant="soft" size="sm">
                    {state.label}
                  </Badge>
                </div>
                <Text className="text-sm">
                  {countTypeLabel(count.type)} · {summaryLine(count)} ·{' '}
                  <Timestamp value={count.createdAt} format="relative" />
                </Text>
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Stock count controls">
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

        <ToolbarSeparator className="hidden @xl:block" />

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

        <Button
          size="sm"
          color="module"
          className="ml-auto shrink-0 whitespace-nowrap"
          aria-label="Start a new count"
          title="Start a new count"
          onClick={(event) => {
            ctx.open(
              'inventory.counts.detail',
              { id: 'new' },
              { target: event.shiftKey ? 'beside' : 'tab' }
            );
          }}
        >
          <Plus className="size-4" aria-hidden />
          <span className="hidden @md:inline">New count</span>
        </Button>

        {/* ALWAYS the last child of a list toolbar — see RefreshButton. */}
        <RefreshButton
          isFetching={isFetching}
          updatedAt={data ? dataUpdatedAt : undefined}
          onRefresh={() => {
            void refetch();
          }}
        />
      </PaneToolbar>

      <Card className="mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-y-auto">{body()}</Card>

      <div className="mx-auto w-full max-w-3xl shrink-0">
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
