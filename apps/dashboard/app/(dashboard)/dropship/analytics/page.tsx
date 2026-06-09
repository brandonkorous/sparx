import type { Metadata } from 'next';
import Link from 'next/link';
import { serverFetch } from '@/lib/server-fetch';
import { PageHeader } from '@/components/page-header';
import { formatMoney } from '@/lib/format';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Text,
  Card,
  CardContent,
  Stack,
} from '@sparx/ui';

export const metadata: Metadata = { title: 'Profitability — Dropship' };

interface SupplierRow {
  supplierId: string;
  supplierName: string;
  orders: number;
  costCents: number;
  revenueCents: number;
  profitCents: number;
  marginPct: number;
}

interface Summary {
  totalOrders: number;
  costCents: number;
  revenueCents: number;
  profitCents: number;
  marginPct: number;
  bySupplier: SupplierRow[];
}

interface OrderRow {
  id: string;
  orderId: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  status: string;
  costCents: number;
  revenueCents: number;
  profitCents: number;
  marginPct: number;
  createdAt: string;
}

interface PagedOrders {
  data: OrderRow[];
  total: number;
}

function marginColor(pct: number): 'success' | 'warning' | 'danger' | 'neutral' {
  if (pct >= 30) return 'success';
  if (pct >= 15) return 'warning';
  if (pct >= 0) return 'neutral';
  return 'danger';
}

export default async function DropshipAnalyticsPage() {
  const [summary, orders] = await Promise.all([
    serverFetch<{ data: Summary }>('/v1/dropship/analytics').then((r) => r.data),
    serverFetch<PagedOrders>('/v1/dropship/analytics/orders?take=50').then((r) => r),
  ]);

  const profit = summary.profitCents;
  const isLoss = profit < 0;

  return (
    <div>
      <PageHeader title="Profitability" description="Cost vs. revenue across all dropship orders" />

      {/* Summary cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Revenue" value={formatMoney(summary.revenueCents)} />
        <SummaryCard label="Cost" value={formatMoney(summary.costCents)} />
        <SummaryCard
          label="Profit"
          value={formatMoney(Math.abs(profit))}
          valueClass={isLoss ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}
          prefix={isLoss ? '−' : '+'}
        />
        <SummaryCard
          label="Margin"
          value={`${summary.marginPct}%`}
          valueClass={
            summary.marginPct >= 20
              ? 'text-[var(--color-success)]'
              : summary.marginPct >= 0
                ? 'text-[var(--color-warning)]'
                : 'text-[var(--color-danger)]'
          }
        />
      </div>

      {/* Per-supplier breakdown */}
      <Stack gap={6}>
        <div>
          <Text size="lg" className="mb-4 font-semibold">
            By supplier
          </Text>
          {summary.bySupplier.length === 0 ? (
            <Text className="text-[var(--color-muted-foreground)]">
              No fulfilled dropship orders yet.
            </Text>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.bySupplier.map((row) => (
                  <TableRow key={row.supplierId}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/dropship/suppliers/${row.supplierId}/catalog`}
                        className="hover:underline"
                      >
                        {row.supplierName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">{row.orders}</TableCell>
                    <TableCell className="text-right">{formatMoney(row.revenueCents)}</TableCell>
                    <TableCell className="text-right">{formatMoney(row.costCents)}</TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          row.profitCents >= 0
                            ? 'text-[var(--color-success)]'
                            : 'text-[var(--color-danger)]'
                        }
                      >
                        {row.profitCents < 0 ? '−' : '+'}
                        {formatMoney(Math.abs(row.profitCents))}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge color={marginColor(row.marginPct)} variant="soft" size="sm">
                        {row.marginPct}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Per-order detail */}
        <div>
          <Text size="lg" className="mb-4 font-semibold">
            Recent orders
          </Text>
          {orders.data.length === 0 ? (
            <Text className="text-[var(--color-muted-foreground)]">No orders yet.</Text>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.data.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Link
                          href={`/commerce/orders/${row.orderId}`}
                          className="font-mono text-sm hover:underline"
                        >
                          #{row.orderNumber}
                        </Link>
                      </TableCell>
                      <TableCell>{row.supplierName}</TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="text-right">{formatMoney(row.revenueCents)}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.costCents)}</TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            row.profitCents >= 0
                              ? 'text-[var(--color-success)]'
                              : 'text-[var(--color-danger)]'
                          }
                        >
                          {row.profitCents < 0 ? '−' : '+'}
                          {formatMoney(Math.abs(row.profitCents))}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge color={marginColor(row.marginPct)} variant="soft" size="sm">
                          {row.marginPct}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Text size="sm" className="text-[var(--color-muted-foreground)]">
                          {new Date(row.createdAt).toLocaleDateString()}
                        </Text>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {orders.total > 50 && (
                <Text size="sm" className="mt-3 text-[var(--color-muted-foreground)]">
                  Showing 50 of {orders.total} orders.
                </Text>
              )}
            </>
          )}
        </div>
      </Stack>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  valueClass,
  prefix,
}: {
  label: string;
  value: string;
  valueClass?: string;
  prefix?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <Text size="xs" className="mb-1 font-medium text-[var(--color-muted-foreground)]">
          {label}
        </Text>
        <p className={`text-2xl font-semibold tracking-tight ${valueClass ?? ''}`}>
          {prefix}
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: 'success' | 'warning' | 'danger' | 'neutral'; label: string }> = {
    submitted: { color: 'warning', label: 'Submitted' },
    shipped: { color: 'neutral', label: 'Shipped' },
    delivered: { color: 'success', label: 'Delivered' },
    failed: { color: 'danger', label: 'Failed' },
  };
  const { color, label } = map[status] ?? { color: 'neutral' as const, label: status };
  return (
    <Badge color={color} variant="soft" size="sm">
      {label}
    </Badge>
  );
}
