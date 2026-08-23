'use client';

// BOOKING RULES — the notice you need, what happens on a cancellation, and
// whether a deposit is taken up front. Each set of rules is a named policy a
// service points at, so a machine shop's 24-hour cancellation terms never bind a
// cake-tasting customer.
//
// A table, like every other list. A policy is a name plus a plain-language
// summary of what it asks of a customer. Search goes to the SERVER; there is no
// state to badge — a policy is a set of terms, not a thing with a lifecycle.

import { useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { Button, Card, EmptyState, SearchInput, Text } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { faPlus, faShieldCheck } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { ListPagination, MAX_TAKE, type PageSize } from '../../components/list-pagination';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { ListEmptyState } from '../../components/list-empty-state';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { policySummary, reminderSummary, usePolicies, type BookingPolicy } from './setup-data';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
const MODULE = 'scheduling';

const DETAIL_KEY = 'scheduling.policies.detail';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function PoliciesListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');

  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(1);
  const [take, setTake] = useState<number>(50);

  const skip = (page - 1) * pageSize;

  const { data, isPending, isFetching, dataUpdatedAt, isError, refetch } = usePolicies({
    q: search.trim(),
    take,
    skip,
  });

  const rows = data?.items ?? [];
  const total = data?.total;
  const narrowed = search.trim() !== '';

  const resetWindow = () => {
    setPage(1);
    setTake(pageSize);
  };

  const openNew = (event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open(DETAIL_KEY, { id: 'new' }, { target: targetFor(event) });
  };

  const open = (policy: BookingPolicy, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open(DETAIL_KEY, { id: policy.id }, { target: targetFor(event) });
  };

  const body = () => {
    if (isError) {
      return (
        <EmptyState
          icon={<Icon glyph={faShieldCheck} className="size-6" aria-hidden />}
          title="Could not load your booking rules"
          description="This is a problem reaching the server. Your rules are unaffected — the list just could not be read just now."
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

    if (isPending) {
      return <PaneWaiting label="Loading booking rules…" />;
    }

    if (rows.length === 0) {
      return (
        <ListEmptyState
          module={MODULE}
          filtered={narrowed}
          noResults={{
            icon: <Icon glyph={faShieldCheck} className="size-6" aria-hidden />,
            title: 'Nothing matches that',
            description: 'Try part of a rule set’s name.',
          }}
          firstRun={{
            title: 'No booking rules yet',
            description:
              'Booking rules decide how much notice you need, what happens if someone cancels late or misses a booking, and whether a deposit is taken. Set up a rule set and you can apply it to any service.',
            actions: (
              <Button
                size="sm"
                color="module"
                onClick={() => {
                  openNew({ shiftKey: false, altKey: false });
                }}
              >
                <Icon glyph={faPlus} className="size-4" aria-hidden />
                New rule set
              </Button>
            ),
          }}
        />
      );
    }

    return (
      <Table size="sm" hover>
        <thead>
          <tr>
            <th>Rule set</th>
            <th className="hidden @md:table-cell">What it asks of a customer</th>
            {/* Reminders are the half of a rule set nobody thinks to look for — they
                are not a term a customer agrees to, they are what the product DOES —
                so they get their own column rather than a clause in the summary. */}
            <th className="hidden @md:table-cell">Before the booking</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((policy) => (
            <tr
              key={policy.id}
              className="cursor-pointer"
              tabIndex={0}
              role="button"
              onClick={(event) => {
                open(policy, event);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                open(policy, event);
              }}
            >
              <td className="w-full max-w-0">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{policy.name}</span>
                  <span className="truncate text-sm @md:hidden">
                    {policySummary(policy)} · {reminderSummary(policy)}
                  </span>
                </span>
              </td>
              <td className="hidden @md:table-cell">{policySummary(policy)}</td>
              <td className="hidden whitespace-nowrap @md:table-cell">{reminderSummary(policy)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Booking rules list controls"
        search={
          <div className="max-w-xs min-w-0 flex-1">
            <SearchInput
              size="sm"
              aria-label="Search booking rules"
              placeholder="Rule set name…"
              value={search}
              onValueChange={(next) => {
                setSearch(next);
                resetWindow();
              }}
            />
          </div>
        }
        primaryAction={{
          label: 'New rule set',
          icon: faPlus,
          onClick: openNew,
          title: 'New rule set — hold Shift to open alongside, Alt for a new window',
        }}
        views={{
          target: '/scheduling/policies',
          params: { q: search.trim() },
          onApply: (next) => {
            setSearch(next.q ?? '');
            resetWindow();
          },
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

      <Card className="mx-auto min-h-0 w-full max-w-4xl flex-1 overflow-y-auto">{body()}</Card>

      <div className="mx-auto w-full max-w-4xl shrink-0">
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
        {rows.length > 0 ? (
          <Text className="hidden px-1 pb-1 text-sm @xl:block">
            Click to open · Shift-click alongside · Alt-click new window
          </Text>
        ) : null}
      </div>
    </div>
  );
}
