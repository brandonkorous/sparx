export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import { api } from '@/lib/api-rest-client';
import { PageHeader } from '@sparx/ui';
import { Badge, Card, CardBody, Table } from '@wizeworks/silicaui-react';

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

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function marginColor(pct: number): 'success' | 'warning' | 'danger' | 'neutral' {
  if (pct >= 30) return 'success';
  if (pct >= 15) return 'warning';
  if (pct >= 0) return 'neutral';
  return 'danger';
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<
    string,
    { color: 'success' | 'warning' | 'danger' | 'neutral'; label: string }
  > = {
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
      <CardBody className="p-5">
        <p className="text-base-content/70 mb-1 text-xs font-medium">{label}</p>
        <p className={`text-2xl font-semibold tracking-tight ${valueClass ?? ''}`}>
          {prefix}
          {value}
        </p>
      </CardBody>
    </Card>
  );
}

export default async function DropshipAnalyticsPage() {
  const [summary, ordersPage] = await Promise.all([
    api.get<Summary>('/v1/dropship/analytics'),
    api.getPaged<OrderRow[]>('/v1/dropship/analytics/orders?take=50'),
  ]);

  const orders = ordersPage.data;
  const totalOrderCount = (ordersPage.meta as { total?: number }).total ?? orders.length;

  const isLoss = summary.profitCents < 0;

  return (
    <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          icon={<BarChart3 className="h-5 w-5" />}
          title="Profitability"
          description="Cost vs. revenue across all dropship orders"
        />

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryCard label="Revenue" value={formatCents(summary.revenueCents)} />
          <SummaryCard label="Cost" value={formatCents(summary.costCents)} />
          <SummaryCard
            label="Profit"
            value={formatCents(Math.abs(summary.profitCents))}
            valueClass={isLoss ? 'text-danger' : 'text-success'}
            prefix={isLoss ? '−' : '+'}
          />
          <SummaryCard
            label="Margin"
            value={`${summary.marginPct}%`}
            valueClass={
              summary.marginPct >= 20
                ? 'text-success'
                : summary.marginPct >= 0
                  ? 'text-warning'
                  : 'text-danger'
            }
          />
        </div>

        <div className="flex flex-col gap-8">
          {/* Per-supplier breakdown */}
          <div>
            <p className="mb-4 text-lg font-semibold">By supplier</p>
            {summary.bySupplier.length === 0 ? (
              <p className="text-base-content/70">No fulfilled dropship orders yet.</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th className="text-right">Orders</th>
                    <th className="text-right">Revenue</th>
                    <th className="text-right">Cost</th>
                    <th className="text-right">Profit</th>
                    <th className="text-right">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.bySupplier.map((row) => (
                    <tr key={row.supplierId}>
                      <td className="font-medium">
                        <Link
                          href={`/dropship/suppliers/${row.supplierId}/catalog`}
                          className="hover:underline"
                        >
                          {row.supplierName}
                        </Link>
                      </td>
                      <td className="text-right">{row.orders}</td>
                      <td className="text-right">{formatCents(row.revenueCents)}</td>
                      <td className="text-right">{formatCents(row.costCents)}</td>
                      <td className="text-right">
                        <span className={row.profitCents >= 0 ? 'text-success' : 'text-danger'}>
                          {row.profitCents < 0 ? '−' : '+'}
                          {formatCents(Math.abs(row.profitCents))}
                        </span>
                      </td>
                      <td className="text-right">
                        <Badge color={marginColor(row.marginPct)} variant="soft" size="sm">
                          {row.marginPct}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>

          {/* Per-order detail */}
          <div>
            <p className="mb-4 text-lg font-semibold">Recent orders</p>
            {orders.length === 0 ? (
              <p className="text-base-content/70">No orders yet.</p>
            ) : (
              <>
                <Table>
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Supplier</th>
                      <th>Status</th>
                      <th className="text-right">Revenue</th>
                      <th className="text-right">Cost</th>
                      <th className="text-right">Profit</th>
                      <th className="text-right">Margin</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <Link
                            href={`/commerce/orders/${row.orderId}`}
                            className="font-mono text-sm hover:underline"
                          >
                            #{row.orderNumber}
                          </Link>
                        </td>
                        <td>{row.supplierName}</td>
                        <td>
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="text-right">{formatCents(row.revenueCents)}</td>
                        <td className="text-right">{formatCents(row.costCents)}</td>
                        <td className="text-right">
                          <span className={row.profitCents >= 0 ? 'text-success' : 'text-danger'}>
                            {row.profitCents < 0 ? '−' : '+'}
                            {formatCents(Math.abs(row.profitCents))}
                          </span>
                        </td>
                        <td className="text-right">
                          <Badge color={marginColor(row.marginPct)} variant="soft" size="sm">
                            {row.marginPct}%
                          </Badge>
                        </td>
                        <td>
                          <p className="text-base-content/70 text-sm">
                            {new Date(row.createdAt).toLocaleDateString()}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                {totalOrderCount > 50 && (
                  <p className="text-base-content/70 mt-3 text-sm">
                    Showing 50 of {totalOrderCount} orders.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
