'use client';

// Cores owed: rebuilt parts whose old part has not come in (issues 051, 057). The
// chips are AGE. A row opens the order; its moves are on the row as well.

import { useState } from 'react';
import { Button, Card, EmptyState, Text } from '@wizeworks/silicaui-react';
import { faRotateLeft } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { PaneWaiting } from '../../components/pane-waiting';
import { RefreshButton } from '../../components/refresh-button';
import { RowOpenHint } from '../../components/row-open-hint';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { coreLineOfOwed, plural, useCoresOwed, type CoreOwed } from './cores-data';
import { coresSummary, type CoreMove } from './core-line-words';
import { CoreMoveDialog } from './order-cores';
import { useCoreChoices } from './core-choices-data';
import { CoresTable } from './cores-table';

const FILTERS = [
  { value: 'all', label: 'All owed', olderThanDays: undefined },
  { value: '30', label: 'Out over 30 days', olderThanDays: 30 },
  { value: '60', label: 'Out over 60 days', olderThanDays: 60 },
] as const;

type FilterValue = (typeof FILTERS)[number]['value'];
type Filter = (typeof FILTERS)[number];

/** The most the server returns in one read; said on screen when it is reached. */
const LIMIT = 200;

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/** Products still selling the core charge as a choice never reach this list, so
 *  the empty list says so and opens the screen that changes them. */
function CoresEmpty({ ctx, filter }: { ctx: SurfaceContext; filter: Filter }) {
  const waiting = (useCoreChoices().data ?? []).length;
  if (filter.value !== 'all') {
    return (
      <EmptyState
        icon={<Icon glyph={faRotateLeft} className="size-6" aria-hidden />}
        title="None out that long"
        description={`No cores have been out ${filter.label.toLowerCase().replace('out ', '')}. Switch back to All owed to see the rest.`}
      />
    );
  }
  return (
    <EmptyState
      icon={<Icon glyph={faRotateLeft} className="size-6" aria-hidden />}
      title="No cores owed"
      description={
        waiting > 0
          ? `${plural(waiting, 'product sells', 'products sell')} the core charge as a choice the way your old store did, so those sales hold no deposit and never show here. Change them to a real core deposit first.`
          : 'When you sell a rebuilt part with a core deposit, or a buyer sends the old part first, it shows here until the old part comes in or you keep the deposit.'
      }
      actions={
        waiting > 0 ? (
          <Button
            size="sm"
            color="module"
            onClick={() => {
              ctx.open('commerce.core-choices.list', undefined, { target: 'tab' });
            }}
          >
            See the {plural(waiting, 'product', 'products')}
          </Button>
        ) : undefined
      }
    />
  );
}

function CoresBody({
  ctx,
  failed,
  loading,
  rows,
  filter,
  onOpen,
  onMove,
}: {
  ctx: SurfaceContext;
  failed: boolean;
  loading: boolean;
  rows: CoreOwed[];
  filter: Filter;
  onOpen: (row: CoreOwed, event: { shiftKey: boolean; altKey: boolean }) => void;
  onMove: (row: CoreOwed, move: CoreMove) => void;
}) {
  if (failed) {
    return (
      <EmptyState
        icon={<Icon glyph={faRotateLeft} className="size-6" aria-hidden />}
        title="Could not load the cores owed"
        description="This is a problem reaching the server. Nothing has changed on any order."
      />
    );
  }
  if (loading) return <PaneWaiting label="Loading cores owed…" />;
  if (rows.length === 0) return <CoresEmpty ctx={ctx} filter={filter} />;
  return <CoresTable rows={rows} onOpen={onOpen} onMove={onMove} />;
}

function CoresToolbar({
  filter,
  onFilter,
  isFetching,
  updatedAt,
  onRefresh,
}: {
  filter: FilterValue;
  onFilter: (next: FilterValue) => void;
  isFetching: boolean;
  updatedAt: number | undefined;
  onRefresh: () => void;
}) {
  return (
    <PaneToolbar
      label="Cores owed controls"
      filters={[
        {
          label: 'Show',
          key: 'olderThanDays',
          value: filter,
          onValueChange: (next) => {
            onFilter((next as FilterValue | null) ?? 'all');
          },
          options: FILTERS,
        },
      ]}
      views={{ target: '/commerce/cores' }}
      refresh={
        <RefreshButton isFetching={isFetching} updatedAt={updatedAt} onRefresh={onRefresh} />
      }
    />
  );
}

export function CoresListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [filter, setFilter] = useState<FilterValue>('all');
  const [acting, setActing] = useState<{ row: CoreOwed; move: CoreMove } | null>(null);
  const active = FILTERS.find((entry) => entry.value === filter) ?? FILTERS[0];
  const { data, isLoading, isFetching, dataUpdatedAt, error, refetch } = useCoresOwed(
    active.olderThanDays === undefined ? {} : { olderThanDays: active.olderThanDays }
  );
  const rows = data ?? [];

  const open = (row: CoreOwed, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('commerce.order.detail', { id: row.orderId }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      <CoresToolbar
        filter={filter}
        onFilter={setFilter}
        isFetching={isFetching}
        updatedAt={data ? dataUpdatedAt : undefined}
        onRefresh={() => {
          void refetch();
        }}
      />
      {rows.length > 0 ? <Text className="shrink-0 px-1">{coresSummary(rows, LIMIT)}</Text> : null}
      <Card className="min-h-0 flex-1 overflow-y-auto">
        <CoresBody
          ctx={ctx}
          failed={Boolean(error)}
          loading={isLoading}
          rows={rows}
          filter={active}
          onOpen={open}
          onMove={(row, move) => {
            setActing({ row, move });
          }}
        />
      </Card>
      {rows.length > 0 ? <RowOpenHint /> : null}
      {acting ? (
        <CoreMoveDialog
          line={coreLineOfOwed(acting.row)}
          move={acting.move}
          onClose={() => setActing(null)}
        />
      ) : null}
    </div>
  );
}
