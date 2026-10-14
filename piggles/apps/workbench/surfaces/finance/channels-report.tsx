'use client';

// The channels report once it has loaded: the headline with a proportional bar
// per channel, then the figures in full, because an owner needs the numbers.

import { Card, Heading, Progress, Text } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import type { ChannelRow, ChannelsReport } from './channels-data';
import { ordersLine, unreceivedLine } from './channels-words';
import { channelLabel, formatMoney, formatMoneyCompact } from './format';

type Totals = ChannelsReport['totals'];

function sharePct(value: number, total: number): string {
  if (total <= 0) return '0%';
  return `${String(Math.round((value / total) * 100))}%`;
}

function SummaryCard(props: {
  rangeLabel: string | undefined;
  rows: ChannelRow[];
  totals: Totals;
  currency: string;
}) {
  const { rows, totals, currency } = props;
  const topNet = rows.reduce((m, r) => Math.max(m, r.net), 0);
  const measurement = { ...totals, places: rows.length };
  const unreceived = unreceivedLine(measurement, (amount) => formatMoney(amount, currency));
  return (
    <Card className="p-4">
      <Text className="text-sm">Money received in the last {props.rangeLabel}</Text>
      <Heading level={2} className="mt-1 text-3xl font-semibold tabular-nums">
        {formatMoney(totals.net, currency)}
      </Heading>
      <Text className="mt-1 text-sm">{ordersLine(measurement)}</Text>
      {/* What happened to the rest of the money. Shown at every width,
          because the columns that carry the same facts are not. */}
      {unreceived === null ? null : <Text className="mt-1 text-sm">{unreceived}</Text>}

      <div className="mt-4 flex flex-col gap-3">
        {rows.map((r) => (
          <div key={r.key} className="grid grid-cols-[9rem_1fr_auto] items-center gap-3 text-sm">
            <span className="truncate">{channelLabel(r.channel, r.source)}</span>
            <Progress
              color="module"
              value={r.net}
              max={topNet}
              aria-label={`${channelLabel(r.channel, r.source)}: ${formatMoney(r.net, currency)}`}
            />
            <span className="text-right font-medium tabular-nums">
              {formatMoneyCompact(r.net, currency)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// The columns reconcile: Sales − Refunds − Still owed = Received. Without
// "Still owed", unpaid orders made the three figures disagree with no reason given.
function ChannelFigures({
  r,
  currency,
}: {
  r: Omit<ChannelRow, 'key' | 'channel' | 'source'>;
  currency: string;
}) {
  return (
    <>
      <td className="text-right tabular-nums">{r.orders}</td>
      <td className="hidden text-right tabular-nums @lg:table-cell">
        {formatMoney(r.gross, currency)}
      </td>
      <td className="hidden text-right tabular-nums @xl:table-cell">
        {r.owed > 0 ? formatMoney(r.owed, currency) : '—'}
      </td>
      <td className="hidden text-right tabular-nums @2xl:table-cell">
        {r.refunds > 0 ? `−${formatMoney(r.refunds, currency)}` : '—'}
      </td>
    </>
  );
}

function NumbersTable(props: { rows: ChannelRow[]; totals: Totals; currency: string }) {
  const { rows, totals, currency } = props;
  return (
    // One column arrives per step: Sales @lg, Still owed @xl, Refunds @2xl. Still
    // owed comes first: it is bigger on a shop that invoices, and still an action.
    <Table size="sm">
      <thead>
        <tr>
          <th>Where</th>
          <th className="text-right">Orders</th>
          <th className="hidden text-right @lg:table-cell">Sales</th>
          <th className="hidden text-right @xl:table-cell">Still owed</th>
          <th className="hidden text-right @2xl:table-cell">Refunds</th>
          <th className="text-right">Received</th>
          <th className="text-right">Share</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <td className="font-medium">{channelLabel(r.channel, r.source)}</td>
            <ChannelFigures r={r} currency={currency} />
            <td className="text-right font-medium tabular-nums">{formatMoney(r.net, currency)}</td>
            <td className="text-right tabular-nums">{sharePct(r.net, totals.net)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-base-300 border-t font-medium">
          <td>All places</td>
          <ChannelFigures r={totals} currency={currency} />
          <td className="text-right tabular-nums">{formatMoney(totals.net, currency)}</td>
          <td className="text-right tabular-nums">100%</td>
        </tr>
      </tfoot>
    </Table>
  );
}

export function ChannelsReportView(props: {
  rangeLabel: string | undefined;
  rows: ChannelRow[];
  totals: Totals;
  currency: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <SummaryCard {...props} />

      {/* The figures in full: a breakdown, not a tease. */}
      <Card className="overflow-hidden">
        <header className="border-base-300 border-b px-4 py-3">
          <Heading level={3} className="text-base font-semibold">
            The numbers
          </Heading>
          {/* Which column the percentage divides: beside a sales figure four
              times the size, "Share" alone reads as share of sales. */}
          <Text className="mt-1 text-sm">Share is of money received, not of what was sold.</Text>
        </header>
        <NumbersTable rows={props.rows} totals={props.totals} currency={props.currency} />
      </Card>
    </div>
  );
}
