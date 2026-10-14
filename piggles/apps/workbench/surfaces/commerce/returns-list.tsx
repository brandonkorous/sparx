'use client';

// Returns: what customers asked to send back. Each chip is phrased as the work and
// pinned to ONE server status, so the list is always one server answer. No search
// box: the endpoint has nothing to search on, and a page-only filter would lie.

import { useState, type ReactNode } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { Card, EmptyState } from '@wizeworks/silicaui-react';
import { faRotateLeft } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { ListPagination, MAX_TAKE, type PageSize } from '../../components/list-pagination';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { useReturns, type ReturnStatus, type ReturnSummary } from './returns-data';
import { ReturnsTable } from './returns-list-rows';
import { RowOpenHint } from '../../components/row-open-hint';

/** The chips are stages of the work, each pinned to ONE server status. "All"
 *  drops the filter entirely. */
const FILTERS = [
  { value: 'all', label: 'All', status: undefined },
  { value: 'requested', label: 'Needs a decision', status: 'requested' },
  { value: 'approved', label: 'Approved', status: 'approved' },
  { value: 'received', label: 'Back with you', status: 'received' },
  { value: 'inspected', label: 'Ready to settle', status: 'inspected' },
  { value: 'refunded', label: 'Settled', status: 'refunded' },
  { value: 'exchanged', label: 'Swapped', status: 'exchanged' },
  { value: 'denied', label: 'Turned down', status: 'denied' },
] as const satisfies readonly { value: string; label: string; status: ReturnStatus | undefined }[];

type FilterValue = (typeof FILTERS)[number]['value'];

/** Same modifier contract as every other list in the app. */
function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

function useReturnsWindow() {
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(1);
  const [take, setTake] = useState<number>(50);
  return {
    pageSize,
    page,
    take,
    skip: (page - 1) * pageSize,
    reset: () => {
      setPage(1);
      setTake(pageSize);
    },
    loadMore: () => {
      setTake((current) => Math.min(current + pageSize, MAX_TAKE));
    },
    toPage: (next: number) => {
      setPage(next);
      setTake(pageSize);
    },
    resize: (size: PageSize) => {
      setPageSize(size);
      setPage(1);
      setTake(size);
    },
  };
}

type ReturnsWindow = ReturnType<typeof useReturnsWindow>;

function ReturnsPager(props: {
  win: ReturnsWindow;
  rowCount: number;
  total: number | undefined;
  busy: boolean;
}) {
  const { win, rowCount, total, busy } = props;
  return (
    <div className="shrink-0">
      <ListPagination
        shown={rowCount}
        firstRow={rowCount === 0 ? 0 : win.skip + 1}
        total={total}
        page={win.page}
        pageSize={win.pageSize}
        canLoadMore={win.take < MAX_TAKE}
        busy={busy}
        onLoadMore={win.loadMore}
        onPageChange={win.toPage}
        onPageSizeChange={win.resize}
      />
      {rowCount > 0 ? <RowOpenHint /> : null}
    </div>
  );
}

function ReturnsBody(props: {
  query: ReturnType<typeof useReturns>;
  rows: ReturnSummary[];
  label: string | null;
  onOpen: (row: ReturnSummary, event: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  const { query, rows, label, onOpen } = props;
  const icon = <Icon glyph={faRotateLeft} className="size-6" aria-hidden />;
  if (query.error) {
    return (
      <PaneLoadError
        icon={icon}
        title="Could not load your returns"
        description="This is a problem reaching the server. Your returns are unaffected. Nothing has been lost."
        error={query.error}
      />
    );
  }
  if (query.isLoading) return <PaneWaiting label="Loading returns…" />;
  if (rows.length > 0) return <ReturnsTable rows={rows} onOpen={onOpen} />;
  return (
    <EmptyState
      icon={icon}
      title={label !== null ? 'Nothing at this stage' : 'No returns yet'}
      description={
        label !== null
          ? `No returns are marked “${label}” right now. Switch back to All to see the rest.`
          : 'When a customer asks to send something back, it shows up here for you to approve and settle.'
      }
    />
  );
}

function ReturnsToolbar(props: {
  filter: FilterValue;
  onFilter: (next: FilterValue) => void;
  refresh: ReactNode;
}) {
  return (
    <PaneToolbar
      label="Returns controls"
      filters={[
        {
          label: 'Show',
          // Each chip IS one stored status, so that is the name it persists under.
          key: 'status',
          value: props.filter,
          onValueChange: (next) => {
            props.onFilter((next as FilterValue | null) ?? 'all');
          },
          options: FILTERS,
        },
      ]}
      // The stage is the only thing narrowing this list, and the bar holds it.
      views={{ target: '/commerce/returns' }}
      refresh={props.refresh}
    />
  );
}

export function ReturnsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [filter, setFilter] = useState<FilterValue>('all');
  const win = useReturnsWindow();
  const active = FILTERS.find((entry) => entry.value === filter) ?? FILTERS[0];
  const query = useReturns({ status: active.status, take: win.take, skip: win.skip });
  const { data, isFetching, dataUpdatedAt, refetch } = query;
  const rows = data?.items ?? [];

  const open = (row: ReturnSummary, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('commerce.return.detail', { id: row.id }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      <ReturnsToolbar
        filter={filter}
        onFilter={(next) => {
          setFilter(next);
          win.reset();
        }}
        refresh={
          <RefreshButton
            isFetching={isFetching}
            updatedAt={data ? dataUpdatedAt : undefined}
            onRefresh={() => {
              void refetch();
            }}
          />
        }
      />
      <Card className="min-h-0 flex-1 overflow-y-auto">
        <ReturnsBody
          query={query}
          rows={rows}
          label={filter !== 'all' ? active.label : null}
          onOpen={open}
        />
      </Card>
      <ReturnsPager win={win} rowCount={rows.length} total={data?.total} busy={isFetching} />
    </div>
  );
}
