'use client';

// Where money comes from: takings split by where the sale happened. "Takings" is
// money actually received, so a channel that sells a lot but refunds a lot does
// not overstate itself. The loaded report lives in channels-report.tsx.

import { useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { Card, EmptyState } from '@wizeworks/silicaui-react';
import { faShop } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useChannels, type ChannelRow } from './channels-data';
import { ChannelsReportView } from './channels-report';

const RANGES = [
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '12 months' },
] as const;

type ChannelsQuery = ReturnType<typeof useChannels>;

function ChannelsBody({ query, range }: { query: ChannelsQuery; range: string }) {
  const { data } = query;
  const rows: ChannelRow[] = data?.channels ?? [];
  if (query.isError) {
    return (
      <Card className="min-h-0 flex-1 items-center justify-center">
        <PaneLoadError
          icon={<Icon glyph={faShop} className="size-6" aria-hidden />}
          title="Could not load your channels"
          description="Something went wrong reaching the server. Try again in a moment."
          error={query.error}
          onRetry={() => {
            void query.refetch();
          }}
        />
      </Card>
    );
  }
  if (query.isPending) {
    return (
      <Card className="min-h-0 flex-1 items-center justify-center">
        <PaneWaiting />
      </Card>
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Icon glyph={faShop} className="size-6" aria-hidden />}
        title="No sales in this period"
        description="Nothing was sold in the range you picked. Try a longer period, or come back once orders start coming in."
      />
    );
  }
  return (
    <ChannelsReportView
      rangeLabel={RANGES.find((r) => r.value === range)?.label}
      rows={rows}
      totals={data?.totals ?? { orders: 0, gross: 0, net: 0, refunds: 0, owed: 0 }}
      currency={data?.currency ?? 'USD'}
    />
  );
}

export function ChannelsSurface(_props: { ctx: SurfaceContext }) {
  const [range, setRange] = useState('90');
  const query = useChannels(Number(range));

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Controls for where money comes from"
        filters={[
          {
            label: 'Time range',
            value: range,
            onValueChange: (next) => {
              setRange(next ?? '90');
            },
            options: RANGES,
          },
        ]}
        refresh={
          <RefreshButton
            isFetching={query.isFetching}
            updatedAt={query.data ? query.dataUpdatedAt : undefined}
            onRefresh={() => {
              void query.refetch();
            }}
          />
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <ChannelsBody query={query} range={range} />
      </div>
    </div>
  );
}
