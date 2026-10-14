'use client';

// WHAT IS OVERDUE: the orders that should have arrived and have not. The platform
// knows the due date and that nothing was received, so nobody should learn of it
// from a customer asking for the part.

// Sorted by money still outstanding, not by lateness: the one worth ringing about
// is the one with most value at stake. Days late is a column, not the order.

// Two things it refuses to imply: that an empty list means a punctual supply chain
// (undated orders are counted at the top), and that a typed date and one derived
// from a lead time mean the same (each row says which it is).

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Card,
  EmptyState,
  Text,
} from '@wizeworks/silicaui-react';
import { faBoxMagnifyingGlass, faCalendarClock } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { formatCents, plural } from './data';
import { useLatePurchaseOrders } from './supplier-performance-data';
import { InlineWaiting } from '../../components/inline-waiting';
import { LateOrdersTable } from './late-orders-table';

type Report = ReturnType<typeof useLatePurchaseOrders>;
type OpenOrder = (id: string, event: { shiftKey: boolean; altKey: boolean }) => void;

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

function LateOrdersBody({ report, onOpen }: { report: Report; onOpen: OpenOrder }) {
  const rows = report.data?.items ?? [];
  const undated = report.data?.undated ?? 0;
  if (report.isError) {
    return (
      <PaneLoadError
        icon={<Icon glyph={faBoxMagnifyingGlass} className="size-6" aria-hidden />}
        title="Could not check what is overdue"
        description="This is a problem reaching the server, not a finding about your orders. Try again in a moment."
        error={report.error}
      />
    );
  }
  if (report.isLoading) {
    return <InlineWaiting label="Checking what is overdue…" />;
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Icon glyph={faCalendarClock} className="size-6" aria-hidden />}
        title="Nothing is overdue"
        description={
          undated > 0
            ? 'Every order with a date on it is either here on time or already in. The orders with no date at all are counted above. Those cannot be late, which is not the same as being on time.'
            : 'Every order you have placed is either still inside its promised date or already received.'
        }
      />
    );
  }
  return <LateOrdersTable rows={rows} onOpen={onOpen} />;
}

function UndatedOrdersAlert({ undated }: { undated: number }) {
  if (undated <= 0) return null;
  return (
    <Alert color="warning">
      <AlertContent>
        <AlertTitle>
          {plural(undated, 'open order has', 'open orders have')} no expected date
        </AlertTitle>
        <AlertDescription>
          An order with no date cannot appear here, because nothing says when it should have
          arrived, and that is not the same as being on time. Put a date on the order, or record a
          delivery time against the supplier, and it starts being checked.
        </AlertDescription>
      </AlertContent>
    </Alert>
  );
}

export function LateOrdersSurface({ ctx }: { ctx: SurfaceContext }) {
  const report = useLatePurchaseOrders();
  const rows = report.data?.items ?? [];
  const totalAtStake = rows.reduce((sum, row) => sum + row.valueOutstandingCents, 0);

  const open: OpenOrder = (id, event) => {
    ctx.open('inventory.purchase-orders.detail', { id }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Overdue deliveries controls"
        status={
          <Text className="text-sm">
            {rows.length === 0
              ? 'Nothing overdue'
              : `${formatCents(totalAtStake)} of stock is late across ${plural(rows.length, 'order', 'orders')}`}
          </Text>
        }
        statusReady={!report.isLoading}
        statusFailed={report.isError}
        refresh={
          <RefreshButton
            isFetching={report.isFetching}
            updatedAt={report.data ? report.dataUpdatedAt : undefined}
            onRefresh={() => {
              void report.refetch();
            }}
          />
        }
      />

      <UndatedOrdersAlert undated={report.data?.undated ?? 0} />

      <Card className="min-h-0 flex-1 overflow-auto">
        <LateOrdersBody report={report} onOpen={open} />
      </Card>
    </div>
  );
}
