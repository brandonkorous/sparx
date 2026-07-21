'use client';

// The discounts list.
//
// A discount is a one-line thing, so it is a row per discount, not a table. Each
// row carries what actually distinguishes one discount from another: whether it
// is a CODE or AUTOMATIC, what it takes off, and — the fact people scan this list
// for — whether it is working right now, scheduled, or ended.

import { useState } from 'react';
import { Badge, Button, Card, EmptyState, SearchInput, Select, Text } from '@wizeworks/silicaui-react';
import { Percent, Plus } from 'lucide-react';
import { useQuery } from '@sparx/query';
import { api } from '../../lib/api/client';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { formatCents } from './products-data';
import { discountState, type DiscountRow } from './discounts-data';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/** What this discount takes off, in the shopper's terms. */
function valueLabel(row: DiscountRow): string {
  switch (row.type) {
    case 'percent':
      return row.valuePercent === null ? 'Percentage off' : `${String(row.valuePercent)}% off`;
    case 'fixed':
      return row.valueCents === null
        ? 'Amount off'
        : `${formatCents(row.valueCents, row.currency ?? 'USD')} off`;
    case 'free_shipping':
      return 'Free delivery';
    case 'buy_x_get_y':
      return 'Buy one, get one';
    case 'bundle':
      return 'Bundle deal';
    default:
      return '';
  }
}

export function DiscountsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const { data, isPending, isError, isFetching, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['commerce', 'discounts', 'list', { q: search, status }],
    queryFn: () =>
      api.list<DiscountRow>('/v1/commerce/discounts', {
        ...(search.trim() ? { q: search.trim() } : {}),
        ...(status !== 'all' ? { status } : {}),
        take: 100,
      }),
    placeholderData: (previous) => previous,
  });

  const rows = data?.items ?? [];

  const open = (id: string, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('commerce.discount.detail', { id }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Discount list controls">
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            size="sm"
            aria-label="Search discounts"
            placeholder="Search by name or code…"
            value={search}
            onValueChange={setSearch}
          />
        </div>
        <div className="hidden w-40 shrink-0 @md:block">
          <Select
            size="sm"
            aria-label="Show which discounts"
            value={status}
            items={{
              all: 'All discounts',
              active: 'Switched on',
              draft: 'Switched off',
              archived: 'Retired',
            }}
            onValueChange={setStatus}
          />
        </div>
        <Button
          color="module"
          size="sm"
          className="ml-auto"
          title="Add a discount — hold Shift to open alongside, Alt for a new window"
          onClick={(event) => {
            ctx.open('commerce.discount.detail', { id: 'new' }, { target: targetFor(event) });
          }}
        >
          <Plus className="size-4" aria-hidden />
          Add a discount
        </Button>
        <RefreshButton
          isFetching={isFetching}
          updatedAt={data ? dataUpdatedAt : undefined}
          onRefresh={() => {
            void refetch();
          }}
        />
      </PaneToolbar>

      <Card className="min-h-0 flex-1 overflow-y-auto">
        {isError ? (
          <EmptyState
            title="Could not load your discounts"
            description="Something went wrong reaching the server. It may be temporary — try again in a moment."
          />
        ) : isPending ? (
          <p className="p-4 text-sm" role="status">
            Loading…
          </p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Percent className="size-6" aria-hidden />}
            title={
              search.trim() || status !== 'all'
                ? 'Nothing matches those filters'
                : 'No discounts yet'
            }
            description={
              search.trim() || status !== 'all'
                ? 'Try a different word, or clear the filters to see everything.'
                : 'A discount reduces the price at checkout — with a code shoppers type, or automatically on any order that qualifies. Add your first one to get started.'
            }
          />
        ) : (
          <ul className="flex flex-col p-1">
            {rows.map((row) => {
              const state = discountState(row);
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    className="hover:bg-base-200 flex w-full flex-wrap items-center gap-2 rounded px-2 py-2 text-left"
                    onClick={(event) => {
                      open(row.id, event);
                    }}
                  >
                    <span className="min-w-0 flex-1 font-semibold">{row.name}</span>
                    {row.code ? (
                      <Badge color="neutral" variant="soft" size="sm" className="font-mono">
                        {row.code}
                      </Badge>
                    ) : (
                      <Badge color="info" variant="soft" size="sm">
                        Automatic
                      </Badge>
                    )}
                    <Text as="span" className="shrink-0 text-sm">
                      {valueLabel(row)}
                    </Text>
                    <Badge color={state.tone} variant="soft" size="sm">
                      {state.label}
                    </Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <p className="shrink-0 px-1 text-xs">
        Click to open · Shift-click to open alongside · Alt-click to open in a new window
      </p>
    </div>
  );
}
