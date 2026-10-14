'use client';

// BOOKING RULES: the notice you need, what a cancellation costs, and whether a
// deposit is taken. Each set is a named policy a service points at, so one
// service's 24-hour cancellation terms never bind another service's customer.

// A table: a name plus a plain-language summary. Search goes to the SERVER; there
// is no state to badge, because a policy is a set of terms, not a lifecycle.

import { useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { Card, SearchInput } from '@wizeworks/silicaui-react';
import { faPlus, faShieldCheck } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { ListPagination, MAX_TAKE, type PageSize } from '../../components/list-pagination';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { usePolicies, type BookingPolicy } from './setup-data';
import { RowOpenHint } from '../../components/row-open-hint';
import { PoliciesEmpty, PoliciesTable } from './policies-table';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
const MODULE = 'scheduling';

const DETAIL_KEY = 'scheduling.policies.detail';

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}

function targetFor(event: OpenEvent): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

function usePaging() {
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(1);
  const [take, setTake] = useState<number>(50);
  return {
    pageSize,
    page,
    take,
    skip: (page - 1) * pageSize,
    resetWindow: () => {
      setPage(1);
      setTake(pageSize);
    },
    loadMore: () => {
      setTake((current) => Math.min(current + pageSize, MAX_TAKE));
    },
    changePage: (next: number) => {
      setPage(next);
      setTake(pageSize);
    },
    changePageSize: (size: PageSize) => {
      setPageSize(size);
      setPage(1);
      setTake(size);
    },
  };
}

interface BodyProps {
  query: ReturnType<typeof usePolicies>;
  rows: BookingPolicy[];
  narrowed: boolean;
  openNew: (event: OpenEvent) => void;
  open: (policy: BookingPolicy, event: OpenEvent) => void;
}

function PoliciesBody({ query, rows, narrowed, openNew, open }: BodyProps) {
  if (query.isError) {
    return (
      <PaneLoadError
        module={MODULE}
        icon={<Icon glyph={faShieldCheck} className="size-6" aria-hidden />}
        title="Could not load your booking rules"
        description="This is a problem reaching the server. Your rules are unaffected: the list just could not be read just now."
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }

  if (query.isPending) {
    return <PaneWaiting label="Loading booking rules…" />;
  }

  if (rows.length === 0) {
    return <PoliciesEmpty narrowed={narrowed} openNew={openNew} />;
  }

  return <PoliciesTable rows={rows} onOpen={open} />;
}

interface ToolbarProps {
  search: string;
  onSearch: (next: string) => void;
  openNew: (event: OpenEvent) => void;
  query: ReturnType<typeof usePolicies>;
}

function PoliciesToolbar({ search, onSearch, openNew, query }: ToolbarProps) {
  return (
    <PaneToolbar
      label="Booking rules controls"
      search={
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            size="sm"
            aria-label="Search booking rules"
            placeholder="Rule set name…"
            value={search}
            onValueChange={onSearch}
          />
        </div>
      }
      primaryAction={{
        label: 'New rule set',
        icon: faPlus,
        onClick: openNew,
        title: 'New rule set: hold Shift to open alongside, Alt for a new window',
      }}
      views={{
        target: '/scheduling/policies',
        params: { q: search.trim() },
        onApply: (next) => {
          onSearch(next.q ?? '');
        },
      }}
      refresh={
        <RefreshButton
          isFetching={query.isFetching}
          updatedAt={query.data ? query.dataUpdatedAt : undefined}
          onRefresh={() => {
            void query.refetch();
          }}
        />
      }
    />
  );
}

export function PoliciesListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const paging = usePaging();
  const query = usePolicies({ q: search.trim(), take: paging.take, skip: paging.skip });

  const rows = query.data?.items ?? [];
  const openNew = (event: OpenEvent) => {
    ctx.open(DETAIL_KEY, { id: 'new' }, { target: targetFor(event) });
  };
  const open = (policy: BookingPolicy, event: OpenEvent) => {
    ctx.open(DETAIL_KEY, { id: policy.id }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      <PoliciesToolbar
        search={search}
        onSearch={(next) => {
          setSearch(next);
          paging.resetWindow();
        }}
        openNew={openNew}
        query={query}
      />

      <Card className="mx-auto min-h-0 w-full max-w-4xl flex-1 overflow-y-auto">
        <PoliciesBody
          query={query}
          rows={rows}
          narrowed={search.trim() !== ''}
          openNew={openNew}
          open={open}
        />
      </Card>

      <PoliciesFooter paging={paging} query={query} rowCount={rows.length} />
    </div>
  );
}

interface FooterProps {
  paging: ReturnType<typeof usePaging>;
  query: ReturnType<typeof usePolicies>;
  rowCount: number;
}

function PoliciesFooter({ paging, query, rowCount }: FooterProps) {
  return (
    <div className="mx-auto w-full max-w-4xl shrink-0">
      <ListPagination
        shown={rowCount}
        firstRow={rowCount === 0 ? 0 : paging.skip + 1}
        total={query.data?.total}
        page={paging.page}
        pageSize={paging.pageSize}
        canLoadMore={paging.take < MAX_TAKE}
        busy={query.isFetching}
        onLoadMore={paging.loadMore}
        onPageChange={paging.changePage}
        onPageSizeChange={paging.changePageSize}
      />
      {rowCount > 0 ? <RowOpenHint /> : null}
    </div>
  );
}
