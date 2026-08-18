'use client';

// Checkout sessions — shoppers part-way through paying.
//
// A session is the storefront walking a shopper from cart to order; staff never
// start one. This is a read view for one job: seeing where a payment stalled. So
// the filter chips are the steps a shopper gets stuck on — at payment, at the
// final review — plus the two ends, finished and expired. Each maps to ONE
// server step.

import { useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { Badge, Card, EmptyState } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { faCreditCard } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { ListPagination, MAX_TAKE, type PageSize } from '../../components/list-pagination';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { formatMoney, formatDateTime } from './data';
import {
  checkoutState,
  useCheckoutSessions,
  type CheckoutRow,
  type CheckoutStep,
} from './checkout-data';

const FILTERS = [
  { value: 'all', label: 'All', step: undefined },
  { value: 'payment', label: 'At payment', step: 'payment' },
  { value: 'review', label: 'At review', step: 'review' },
  { value: 'shipping', label: 'At delivery', step: 'shipping' },
  { value: 'completed', label: 'Finished', step: 'completed' },
  { value: 'expired', label: 'Expired', step: 'expired' },
] as const satisfies readonly { value: string; label: string; step: CheckoutStep | undefined }[];

type FilterValue = (typeof FILTERS)[number]['value'];

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function CheckoutSessionsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [filter, setFilter] = useState<FilterValue>('all');
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(1);
  const [take, setTake] = useState<number>(50);

  const activeFilter = FILTERS.find((entry) => entry.value === filter) ?? FILTERS[0];
  const skip = (page - 1) * pageSize;
  const filtered = filter !== 'all';

  const { data, isLoading, isFetching, dataUpdatedAt, error, refetch } = useCheckoutSessions({
    step: activeFilter.step,
    take,
    skip,
  });

  const rows = data?.items ?? [];
  const total = data?.total;

  const resetWindow = () => {
    setPage(1);
    setTake(pageSize);
  };

  const open = (row: CheckoutRow, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('commerce.checkout-session.detail', { id: row.id }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Checkout sessions list controls"
        filters={[
          {
            label: 'Show',
            key: 'step',
            value: filter,
            onValueChange: (next) => {
              setFilter((next as FilterValue | null) ?? 'all');
              resetWindow();
            },
            options: FILTERS,
          },
        ]}
        // The step is the only thing narrowing this list, and the bar already
        // holds it.
        views={{ target: '/commerce/checkout-sessions' }}
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
        {error ? (
          <EmptyState
            icon={<Icon glyph={faCreditCard} className="size-6" aria-hidden />}
            title="Could not load checkout sessions"
            description="This is a problem reaching the server. Your sales are unaffected — nothing has been lost."
          />
        ) : isLoading ? (
          <PaneWaiting label="Loading checkout sessions…" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Icon glyph={faCreditCard} className="size-6" aria-hidden />}
            title={filtered ? 'Nothing at this step' : 'No checkout sessions'}
            description={
              filtered
                ? `No sessions are at “${activeFilter.label}” right now. Switch back to All to see the rest.`
                : 'When a shopper starts paying, their progress shows up here — useful for spotting where a payment got stuck.'
            }
          />
        ) : (
          <Table size="sm" hover>
            <thead>
              <tr>
                <th>Shopper</th>
                <th className="hidden @2xl:table-cell">Started</th>
                <th className="hidden @xl:table-cell">Where they got to</th>
                <th className="text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const state = checkoutState(row.step);
                return (
                  <tr
                    key={row.id}
                    className="cursor-pointer"
                    tabIndex={0}
                    role="button"
                    onClick={(event) => {
                      open(row, event);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      open(row, event);
                    }}
                  >
                    <td className="max-w-48 truncate">{row.customerEmail ?? 'Guest shopper'}</td>
                    <td className="hidden text-sm @2xl:table-cell">
                      {formatDateTime(row.createdAt)}
                    </td>
                    <td className="hidden @xl:table-cell">
                      <Badge color={state.tone} variant="soft" size="sm">
                        {state.label}
                      </Badge>
                    </td>
                    <td className="text-right font-medium tabular-nums">
                      {formatMoney(row.totalCents / 100, row.currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

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
        <p className="hidden px-1 pb-1 text-sm @xl:block">
          Click to open · Shift-click alongside · Alt-click new window
        </p>
      </div>
    </div>
  );
}
