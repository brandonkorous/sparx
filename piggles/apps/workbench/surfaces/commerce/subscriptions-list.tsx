'use client';

// Repeat orders: every standing order across the catalog, each chip one stored
// status. The `+` exists because this list once sat over a table nothing could
// fill (issue 738). [[feedback_screen_over_a_function_nobody_calls]]

import { useState, type ReactNode } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { Card } from '@wizeworks/silicaui-react';
import { faPlus, faRepeat } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { ListEmptyState } from '../../components/list-empty-state';
import { ListPagination, MAX_TAKE, type PageSize } from '../../components/list-pagination';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { useSubscriptions, type SubscriptionSummary } from './subscriptions-data';
import { SubscriptionsTable } from './subscriptions-list-rows';
import { RowOpenHint } from '../../components/row-open-hint';

const FILTERS = [
  { value: 'all', label: 'All', status: undefined },
  { value: 'active', label: 'Running', status: 'active' as const },
  { value: 'paused', label: 'Paused', status: 'paused' as const },
  { value: 'past_due', label: 'Payment failed', status: 'past_due' as const },
  { value: 'cancelled', label: 'Stopped', status: 'cancelled' as const },
] as const;

type FilterValue = (typeof FILTERS)[number]['value'];
interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}
interface StartOne {
  label: string;
  onClick: (event: OpenEvent) => void;
}

function targetFor(event: OpenEvent): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

function useListWindow() {
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

type ListWindow = ReturnType<typeof useListWindow>;

function Pager(props: {
  win: ListWindow;
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

function SubscriptionsBody(props: {
  query: ReturnType<typeof useSubscriptions>;
  rows: SubscriptionSummary[];
  label: string | null;
  startOne: StartOne;
  onOpen: (sub: SubscriptionSummary, event: OpenEvent) => void;
}) {
  const { query, rows, label, startOne, onOpen } = props;
  const icon = <Icon glyph={faRepeat} className="size-6" aria-hidden />;
  if (query.error) {
    return (
      <PaneLoadError
        module="commerce"
        icon={icon}
        title="Could not load repeat orders"
        description="This is a problem reaching the server. Nobody’s repeat order has changed. Nothing has been lost."
        error={query.error}
      />
    );
  }
  if (query.isLoading) return <PaneWaiting label="Loading repeat orders…" />;
  if (rows.length > 0) return <SubscriptionsTable rows={rows} onOpen={onOpen} />;
  // Nothing anywhere is not nothing under this chip. Only All reports the full
  // count, and blaming a chip over an empty list sent her hunting for nothing.
  const nothingAtAll = (query.data?.total ?? 0) === 0;
  return (
    <ListEmptyState
      module="commerce"
      filtered={label !== null && !nothingAtAll}
      noResults={{
        icon,
        title: 'None match that',
        description: `No repeat orders are marked “${label ?? ''}”. Switch back to All to see the rest, including any still on a free trial.`,
      }}
      firstRun={{
        icon,
        title: 'No repeat orders yet',
        description:
          'A repeat order sends a customer the same things again and again, a candle every month or a box every quarter, and bills them each time. Set one up when somebody asks for it, and it runs itself from then on.',
        action: startOne,
      }}
    />
  );
}

function SubscriptionsToolbar(props: {
  filter: FilterValue;
  onFilter: (next: FilterValue) => void;
  startOne: StartOne;
  refresh: ReactNode;
}) {
  return (
    <PaneToolbar
      label="Repeat orders controls"
      status={<Icon glyph={faRepeat} className="size-4 shrink-0" aria-hidden />}
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
      primaryAction={{
        ...props.startOne,
        icon: faPlus,
        title: 'Start a repeat order: hold Shift to open alongside, Alt for a new window',
      }}
      // The status is the only thing narrowing this list, and the bar holds it.
      views={{ target: '/commerce/subscriptions' }}
      refresh={props.refresh}
    />
  );
}

// ONE object for the toolbar's plus and the empty state's invitation, so the
// label cannot drift between the two ways in.
function startOneIn(ctx: SurfaceContext): StartOne {
  return {
    label: 'Start a repeat order',
    onClick: (event) => {
      ctx.open('commerce.subscription.new', {}, { target: targetFor(event) });
    },
  };
}

export function SubscriptionsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [filter, setFilter] = useState<FilterValue>('all');
  const win = useListWindow();
  const active = FILTERS.find((entry) => entry.value === filter) ?? FILTERS[0];
  const query = useSubscriptions({ status: active.status, take: win.take, skip: win.skip });
  const { data, isFetching, dataUpdatedAt, refetch } = query;
  const rows = data?.items ?? [];
  const startOne = startOneIn(ctx);
  const open = (sub: SubscriptionSummary, event: OpenEvent) => {
    ctx.open('commerce.subscription.detail', { id: sub.id }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      <SubscriptionsToolbar
        filter={filter}
        onFilter={(next) => {
          setFilter(next);
          win.reset();
        }}
        startOne={startOne}
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
        <SubscriptionsBody
          query={query}
          rows={rows}
          label={filter !== 'all' ? active.label : null}
          startOne={startOne}
          onOpen={open}
        />
      </Card>
      <Pager win={win} rowCount={rows.length} total={data?.total} busy={isFetching} />
    </div>
  );
}
