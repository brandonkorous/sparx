'use client';

// Cores owed: every rebuilt part whose old part has not come back yet (persona
// issues 051 and 057).
//
// A parts counter asks this list two questions: who still owes me old parts, and
// which of those have been out too long. So the chips are AGE, not status, and the
// money is what would go back if every deposit came in.
//
// Two kinds of line sit here. A DEPOSIT line shipped and holds money until its
// old part returns. A SEND-FIRST line holds no money: the customer is sending the
// old part before the part ships, so the row says it ships when the old part
// arrives, and it never prints a deposit of "$0.00" (that would read as a deposit
// of nothing owed back). Each row carries the same moves as its order
// (core-line-words.ts), so a box of old parts can be ticked off from here, and
// opening the row opens the order.

import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Filter,
  FilterItem,
  Table,
  Text,
} from '@wizeworks/silicaui-react';
import { RotateCcw } from 'lucide-react';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { RowOpenHint } from '../../components/row-open-hint';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { formatDate } from './data';
import { coreLineOfOwed, useCoresOwed, type CoreOwed } from './cores-data';
import { coresSummary, depositBackText, plural, type CoreMove } from './core-line-words';
import { CoreBadges, CoreMoveButtons, CoreMoveDialog } from './order-cores';
import { useCoreChoices } from './core-choices-data';

const FILTERS = [
  { value: 'all', label: 'All owed', olderThanDays: undefined },
  { value: '30', label: 'Out over 30 days', olderThanDays: 30 },
  { value: '60', label: 'Out over 60 days', olderThanDays: 60 },
] as const;

type FilterValue = (typeof FILTERS)[number]['value'];

/** The most the server returns in one read; said on screen when it is reached. */
const LIMIT = 200;

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
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
      <PaneToolbar
        label="Cores owed controls"
        controls={
          <Filter
            color="module"
            value={filter}
            onValueChange={(next) => {
              setFilter((next as FilterValue | null) ?? 'all');
            }}
            showReset={false}
            aria-label="Filter cores owed by age"
          >
            {FILTERS.map((entry) => (
              <FilterItem key={entry.value} value={entry.value}>
                {entry.label}
              </FilterItem>
            ))}
          </Filter>
        }
        refresh={
          <RefreshButton
            className="ml-auto"
            isFetching={isFetching}
            updatedAt={data ? dataUpdatedAt : undefined}
            onRefresh={() => {
              void refetch();
            }}
          />
        }
      />

      {rows.length > 0 ? <Text className="shrink-0 px-1">{coresSummary(rows, LIMIT)}</Text> : null}

      <Card className="min-h-0 flex-1 overflow-y-auto">
        {error ? (
          <EmptyState
            icon={<RotateCcw className="size-6" aria-hidden />}
            title="Could not load the cores owed"
            description="This is a problem reaching the server. Nothing has changed on any order."
          />
        ) : isLoading ? (
          <p className="p-4 text-sm" role="status">
            Loading cores owed…
          </p>
        ) : rows.length === 0 ? (
          <NoCoresOwed ctx={ctx} filter={filter} label={active.label} />
        ) : (
          <Table size="sm" hover>
            <thead>
              <tr>
                <th>Order</th>
                <th className="hidden @lg:table-cell">Customer</th>
                <th>Part</th>
                <th className="text-right">Owed</th>
                <th className="hidden text-right @xl:table-cell">Deposit back</th>
                <th>Out for</th>
                <th className="hidden @3xl:table-cell">
                  <span className="sr-only">What to do</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <CoreRow
                  key={row.orderItemId}
                  row={row}
                  onOpen={(event) => {
                    open(row, event);
                  }}
                  onMove={(move) => {
                    setActing({ row, move });
                  }}
                />
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {rows.length > 0 ? (
        <div className="shrink-0">
          <RowOpenHint />
        </div>
      ) : null}

      {/* Outside the table: a click inside a dialog bubbles up the React tree, and
          a dialog drawn inside a row would open the order on every click. */}
      {acting ? (
        <CoreMoveDialog
          line={coreLineOfOwed(acting.row)}
          move={acting.move}
          onClose={() => {
            setActing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function CoreRow({
  row,
  onOpen,
  onMove,
}: {
  row: CoreOwed;
  onOpen: (event: { shiftKey: boolean; altKey: boolean }) => void;
  onMove: (move: CoreMove) => void;
}) {
  const line = coreLineOfOwed(row);
  return (
    <tr
      className="cursor-pointer"
      tabIndex={0}
      role="button"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen(event);
      }}
    >
      <td className="font-mono text-sm">
        {row.orderNumber}
        <span className="block font-sans text-sm @lg:hidden">{row.customerName}</span>
      </td>
      <td className="hidden max-w-48 truncate @lg:table-cell">
        {row.customerName}
        {row.companyName ? <span className="block text-sm">{row.companyName}</span> : null}
      </td>
      <td className="max-w-64">
        <span className="block truncate">{row.name}</span>
        <span className="block font-mono text-sm">{row.sku}</span>
        {row.coreFirst ? (
          <span className="mt-1 flex flex-wrap gap-1">
            <CoreBadges line={line} />
          </span>
        ) : null}
      </td>
      <td className="text-right tabular-nums">
        {row.coresOwed} of {row.quantity}
      </td>
      <td className="hidden text-right tabular-nums @xl:table-cell">{depositBackText(row)}</td>
      <td>
        <Badge
          color={row.daysOut > 60 ? 'error' : row.daysOut > 30 ? 'warning' : 'info'}
          variant="soft"
          size="sm"
          title={`Ordered ${formatDate(row.placedAt)}`}
        >
          {plural(row.daysOut, 'day', 'days')}
        </Badge>
      </td>
      <td className="hidden @3xl:table-cell">
        <span className="flex flex-wrap justify-end gap-1">
          <CoreMoveButtons line={line} onMove={onMove} stopPropagation />
        </span>
      </td>
    </tr>
  );
}

/** Two empties, two sentences: nothing owed at all, or nothing that old. And
 *  when the business still sells core charges as a choice from its old store,
 *  this is where it finds out, because those sales never reach this list. */
function NoCoresOwed({
  ctx,
  filter,
  label,
}: {
  ctx: SurfaceContext;
  filter: FilterValue;
  label: string;
}) {
  const choices = useCoreChoices();
  const waiting = (choices.data ?? []).length;
  if (filter !== 'all') {
    return (
      <EmptyState
        icon={<RotateCcw className="size-6" aria-hidden />}
        title="None out that long"
        description={`No cores have been out ${label.toLowerCase().replace('out ', '')}. Switch back to All owed to see the rest.`}
      />
    );
  }
  return (
    <EmptyState
      icon={<RotateCcw className="size-6" aria-hidden />}
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
