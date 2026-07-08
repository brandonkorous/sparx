// Channel revenue consolidation surface (docs/27 §8) — the financial rollup, now in
// Finance → Channels (docs/110 Slice 4b). Server components — no interactivity beyond
// links, so the channel drill is a plain `?channel=` query that stays within
// /finance/channels. Reads the consolidated report from GET
// /v1/commerce/reports/channel-revenue: every native channel + each connected
// marketplace as its own line, with gross, channel fees, net-after-fees, AOV, and
// share of total.

import Link from 'next/link';
import { Badge, Card, CardBody, Table } from 'silicaui-react';

import type { ChannelRevenueReport, ChannelTopProduct } from '../_types';

function fmtCents(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardBody className="p-5">
        <p className="text-base-content/60 mb-1 text-xs font-medium">{label}</p>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
      </CardBody>
    </Card>
  );
}

export function ChannelRevenuePanel({
  report,
  selectedChannel,
}: {
  report: ChannelRevenueReport;
  selectedChannel?: string;
}) {
  const { currency } = report;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Gross revenue" value={fmtCents(report.totalGrossRevenueCents, currency)} />
        <StatCard label="Orders" value={report.totalOrders.toLocaleString()} />
        <StatCard label="Channel fees" value={fmtCents(report.totalChannelFeeCents, currency)} />
        <StatCard
          label="Net after fees"
          value={fmtCents(report.totalNetAfterFeesCents, currency)}
        />
      </div>
      <Table>
        <thead>
          <tr>
            <th>Channel</th>
            <th className="text-right">Orders</th>
            <th className="text-right">Gross</th>
            <th className="text-right">Fees</th>
            <th className="text-right">Net</th>
            <th className="text-right">AOV</th>
            <th className="text-right">Share</th>
          </tr>
        </thead>
        <tbody>
          {report.byChannel.map((row) => {
            const active = row.channel === selectedChannel;
            return (
              <tr key={row.channel} className={active ? 'bg-base-200' : undefined}>
                <td className="font-medium">
                  <Link
                    href={`/finance/channels?channel=${encodeURIComponent(row.channel)}#channel-top-products`}
                    className="hover:underline"
                    aria-current={active ? 'true' : undefined}
                  >
                    {row.label}
                  </Link>
                </td>
                <td className="text-right">{row.orders.toLocaleString()}</td>
                <td className="text-right">{fmtCents(row.grossRevenueCents, currency)}</td>
                <td className="text-base-content/60 text-right">
                  {row.channelFeeCents > 0 ? fmtCents(row.channelFeeCents, currency) : '—'}
                </td>
                <td className="text-right">{fmtCents(row.netAfterFeesCents, currency)}</td>
                <td className="text-right">{fmtCents(row.averageOrderValueCents, currency)}</td>
                <td className="text-right">{row.sharePct}%</td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}

export function ChannelTopProductsPanel({
  label,
  products,
  currency,
}: {
  label: string;
  products: ChannelTopProduct[];
  currency: string;
}) {
  return (
    <div className="flex flex-col gap-4" id="channel-top-products">
      <div className="flex items-center gap-2">
        <p className="text-lg font-semibold">Top products</p>
        <Badge color="info" variant="soft" size="sm">
          {label}
        </Badge>
      </div>
      {products.length === 0 ? (
        <p className="text-base-content/70 text-sm">No sales on {label} in the last 30 days yet.</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Product</th>
              <th className="text-right">Units</th>
              <th className="text-right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.productId || p.productTitle}>
                <td className="font-medium">{p.productTitle}</td>
                <td className="text-right">{p.unitsSold.toLocaleString()}</td>
                <td className="text-right">{fmtCents(p.revenueCents, currency)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
