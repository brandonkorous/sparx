'use client';

// WHAT IS OVERDUE — the orders that should have arrived and have not.
//
// A business normally finds out an order is late in one of two ways: a customer
// asks for the part, or somebody happens to scroll past it. Both are too late,
// and both are avoidable, because the platform already knows the date the goods
// were due and knows nothing has been received against them.
//
// ── Sorted by money, not by lateness ──────────────────────────────────────
//
// Eleven overdue orders is a list nobody works through. The one worth ringing
// about is the one with the most value still outstanding, so that is the sort —
// days late is a column, not the order.
//
// ── Two things this screen refuses to imply ───────────────────────────────
//
// That an empty list means a punctual supply chain: orders nobody set a date for
// cannot be late, so their count is stated at the top rather than quietly
// omitted. And that a due date means the same thing however it was arrived at —
// a date the buyer typed is a promise they can quote back, while one derived
// from a stated lead time is an assumption, so each row says which it is.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Card,
  EmptyState,
  Text,
} from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { faBoxMagnifyingGlass, faCalendarClock } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { formatCents, plural } from './data';
import { formatDay, formatMoment } from './purchase-orders-data';
import { latenessTone, useLatePurchaseOrders } from './supplier-performance-data';
import { InlineWaiting } from '../../components/inline-waiting';
import { useBusinessZone } from '../../lib/business-timezone';
import { daysPastDue } from '../../lib/console/days';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function LateOrdersSurface({ ctx }: { ctx: SurfaceContext }) {
  const report = useLatePurchaseOrders();
  // HOW LATE, COUNTED IN CALENDAR DAYS, IN THE SHOP'S OWN ZONE.
  //
  // The server counts elapsed seconds and divides by 86,400, in UTC. An order
  // due on the 10th, read on the evening of the 18th in Los Angeles, came back
  // as "9 days" because in UTC it was already the 19th. The number a buyer
  // quotes down the phone must be the number she would count off her own
  // calendar. `lib/console/days.ts` is that rule, already written and already
  // tested, for exactly this reason. The server's own figure is kept as the
  // fallback for an order with no due date to count from.
  const zone = useBusinessZone();
  const now = new Date();
  const lateDays = (row: { dueAt: string; daysLate: number }): number =>
    daysPastDue(row.dueAt, now, zone) ?? row.daysLate;

  const rows = report.data?.items ?? [];
  const undated = report.data?.undated ?? 0;
  const totalAtStake = rows.reduce((sum, row) => sum + row.valueOutstandingCents, 0);

  const open = (id: string, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('inventory.purchase-orders.detail', { id }, { target: targetFor(event) });
  };

  const body = () => {
    if (report.isError) {
      return (
        <EmptyState
          icon={<Icon glyph={faBoxMagnifyingGlass} className="size-6" aria-hidden />}
          title="Could not check what is overdue"
          description="This is a problem reaching the server, not a finding about your orders. Try again in a moment."
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

    return (
      <Table size="sm" hover>
        <thead>
          <tr>
            <th>Order</th>
            <th className="whitespace-nowrap">Overdue by</th>
            <th className="hidden whitespace-nowrap @lg:table-cell">Was due</th>
            <th className="hidden text-right whitespace-nowrap @xl:table-cell">Still to come</th>
            <th className="text-right whitespace-nowrap">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.purchaseOrderId}
              className="cursor-pointer"
              tabIndex={0}
              role="button"
              onClick={(event) => {
                open(row.purchaseOrderId, event);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                open(row.purchaseOrderId, event);
              }}
            >
              <td className="w-full max-w-0 min-w-56">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">
                    <span className="font-mono">{row.number}</span>
                    {' · '}
                    {row.supplierName ?? 'Unnamed supplier'}
                  </span>
                  <span className="truncate text-sm">
                    {/* Which date they are being judged against, because it
                        changes what a buyer can say on the phone. */}
                    {row.dueSource === 'expected_arrival'
                      ? 'against the date on the order'
                      : 'against their usual delivery time'}
                    {/* "Flagged" is what the code calls it; it means nothing to the
                        person reading this, and reads like a chore they have
                        missed. Say who actually hears about it: the late-order
                        event has exactly one consumer, the webhooks under Tell
                        other software. Nobody in the business is emailed or
                        notified, so the phrase must not imply they were. Both
                        halves are shown, or the meaning only ever lives in the
                        absence of the words. */}
                    {row.alertedAt === null
                      ? ' · not passed to your other software yet'
                      : ' · passed to your other software'}
                  </span>
                </span>
              </td>
              <td className="whitespace-nowrap">
                <Badge color={latenessTone(lateDays(row))} variant="soft" size="sm">
                  {plural(lateDays(row), 'day', 'days')}
                </Badge>
              </td>
              <td className="hidden whitespace-nowrap @lg:table-cell">
                {/* The date itself, not "2 weeks ago". "Overdue by" beside it
                    already says how long; this is the one a buyer quotes down
                    the phone, and it was the only column that did not carry
                    it.

                    Not `<Timestamp format="absolute">`: that is "5:00 PM" on
                    anything less than a day old, which is not a date at all, and
                    it prints a stored day on the READER's clock, which is the
                    day before for everyone west of Greenwich. The date on an
                    order is a DAY; a date worked out from how long a supplier
                    usually takes is an instant, and each gets the formatter that
                    is true for it. */}
                {row.dueSource === 'expected_arrival'
                  ? formatDay(row.dueAt)
                  : formatMoment(row.dueAt)}
              </td>
              <td className="hidden text-right tabular-nums @xl:table-cell">
                {row.unitsOutstanding}
              </td>
              <td className="text-right tabular-nums">{formatCents(row.valueOutstandingCents)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
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

      {undated > 0 ? (
        <Alert color="warning">
          <AlertContent>
            <AlertTitle>
              {plural(undated, 'open order has', 'open orders have')} no expected date
            </AlertTitle>
            <AlertDescription>
              An order with no date cannot appear here, because nothing says when it should have
              arrived, and that is not the same as being on time. Put a date on the order, or record
              a delivery time against the supplier, and it starts being checked.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      <Card className="min-h-0 flex-1 overflow-auto">{body()}</Card>
    </div>
  );
}
