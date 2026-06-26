// Channel revenue consolidation surface (docs/27 §8). Server components — no
// interactivity beyond links, so the channel drill is a plain `?channel=` query.
// Reads the consolidated report from GET /v1/commerce/reports/channel-revenue:
// every native channel + each connected marketplace as its own line, with gross,
// channel fees, net-after-fees, AOV, and share of total.

import Link from 'next/link';
import {
  Badge,
  Card,
  CardContent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@sparx/ui';

import type { ChannelRevenueReport, ChannelTopProduct } from '../_types';

function fmtCents(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <Text size="xs" className="mb-1 font-medium text-[var(--color-muted-foreground)]">
          {label}
        </Text>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
      </CardContent>
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
    <Stack gap={4}>
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
        <TableHeader>
          <TableRow>
            <TableHead>Channel</TableHead>
            <TableHead className="text-right">Orders</TableHead>
            <TableHead className="text-right">Gross</TableHead>
            <TableHead className="text-right">Fees</TableHead>
            <TableHead className="text-right">Net</TableHead>
            <TableHead className="text-right">AOV</TableHead>
            <TableHead className="text-right">Share</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {report.byChannel.map((row) => {
            const active = row.channel === selectedChannel;
            return (
              <TableRow
                key={row.channel}
                className={active ? 'bg-[var(--color-muted)]' : undefined}
              >
                <TableCell className="font-medium">
                  <Link
                    href={`/settings/channels?channel=${encodeURIComponent(row.channel)}#channel-top-products`}
                    className="hover:underline"
                    aria-current={active ? 'true' : undefined}
                  >
                    {row.label}
                  </Link>
                </TableCell>
                <TableCell className="text-right">{row.orders.toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  {fmtCents(row.grossRevenueCents, currency)}
                </TableCell>
                <TableCell className="text-right text-[var(--color-muted-foreground)]">
                  {row.channelFeeCents > 0 ? fmtCents(row.channelFeeCents, currency) : '—'}
                </TableCell>
                <TableCell className="text-right">
                  {fmtCents(row.netAfterFeesCents, currency)}
                </TableCell>
                <TableCell className="text-right">
                  {fmtCents(row.averageOrderValueCents, currency)}
                </TableCell>
                <TableCell className="text-right">{row.sharePct}%</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Stack>
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
    <Stack gap={4} id="channel-top-products">
      <Stack direction="row" align="center" gap={2}>
        <Text size="lg" className="font-semibold">
          Top products
        </Text>
        <Badge color="info" variant="soft" size="sm">
          {label}
        </Badge>
      </Stack>
      {products.length === 0 ? (
        <Text variant="muted" size="sm">
          No sales on {label} in the last 30 days yet.
        </Text>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Units</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.productId || p.productTitle}>
                <TableCell className="font-medium">{p.productTitle}</TableCell>
                <TableCell className="text-right">{p.unitsSold.toLocaleString()}</TableCell>
                <TableCell className="text-right">{fmtCents(p.revenueCents, currency)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Stack>
  );
}
