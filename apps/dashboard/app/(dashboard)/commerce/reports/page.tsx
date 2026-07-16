import Link from 'next/link';
import { BarChart3 } from 'lucide-react';

import { PageHeader } from '@sparx/ui';
import { Badge, Card, CardBody, Table } from '@wizeworks/silicaui-react';

import { api } from '@/lib/api-rest-client';

export const dynamic = 'force-dynamic';

interface RevenueSummary {
  rangeLabel: string;
  ordersCount: number;
  grossRevenueCents: number;
  refundedCents: number;
  netRevenueCents: number;
  averageOrderValueCents: number;
  currency: string;
}

interface TopProductRow {
  productId: string;
  productTitle: string;
  unitsSold: number;
  revenueCents: number;
}

interface TopCustomerRow {
  customerId: string;
  customerName: string;
  ordersCount: number;
  totalSpentCents: number;
}

interface ConversionFunnel {
  rangeLabel: string;
  sessions: number;
  cartsCreated: number;
  checkoutsStarted: number;
  ordersPlaced: number;
  cartToCheckoutRate: number;
  checkoutToOrderRate: number;
  overallConversion: number;
}

interface AbandonedCartReport {
  rangeLabel: string;
  abandonedCount: number;
  recoveredCount: number;
  recoveryRate: number;
  recoveredRevenueCents: number;
}

interface SubscriptionMetrics {
  activeCount: number;
  mrrCents: number;
  churnedThisPeriod: number;
  newThisPeriod: number;
  currency: string;
}

interface InventoryValuation {
  totalUnits: number;
  totalCostCents: number;
  totalRetailCents: number;
  currency: string;
  asOf: string;
}

