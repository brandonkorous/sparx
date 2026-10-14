'use client';

// SERVICES: what people can book you for, how long each takes, and what it costs.
// The rows live in services-table.tsx and what narrows them in services-toolbar.tsx;
// this file holds the question being asked (RULE #0.5).

import { useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { Button, Card } from '@wizeworks/silicaui-react';
import { faBriefcase, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { ServicesTable } from './services-table';
import { ServicesToolbar, type ServicesFilters } from './services-toolbar';
import { ListPagination, MAX_TAKE, type PageSize } from '../../components/list-pagination';
import { PANE_SHELL } from '../../components/pane-toolbar';
import { ListEmptyState } from '../../components/list-empty-state';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import {
  bookingTypeLabel,
  useServices,
  type BookingType,
  type SchedulingService,
} from './setup-data';
import { RowOpenHint } from '../../components/row-open-hint';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
const MODULE = 'scheduling';

const DETAIL_KEY = 'scheduling.services.detail';

const NO_FILTERS: ServicesFilters = {
  search: '',
  type: '',
  activeOnly: false,
  showRemoved: false,
};

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}

function targetFor(event: OpenEvent): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/** What to try when nothing matched — naming ONLY what is actually narrowing the
 *  list, so no one hunts for a filter they never set. */
function emptyAdvice(filters: ServicesFilters, typeLabel: string | null): string {
  const parts: string[] = [];
  if (filters.search.trim()) parts.push('Try part of a service’s name.');
  if (typeLabel) parts.push(`You are only seeing “${typeLabel}” bookings. Switch to every kind.`);
  if (filters.activeOnly) {
    parts.push('Switched-off services are hidden: include those to see them.');
  }
  if (!filters.showRemoved) {
    parts.push('Anything you have removed is hidden too. Turn on Removed to see it.');
  }
  return parts.join(' ');
}

function ServicesEmpty({
  filters,
  openNew,
}: {
  filters: ServicesFilters;
  openNew: (event: OpenEvent) => void;
}) {
  const typeLabel = filters.type ? bookingTypeLabel(filters.type) : null;
  return (
    <ListEmptyState
      module={MODULE}
      filtered={filters.search.trim() !== '' || filters.type !== ''}
      noResults={{
        icon: <Icon glyph={faBriefcase} className="size-6" aria-hidden />,
        title: 'Nothing matches that',
        description: emptyAdvice(filters, typeLabel),
      }}
      firstRun={{
        title: 'No services yet',
        description:
          'A service is anything a customer can book: a haircut, a class, a table, a hire. Set up your first and people can start booking it.',
        actions: (
          <Button
            size="sm"
            color="module"
            onClick={() => {
              openNew({ shiftKey: false, altKey: false });
            }}
          >
            <Icon glyph={faPlus} className="size-4" aria-hidden />
            New service
          </Button>
        ),
      }}
    />
  );
}

interface BodyProps {
  query: ReturnType<typeof useServices>;
  filters: ServicesFilters;
  openNew: (event: OpenEvent) => void;
  open: (service: SchedulingService, event: OpenEvent) => void;
}

function ServicesBody({ query, filters, openNew, open }: BodyProps) {
  const rows = query.data?.items ?? [];
  if (query.isError) {
    return (
      <PaneLoadError
        module={MODULE}
        icon={<Icon glyph={faBriefcase} className="size-6" aria-hidden />}
        title="Could not load your services"
        description="This is a problem reaching the server. Your services are unaffected: the list just could not be read just now."
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }

  if (query.isPending) return <PaneWaiting label="Loading services…" />;

  if (rows.length === 0) return <ServicesEmpty filters={filters} openNew={openNew} />;

  return <ServicesTable rows={rows} onOpen={open} />;
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
    // Any change to what is being ASKED starts the answer again at page one.
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

interface FooterProps {
  paging: ReturnType<typeof usePaging>;
  query: ReturnType<typeof useServices>;
}

function ServicesFooter({ paging, query }: FooterProps) {
  const rowCount = query.data?.items.length ?? 0;
  return (
    <div className="mx-auto w-full max-w-5xl shrink-0">
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

export function ServicesListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [filters, setFilters] = useState<ServicesFilters>(NO_FILTERS);
  const paging = usePaging();

  const query = useServices({
    q: filters.search.trim(),
    ...(filters.type ? { bookingType: filters.type as BookingType } : {}),
    activeOnly: filters.activeOnly,
    includeRemoved: filters.showRemoved,
    take: paging.take,
    skip: paging.skip,
  });

  const openNew = (event: OpenEvent) => {
    ctx.open(DETAIL_KEY, { id: 'new' }, { target: targetFor(event) });
  };
  const open = (service: SchedulingService, event: OpenEvent) => {
    ctx.open(DETAIL_KEY, { id: service.id }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      <ServicesToolbar
        filters={filters}
        onChange={(next) => {
          setFilters(next);
          paging.resetWindow();
        }}
        onNew={openNew}
        isFetching={query.isFetching}
        updatedAt={query.data ? query.dataUpdatedAt : undefined}
        onRefresh={() => {
          void query.refetch();
        }}
      />

      <Card className="mx-auto min-h-0 w-full max-w-5xl flex-1 overflow-y-auto">
        <ServicesBody query={query} filters={filters} openNew={openNew} open={open} />
      </Card>

      <ServicesFooter paging={paging} query={query} />
    </div>
  );
}
