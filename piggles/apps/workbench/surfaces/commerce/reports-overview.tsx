'use client';

// The loaded half of Reports: the period's headline figures, then each section in
// the order a shop owner asks them. No orders in the window says so plainly.

import {
  Card,
  Heading,
  Stat,
  StatDesc,
  StatTitle,
  StatValue,
  Stats,
  Text,
} from '@wizeworks/silicaui-react';
import { faChartLine } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneEmpty } from '../../components/pane-empty';
import { FormSection } from '../../components/form-section';
import { ConversionFunnelReport } from './conversion-funnel';
import {
  BestSellersSection,
  ChannelsSection,
  DayByDaySection,
  RevenueNotes,
} from './report-sections';
import {
  RANGE_LABEL,
  formatCents,
  formatCentsRounded,
  type RangePreset,
  type RevenueSummary,
  type useChannelBreakdown,
  type useConversionFunnel,
  type useRevenueTimeseries,
  type useTopProducts,
} from './reports-data';

const NUMBER = new Intl.NumberFormat();

export interface ReportsOverviewProps {
  module: string;
  preset: RangePreset;
  data: RevenueSummary;
  currency: string;
  series: ReturnType<typeof useRevenueTimeseries>;
  products: ReturnType<typeof useTopProducts>;
  channels: ReturnType<typeof useChannelBreakdown>;
  funnel: ReturnType<typeof useConversionFunnel>;
}

function HeadlineStats({ data, currency }: { data: RevenueSummary; currency: string }) {
  return (
    // Wraps, and each block keeps a width its figure fits in. `.stats` never
    // wrapped, so at 360px it CLIPPED them: $111.32 read "$111.3" (issue 261).
    <Stats className="w-full flex-wrap">
      <Stat className="min-w-44 flex-1">
        <StatTitle>Revenue</StatTitle>
        <StatValue>{formatCentsRounded(data.netRevenueCents, currency)}</StatValue>
        <StatDesc>after refunds</StatDesc>
      </Stat>
      <Stat className="min-w-44 flex-1">
        <StatTitle>Orders</StatTitle>
        <StatValue>{NUMBER.format(data.ordersCount)}</StatValue>
        <StatDesc>placed in this period</StatDesc>
      </Stat>
      <Stat className="min-w-44 flex-1">
        <StatTitle>Average order</StatTitle>
        <StatValue>{formatCents(data.averageOrderValueCents, currency)}</StatValue>
        <StatDesc>spent per order</StatDesc>
      </Stat>
    </Stats>
  );
}

function FunnelSection({ funnel }: { funnel: ReportsOverviewProps['funnel'] }) {
  return (
    <FormSection
      title="How many visits became orders"
      description="Where people stop between arriving and buying. A step with nothing to compare against says so rather than showing 0%."
    >
      {funnel.isPending ? (
        <Text className="text-sm" role="status">
          Loading…
        </Text>
      ) : funnel.data ? (
        <ConversionFunnelReport funnel={funnel.data} />
      ) : (
        <Text className="text-sm">
          This could not be worked out just now. Nothing about your orders has changed.
        </Text>
      )}
    </FormSection>
  );
}

function SalesSections(props: ReportsOverviewProps) {
  const { data, currency, series, products, channels, funnel } = props;
  return (
    <>
      <HeadlineStats data={data} currency={currency} />
      <RevenueNotes data={data} currency={currency} />
      <DayByDaySection series={series.data} currency={currency} isPending={series.isPending} />
      <FunnelSection funnel={funnel} />
      <BestSellersSection
        products={products.data ?? []}
        currency={currency}
        isPending={products.isPending}
      />
      <ChannelsSection
        channels={channels.data}
        currency={currency}
        isPending={channels.isPending}
      />
    </>
  );
}

export function ReportsOverview(props: ReportsOverviewProps) {
  const { module, preset, data } = props;
  return (
    <>
      <div className="flex flex-col gap-1">
        <Heading level={1} className="text-2xl font-semibold">
          {RANGE_LABEL[preset]}
        </Heading>
        <Text className="text-sm">
          Figures cover {data.rangeLabel}. Revenue is what your orders sold after refunds, paid or
          still owed; sales tax and core deposits are left out.
        </Text>
      </div>
      {data.ordersCount > 0 ? (
        <SalesSections {...props} />
      ) : (
        <Card>
          <PaneEmpty
            module={module}
            icon={<Icon glyph={faChartLine} className="size-6" aria-hidden />}
            title="No sales in this period"
            description="Once orders come in, this fills with your revenue, your best sellers, and where the sales came from. Try a longer period above, or check back after your next sale."
          />
        </Card>
      )}
    </>
  );
}
