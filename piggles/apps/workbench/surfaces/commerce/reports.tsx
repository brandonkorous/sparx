'use client';

// Reports: how selling is going, read-only, computed live from real orders. The
// day-by-day chart is Tailwind bars, not a chart library (see sites/traffic.tsx).

import { useMemo, useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { Card, Select } from '@wizeworks/silicaui-react';
import { faChartLine } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { ReportsOverview, type ReportsOverviewProps } from './reports-overview';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  RANGE_LABEL,
  presetRange,
  useChannelBreakdown,
  useConversionFunnel,
  useRevenueSummary,
  useRevenueTimeseries,
  useTopProducts,
  type RangePreset,
} from './reports-data';

/** Registry module for this pane, so the brand draws Sell's own picture rather
 *  than the generic one. */
const MODULE = 'commerce';

function RangeSelect(props: { preset: RangePreset; onChange: (next: RangePreset) => void }) {
  return (
    <div className="w-36">
      <Select
        size="sm"
        color="module"
        aria-label="Time period"
        value={props.preset}
        items={[
          { value: '7', label: RANGE_LABEL['7'] },
          { value: '30', label: RANGE_LABEL['30'] },
          { value: '90', label: RANGE_LABEL['90'] },
        ]}
        onValueChange={(next) => {
          props.onChange((next as RangePreset) ?? '30');
        }}
      />
    </div>
  );
}

function ReportsBody(
  props: Omit<ReportsOverviewProps, 'data' | 'module'> & {
    summary: ReturnType<typeof useRevenueSummary>;
    onRetry: () => void;
  }
) {
  const { summary, onRetry } = props;
  // Both non-ready states are carded, matching the ready one: a stack of
  // FormSections, each already a card.
  if (summary.isError) {
    return (
      <Card>
        <PaneLoadError
          module={MODULE}
          icon={<Icon glyph={faChartLine} className="size-6" aria-hidden />}
          title="Could not load how selling is going"
          description="This is a problem reaching the server. Try again in a moment."
          error={summary.error}
          onRetry={onRetry}
        />
      </Card>
    );
  }
  if (summary.isPending || !summary.data) {
    return (
      <Card>
        <PaneWaiting module={MODULE} />
      </Card>
    );
  }
  return <ReportsOverview {...props} module={MODULE} data={summary.data} />;
}

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

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Controls for how selling is going"
        controls={<RangeSelect preset={preset} onChange={setPreset} />}
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
          <ReportsBody
            {...{ preset, currency, summary, series, products, channels, funnel }}
            onRetry={refetchAll}
          />
        </div>
      </div>
    </div>
  );
}
