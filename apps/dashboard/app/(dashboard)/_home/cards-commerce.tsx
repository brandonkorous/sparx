import { Card, CardBody, CardTitle, EmptyState } from '@wizeworks/silicaui-react';
import { BarList, ModuleProvider } from '@sparx/ui';
import { ShoppingBag } from 'lucide-react';

import { CardLink } from '../_components/overview-bits';
import { fmtMoneyCompact, fmtNumber } from './format';
import type { ChannelRevenueReport, TopCustomerRow, TopProductRow } from './types';

// Commerce deep-dive (monetization). Sales-by-channel is the one commerce-tinted
// "primary" card for the hue; the top products/customers lists stay neutral.

export function SalesByChannelCard({ channels }: { channels: ChannelRevenueReport }) {
  const rows = channels.byChannel.filter((c) => c.netAfterFeesCents > 0).slice(0, 6);
  return (
    <ModuleProvider module="commerce">
      <Card className="bg-module bg-soft">
        <CardBody>
          <div className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Sales by channel</CardTitle>
            <CardLink href="/finance/channels">Details</CardLink>
          </div>
          {rows.length > 0 ? (
            <BarList
              color="module"
              items={rows.map((c) => ({
                label: c.label,
                value: c.netAfterFeesCents,
                display: fmtMoneyCompact(c.netAfterFeesCents),
              }))}
            />
          ) : (
            <p className="text-base-content/70 py-2 text-sm">
              No channel sales in this period yet.
            </p>
          )}
        </CardBody>
      </Card>
    </ModuleProvider>
  );
}

function RankedList<T>({
  rows,
  title,
  href,
  primary,
  secondary,
  amount,
}: {
  rows: T[];
  title: string;
  href: string;
  primary: (r: T) => string;
  secondary: (r: T) => string;
  amount: (r: T) => string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        <CardLink href={href}>All</CardLink>
      </div>
      <div className="flex flex-col gap-0">
        {rows.map((r, i) => (
          <div
            key={`${i}-${primary(r)}`}
            className="border-base-300 flex items-center justify-between gap-3 border-b py-2 last:border-b-0"
          >
            <div className="min-w-0">
              <div className="text-base-content truncate text-sm">{primary(r)}</div>
              <div className="text-base-content/50 text-xs">{secondary(r)}</div>
            </div>
            <span className="text-base-content shrink-0 text-sm font-medium tabular-nums">
              {amount(r)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TopListsCard({
  products,
  customers,
}: {
  products: TopProductRow[] | null;
  customers: TopCustomerRow[] | null;
}) {
  const hasProducts = products && products.length > 0;
  const hasCustomers = customers && customers.length > 0;
  return (
    <Card>
      <CardBody>
        <CardTitle>Top performers</CardTitle>
        {hasProducts || hasCustomers ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {hasProducts && (
              <RankedList
                rows={products.slice(0, 5)}
                title="Products"
                href="/commerce/products"
                primary={(r) => r.productTitle}
                secondary={(r) => `${fmtNumber(r.unitsSold)} sold`}
                amount={(r) => fmtMoneyCompact(r.revenueCents)}
              />
            )}
            {hasCustomers && (
              <RankedList
                rows={customers.slice(0, 5)}
                title="Customers"
                href="/crm/customers"
                primary={(r) => r.customerName}
                secondary={(r) => `${fmtNumber(r.ordersCount)} orders`}
                amount={(r) => fmtMoneyCompact(r.totalSpentCents)}
              />
            )}
          </div>
        ) : (
          <EmptyState
            icon={<ShoppingBag className="h-5 w-5" />}
            title="No sales yet"
            description="Top products and customers appear here once orders come in."
          />
        )}
      </CardBody>
    </Card>
  );
}
