'use client';

// SERVICES — what people can book you for, how long each takes, and what it costs.
//
// The rows live in services-table.tsx and what narrows them in
// services-toolbar.tsx; this file holds the question being asked (RULE #0.5).

import { useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { Button, Card, EmptyState } from '@wizeworks/silicaui-react';
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

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/** What to try when nothing matched — naming ONLY what is actually narrowing the
 *  list, so no one hunts for a filter they never set. */
function emptyAdvice(filters: ServicesFilters, typeLabel: string | null): string {
  const parts: string[] = [];
  if (filters.search.trim()) parts.push('Try part of a service’s name.');
  if (typeLabel) parts.push(`You are only seeing “${typeLabel}” bookings — switch to every kind.`);
  if (filters.activeOnly) {
    parts.push('Switched-off services are hidden — include those to see them.');
  }
  if (!filters.showRemoved) {
    parts.push('Anything you have removed is hidden too — turn on Removed to see it.');
  }
  return parts.join(' ');
}

export function ServicesListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [filters, setFilters] = useState<ServicesFilters>(NO_FILTERS);
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(1);
  const [take, setTake] = useState<number>(50);

  const skip = (page - 1) * pageSize;

  const { data, isPending, isFetching, dataUpdatedAt, isError, refetch } = useServices({
    q: filters.search.trim(),
    ...(filters.type ? { bookingType: filters.type as BookingType } : {}),
    activeOnly: filters.activeOnly,
    includeRemoved: filters.showRemoved,
    take,
    skip,
  });

  const rows = data?.items ?? [];
  const typeLabel = filters.type ? bookingTypeLabel(filters.type) : null;
  const narrowed = filters.search.trim() !== '' || filters.type !== '';

  // Any change to what is being ASKED starts the answer again at page one.
  const onFilters = (next: ServicesFilters) => {
    setFilters(next);
    setPage(1);
    setTake(pageSize);
  };

  const openNew = (event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open(DETAIL_KEY, { id: 'new' }, { target: targetFor(event) });
  };

  const open = (service: SchedulingService, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open(DETAIL_KEY, { id: service.id }, { target: targetFor(event) });
  };

  const body = () => {
    if (isError) {
      return (
        <EmptyState
          icon={<Icon glyph={faBriefcase} className="size-6" aria-hidden />}
          title="Could not load your services"
          description="This is a problem reaching the server. Your services are unaffected — the list just could not be read just now."
          actions={
            <Button
              size="sm"
              color="module"
              onClick={() => {
                void refetch();
              }}
            >
              Try again
            </Button>
          }
        />
      );
    }

    if (isPending) return <PaneWaiting label="Loading services…" />;

    if (rows.length === 0) {
      return (
        <ListEmptyState
          module={MODULE}
          filtered={narrowed}
          noResults={{
            icon: <Icon glyph={faBriefcase} className="size-6" aria-hidden />,
            title: 'Nothing matches that',
            description: emptyAdvice(filters, typeLabel),
          }}
          firstRun={{
            title: 'No services yet',
            description:
              'A service is anything a customer can book — a haircut, a class, a table, a hire. Set up your first and people can start booking it.',
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

    return <ServicesTable rows={rows} onOpen={open} />;
  };

  return (
    <div className={PANE_SHELL}>
      <ServicesToolbar
        filters={filters}
        onChange={onFilters}
        onNew={openNew}
        isFetching={isFetching}
        updatedAt={data ? dataUpdatedAt : undefined}
        onRefresh={() => {
          void refetch();
        }}
      />

      <Card className="mx-auto min-h-0 w-full max-w-5xl flex-1 overflow-y-auto">{body()}</Card>

      <div className="mx-auto w-full max-w-5xl shrink-0">
        <ListPagination
          shown={rows.length}
          firstRow={rows.length === 0 ? 0 : skip + 1}
          total={data?.total}
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
        {rows.length > 0 ? <RowOpenHint /> : null}
      </div>
    </div>
  );
}
