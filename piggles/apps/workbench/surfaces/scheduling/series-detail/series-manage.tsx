'use client';

import { useEffect, useMemo } from 'react';
import { Badge, Text } from '@wizeworks/silicaui-react';
import { PaneToolbar, PANE_SHELL } from '../../../components/pane-toolbar';
import { RefreshButton } from '../../../components/refresh-button';
import type { SurfaceContext } from '../../../lib/surfaces/registry';
import {
  humanizeRrule,
  seriesStateMeta,
  type BookingSeriesDetail,
  type Tone,
} from '../bookings-data';
import { COLUMN } from './column';
import { OccurrencesSection, StopControls } from './series-manage-parts';
import { useStopSeries } from './use-stop-series';

/* ══════════════════════════════════════════════════════════════════════════
   MANAGE A RUNNING PATTERN
   ══════════════════════════════════════════════════════════════════════════ */

interface SeriesManageProps {
  ctx: SurfaceContext;
  series: BookingSeriesDetail;
  isFetching: boolean;
  updatedAt: number | undefined;
  onRefresh: () => void;
}

export function SeriesManage({ ctx, series, isFetching, updatedAt, onRefresh }: SeriesManageProps) {
  const { cancel, onStop } = useStopSeries(series.id);

  const meta = seriesStateMeta(series.status);
  const stoppable = series.status === 'active';

  useEffect(() => {
    ctx.setTitle(series.serviceName ?? 'Repeating booking');
  }, [ctx, series.serviceName]);

  // Newest-first for the list an owner scans — what is coming next sits at the top.
  const occurrences = useMemo(
    () => [...series.bookings].sort((a, b) => b.startAt.localeCompare(a.startAt)),
    [series.bookings]
  );

  const openOccurrence = (id: string) => {
    ctx.open('scheduling.bookings.detail', { id }, { target: 'beside' });
  };

  return (
    <div className={PANE_SHELL}>
      <SeriesManageToolbar
        meta={meta}
        isFetching={isFetching}
        updatedAt={updatedAt}
        onRefresh={onRefresh}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          <SeriesSummary series={series} />

          <OccurrencesSection occurrences={occurrences} openOccurrence={openOccurrence} />

          {/* Stopping is the only change you can make to a live pattern, and it is
              irreversible — so it sits after the record, under a divider. */}
          {stoppable ? <StopControls pending={cancel.isPending} onStop={onStop} /> : null}
        </div>
      </div>
    </div>
  );
}

/** The pattern in words, and how many bookings it has made. */
function SeriesSummary({ series }: { series: BookingSeriesDetail }) {
  return (
    <div className="flex flex-col gap-1">
      <Text className="text-base">{humanizeRrule(series.rrule)}.</Text>
      <Text className="text-sm">
        {series.totalBookings} booking{series.totalBookings === 1 ? '' : 's'} in all ·{' '}
        {series.upcomingBookings} still to come
      </Text>
    </div>
  );
}

function SeriesManageToolbar({
  meta,
  isFetching,
  updatedAt,
  onRefresh,
}: {
  meta: { label: string; tone: Tone };
  isFetching: boolean;
  updatedAt: number | undefined;
  onRefresh: () => void;
}) {
  return (
    <PaneToolbar
      label="Repeating booking actions"
      refresh={
        <RefreshButton isFetching={isFetching} updatedAt={updatedAt} onRefresh={onRefresh} />
      }
      status={
        <Badge color={meta.tone} variant="soft" size="sm">
          {meta.label}
        </Badge>
      }
    />
  );
}
