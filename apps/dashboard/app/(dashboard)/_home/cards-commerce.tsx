import {
  BarList,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Grid,
  ModuleProvider,
  Stack,
  Text,
} from '@sparx/ui';
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
      <Card variant="module">
        <CardHeader>
          <Stack direction="row" align="center" justify="between" gap={2}>
            <CardTitle>Sales by channel</CardTitle>
            <CardLink href="/finance/channels">Details</CardLink>
          </Stack>
        </CardHeader>
        <CardContent>
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
            <Text size="sm" variant="muted" className="py-2">
              No channel sales in this period yet.
            </Text>
          )}
        </CardContent>
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
    <Stack gap={2}>
      <Stack direction="row" align="center" justify="between" gap={2}>
        <Text size="sm" weight="medium">
          {title}
        </Text>
        <CardLink href={href}>All</CardLink>
      </Stack>
      <Stack gap={0}>
        {rows.map((r, i) => (
          <div
            key={`${i}-${primary(r)}`}
            className="flex items-center justify-between gap-3 border-b border-[var(--color-border-default)] py-2 last:border-b-0"
          >
            <div className="min-w-0">
              <div className="truncate text-sm text-[var(--color-text-primary)]">{primary(r)}</div>
              <div className="text-xs text-[var(--color-text-tertiary)]">{secondary(r)}</div>
            </div>
            <span className="shrink-0 text-sm font-medium text-[var(--color-text-primary)] tabular-nums">
              {amount(r)}
            </span>
          </div>
        ))}
      </Stack>
    </Stack>
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
      <CardHeader>
        <CardTitle>Top performers</CardTitle>
      </CardHeader>
      <CardContent>
        {hasProducts || hasCustomers ? (
          <Grid cols={1} mdCols={2} gap={6}>
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
          </Grid>
        ) : (
          <EmptyState
            icon={<ShoppingBag className="h-5 w-5" />}
            title="No sales yet"
            description="Top products and customers appear here once orders come in."
          />
        )}
      </CardContent>
    </Card>
  );
}
