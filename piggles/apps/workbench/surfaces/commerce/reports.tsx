'use client';

// Reports — how selling is going, read-only.
//
// Everything here is computed live from real orders by api-rest; nothing is
// mocked. Four things, in the order a shop owner asks them: how much came in,
// how that moved day by day, what sold best, and where the sales came from.
// When there are simply no orders in the chosen window, the surface says so
// plainly rather than drawing an empty chart — an honest blank beats a fake one.
//
// The day-by-day chart is drawn from layout utilities, not a charting library:
// one series, no axes, heights quantised to a finite set of Tailwind classes so
// there is no inline style. Pulling in a chart dependency to draw a row of
// rectangles would be the tail wagging the dog (see sites/traffic.tsx).

import { useMemo, useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneEmpty } from '../../components/pane-empty';
import { PaneLoadError } from '../../components/pane-load-error';
import {
  Card,
  Heading,
  Select,
  Stat,
  StatDesc,
  StatTitle,
  StatValue,
  Stats,
  Text,
} from '@wizeworks/silicaui-react';
import { faChartLine } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { FormSection } from '../../components/form-section';
import { ConversionFunnelReport } from './conversion-funnel';
import { BestSellersSection, ChannelsSection, DayByDaySection } from './report-sections';

/** Registry module for this pane, so the brand draws Sell's own picture rather
 *  than the generic one. */
const MODULE = 'commerce';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  RANGE_LABEL,
  formatCents,
  formatCentsRounded,
  presetRange,
  reportsErrorMessage,
  useChannelBreakdown,
  useConversionFunnel,
  useRevenueSummary,
  useRevenueTimeseries,
  useTopProducts,
  type RangePreset,
} from './reports-data';

const NUMBER = new Intl.NumberFormat();

export function ReportsSurface({ ctx: _ctx }: { ctx: SurfaceContext }) {
  const [preset, setPreset] = useState<RangePreset>('30');
  const range = useMemo(() => presetRange(preset), [preset]);

  const summary = useRevenueSummary(range);
  const series = useRevenueTimeseries(range);
  const products = useTopProducts(range);
  const channels = useChannelBreakdown(range);
  const funnel = useConversionFunnel(range);

  const isFetching =
    summary.isFetching || series.isFetching || products.isFetching || channels.isFetching;

  const refetchAll = () => {
    void summary.refetch();
    void series.refetch();
    void products.refetch();
    void channels.refetch();
  };

  const data = summary.data;
  const currency = data?.currency ?? 'USD';
  const hasSales = (data?.ordersCount ?? 0) > 0;

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Reports controls"
        controls={
          <div className="w-36">
            <Select
              size="sm"
              color="module"
              aria-label="Time period"
              value={preset}
              items={[
                { value: '7', label: RANGE_LABEL['7'] },
                { value: '30', label: RANGE_LABEL['30'] },
                { value: '90', label: RANGE_LABEL['90'] },
              ]}
              onValueChange={(next) => {
                setPreset((next as RangePreset) ?? '30');
              }}
            />
          </div>
        }
        refresh={
          <RefreshButton
            isFetching={isFetching}
            updatedAt={data ? summary.dataUpdatedAt : undefined}
            onRefresh={refetchAll}
          />
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {/* Both non-ready states are carded, matching the ready one — a stack of
              FormSections, each already a card. */}
          {summary.isError ? (
            <Card>
              <PaneLoadError
                module={MODULE}
                icon={<Icon glyph={faChartLine} className="size-6" aria-hidden />}
                title="Could not load your reports"
                description={reportsErrorMessage(
                  summary.error,
                  'This is a problem reaching the server. Try again in a moment.'
                )}
                onRetry={refetchAll}
              />
            </Card>
          ) : summary.isPending || !data ? (
            <Card>
              <PaneWaiting module={MODULE} />
            </Card>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <Heading level={1} className="text-2xl font-semibold">
                  {RANGE_LABEL[preset]}
                </Heading>
                <Text className="text-sm">
                  Figures cover {data.rangeLabel}. Money is what customers paid, after any refunds.
                </Text>
              </div>

              {!hasSales ? (
                <Card>
                  <PaneEmpty
                    module={MODULE}
                    icon={<Icon glyph={faChartLine} className="size-6" aria-hidden />}
                    title="No sales in this period"
                    description="Once orders come in, this fills with your revenue, your best sellers, and where the sales came from. Try a longer period above, or check back after your next sale."
                  />
                </Card>
              ) : (
                <>
                  {/* Wraps, and each block keeps a width its figure fits in.
                      `.stats` is an `overflow: hidden` flex row that never wrapped,
                      so at 360px it CLIPPED them: $111.32 read "$111.3" (issue 261). */}
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

                  {data.refundedCents > 0 ? (
                    <Text className="text-sm">
                      {formatCents(data.refundedCents, currency)} was refunded in this period,
                      already taken off the revenue above.
                    </Text>
                  ) : null}

                  <DayByDaySection
                    series={series.data}
                    currency={currency}
                    isPending={series.isPending}
                  />

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
                        This could not be worked out just now. Nothing about your orders has
                        changed.
                      </Text>
                    )}
                  </FormSection>

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
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