const RANGES: { value: string; label: string; days: number }[] = [
  { value: '7d', label: 'Last 7 days', days: 7 },
  { value: '30d', label: 'Last 30 days', days: 30 },
  { value: '90d', label: 'Last 90 days', days: 90 },
  { value: 'ytd', label: 'Year to date', days: -1 },
];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  const rangeSpec = RANGES.find((r) => r.value === rangeParam) ?? RANGES[1]!;
  const range = computeRange(rangeSpec);
  const rangeQs = new URLSearchParams({ from: range.from, to: range.to });
  const topQs = new URLSearchParams({ from: range.from, to: range.to, take: '10' });

  const [revenue, topProducts, topCustomers, funnel, abandonment, subs, inventory] =
    await Promise.all([
      api.get<RevenueSummary>(`/v1/commerce/reports/revenue-summary?${rangeQs.toString()}`),
      api.get<TopProductRow[]>(`/v1/commerce/reports/top-products?${topQs.toString()}`),
      api.get<TopCustomerRow[]>(`/v1/commerce/reports/top-customers?${topQs.toString()}`),
      api.get<ConversionFunnel>(`/v1/commerce/reports/conversion-funnel?${rangeQs.toString()}`),
      api.get<AbandonedCartReport>(`/v1/commerce/reports/abandoned-carts?${rangeQs.toString()}`),
      api.get<SubscriptionMetrics>(`/v1/commerce/reports/subscription-metrics`),
      api.get<InventoryValuation>(`/v1/commerce/reports/inventory-valuation`),
    ]);

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          icon={<BarChart3 className="h-5 w-5" />}
          title="Reports"
          badge={<Badge color="module">{revenue.rangeLabel}</Badge>}
          description="Live queries — no nightly rollup yet. Use the range selector to scope the period; the inventory valuation is always as-of-now since stock on hand is a point-in-time value."
        />

        <div className="flex flex-row flex-wrap gap-2">
          {RANGES.map((r) => (
            <FilterLink key={r.value} current={rangeParam} value={r.value} label={r.label} />
          ))}
        </div>

        <div className="flex flex-row flex-wrap gap-3">
          <Kpi label="Orders" value={revenue.ordersCount.toLocaleString()} />
          <Kpi label="Gross revenue" value={fmt(revenue.grossRevenueCents, revenue.currency)} />
          <Kpi label="Net revenue" value={fmt(revenue.netRevenueCents, revenue.currency)} />
          <Kpi label="AOV" value={fmt(revenue.averageOrderValueCents, revenue.currency)} />
          <Kpi label="Refunded" value={fmt(revenue.refundedCents, revenue.currency)} />
        </div>

        <div className="flex flex-row flex-wrap gap-4">
          <Card className="min-w-[20rem] flex-1">
            <CardBody>
              <div className="flex flex-col gap-1">
                <h3 className="text-xl font-semibold">Conversion funnel</h3>
                <p className="opacity-70">
                  Sessions land once analytics tooling is wired; the rest is from carts +
                  checkout-sessions + orders.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Row label="Carts created" value={funnel.cartsCreated.toLocaleString()} />
                <Row
                  label="Checkouts started"
                  value={`${funnel.checkoutsStarted.toLocaleString()} (${pct(funnel.cartToCheckoutRate)})`}
                />
                <Row
                  label="Orders placed"
                  value={`${funnel.ordersPlaced.toLocaleString()} (${pct(funnel.checkoutToOrderRate)})`}
                />
                <Row label="Cart → order" value={pct(funnel.overallConversion)} bold />
              </div>
            </CardBody>
          </Card>

          <Card className="min-w-[20rem] flex-1">
            <CardBody>
              <div className="flex flex-col gap-1">
                <h3 className="text-xl font-semibold">Abandoned carts</h3>
                <p className="opacity-70">
                  Recovery worker flips <code>recoveredAt</code> when a cart converts. Recovery rate
                  is recovered/(abandoned+recovered) inside the range.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Row label="Abandoned" value={abandonment.abandonedCount.toLocaleString()} />
                <Row label="Recovered" value={abandonment.recoveredCount.toLocaleString()} />
                <Row label="Recovery rate" value={pct(abandonment.recoveryRate)} bold />
                <Row
                  label="Recovered revenue"
                  value={fmt(abandonment.recoveredRevenueCents, revenue.currency)}
                />
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-row flex-wrap gap-4">
          <Card className="min-w-[20rem] flex-1">
            <CardBody>
              <div className="flex flex-col gap-1">
                <h3 className="text-xl font-semibold">Subscriptions</h3>
                <p className="opacity-70">
                  MRR estimate normalizes weekly/yearly cadences to a monthly factor. Churn counts
                  cancellations inside the period; new counts subscriptions whose row was created in
                  the period.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Row label="Active" value={subs.activeCount.toLocaleString()} />
                <Row label="MRR" value={fmt(subs.mrrCents, subs.currency)} bold />
                <Row label="New" value={subs.newThisPeriod.toLocaleString()} />
                <Row label="Churned" value={subs.churnedThisPeriod.toLocaleString()} />
              </div>
            </CardBody>
          </Card>

          <Card className="min-w-[20rem] flex-1">
            <CardBody>
              <div className="flex flex-col gap-1">
                <h3 className="text-xl font-semibold">Inventory valuation</h3>
                <p className="opacity-70">
                  Sum of on-hand × cost (cost basis) and on-hand × price (retail basis). As of{' '}
                  {new Date(inventory.asOf).toLocaleString()}.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Row label="Units on hand" value={inventory.totalUnits.toLocaleString()} />
                <Row label="At cost" value={fmt(inventory.totalCostCents, inventory.currency)} />
                <Row
                  label="At retail"
                  value={fmt(inventory.totalRetailCents, inventory.currency)}
                  bold
                />
              </div>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardBody>
            <div className="flex flex-col gap-1">
              <h3 className="text-xl font-semibold">Top products</h3>
              <p className="opacity-70">By revenue in the selected range.</p>
            </div>
            {topProducts.length === 0 ? (
              <p className="text-base-content text-sm">No orders in this range.</p>
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
                  {topProducts.map((p) => (
                    <tr key={p.productId}>
                      <td>{p.productTitle}</td>
                      <td className="text-right">{p.unitsSold.toLocaleString()}</td>
                      <td className="text-right">{fmt(p.revenueCents, revenue.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex flex-col gap-1">
              <h3 className="text-xl font-semibold">Top customers</h3>
              <p className="opacity-70">By spend in the selected range.</p>
            </div>
            {topCustomers.length === 0 ? (
              <p className="text-base-content text-sm">No orders in this range.</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th className="text-right">Orders</th>
                    <th className="text-right">Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {topCustomers.map((c) => (
                    <tr key={c.customerId}>
                      <td>{c.customerName}</td>
                      <td className="text-right">{c.ordersCount.toLocaleString()}</td>
                      <td className="text-right">{fmt(c.totalSpentCents, revenue.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function computeRange(spec: { days: number }): { from: string; to: string } {
  const to = new Date();
  let from: Date;
  if (spec.days < 0) {
    from = new Date(to.getFullYear(), 0, 1);
  } else {
    from = new Date(to.getTime() - spec.days * 24 * 60 * 60 * 1000);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

function FilterLink({
  current,
  value,
  label,
}: {
  current: string | undefined;
  value: string;
  label: string;
}) {
  const isActive = current === value || (current === undefined && value === '30d');
  return (
    <Link
      href={`/commerce/reports?range=${value}`}
      className={
        isActive
          ? 'bg-module rounded px-3 py-1 text-xs text-white'
          : 'border-base-300 hover:bg-base-200 rounded border px-3 py-1 text-xs'
      }
    >
      {label}
    </Link>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card className="min-w-[10rem] flex-1">
      <CardBody className="py-4">
        <div className="flex flex-col gap-1">
          <p className="text-base-content text-xs">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      </CardBody>
    </Card>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex flex-row justify-between gap-4">
      <p className="text-base-content text-sm">{label}</p>
      <p className={`text-sm ${bold ? 'font-semibold' : ''}`}>{value}</p>
    </div>
  );
}

function fmt(cents: number, currency: string): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${sign}${currency} ${dollars.toLocaleString()}.${remainder.toString().padStart(2, '0')}`;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}
