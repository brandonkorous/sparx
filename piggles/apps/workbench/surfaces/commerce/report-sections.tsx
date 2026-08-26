'use client';

// The three list-shaped report sections, lifted out of reports.tsx so that file
// stays under the file-length rule.

import { Badge, Text } from '@wizeworks/silicaui-react';
import { FormSection } from '../../components/form-section';
import { RevenueBars } from './revenue-bars';
import {
  channelLabel,
  formatCents,
  type ChannelBreakdown,
  type RevenueTimeseries,
  type TopProduct,
} from './reports-data';

const NUMBER = new Intl.NumberFormat();

/** One line of a report list — a name, then figures that stay on one line. */
function Row({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="border-base-300 flex flex-wrap items-center gap-2 border-b py-2 last:border-b-0">
      <span className="min-w-0 flex-1 font-medium">{name}</span>
      {children}
    </div>
  );
}

export function DayByDaySection({
  series,
  currency,
  isPending,
}: {
  series: RevenueTimeseries | undefined;
  currency: string;
  isPending: boolean;
}) {
  return (
    <FormSection title="Sales day by day">
      {series && series.points.length > 0 ? (
        <div className="flex flex-col gap-1">
          <RevenueBars points={series.points} currency={currency} />
          <Text className="text-sm">
            One bar per day, tallest being the busiest. Hover a bar for its date and takings.
          </Text>
        </div>
      ) : (
        <Text className="text-sm" role="status">
          {isPending ? 'Loading…' : 'No day-by-day figures for this period.'}
        </Text>
      )}
    </FormSection>
  );
}

export function BestSellersSection({
  products,
  currency,
  isPending,
}: {
  products: TopProduct[];
  currency: string;
  isPending: boolean;
}) {
  return (
    <FormSection title="Best sellers" description="Your top products by revenue in this period.">
      {isPending ? (
        <Text className="text-sm" role="status">
          Loading…
        </Text>
      ) : products.length === 0 ? (
        <Text className="text-sm">No products sold in this period yet.</Text>
      ) : (
        <div className="flex flex-col">
          {products.map((product) => (
            <Row key={product.productId} name={product.productTitle}>
              <Text as="span" className="shrink-0 text-sm tabular-nums">
                {product.unitsSold === 1 ? '1 sold' : `${NUMBER.format(product.unitsSold)} sold`}
              </Text>
              <Text as="span" className="shrink-0 text-sm font-medium tabular-nums">
                {formatCents(product.revenueCents, currency)}
              </Text>
            </Row>
          ))}
        </div>
      )}
    </FormSection>
  );
}

export function ChannelsSection({
  channels,
  currency,
  isPending,
}: {
  channels: ChannelBreakdown | undefined;
  currency: string;
  isPending: boolean;
}) {
  const rows = channels?.byChannel ?? [];
  return (
    <FormSection
      title="Where sales came from"
      description="Your revenue split by how the order was placed."
    >
      {isPending ? (
        <Text className="text-sm" role="status">
          Loading…
        </Text>
      ) : rows.length === 0 ? (
        <Text className="text-sm">No sales to break down in this period.</Text>
      ) : (
        <div className="flex flex-col">
          {rows.map((row) => (
            <Row key={row.channel} name={channelLabel(row.channel)}>
              <Badge color="neutral" variant="soft" size="sm">
                {row.sharePct}%
              </Badge>
              <Text as="span" className="shrink-0 text-sm tabular-nums">
                {row.orders === 1 ? '1 order' : `${NUMBER.format(row.orders)} orders`}
              </Text>
              <Text as="span" className="shrink-0 text-sm font-medium tabular-nums">
                {formatCents(row.revenueCents, currency)}
              </Text>
            </Row>
          ))}
        </div>
      )}
    </FormSection>
  );
}
