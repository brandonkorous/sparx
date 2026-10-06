'use client';

// ONE REPEATING BOOKING. `{id:'new'}` is the form that describes a pattern; `{id}` is the
// running pattern, read-only except for stopping it, because every occurrence is derived
// from it. Its occurrences are a plain list of rows, each opening the real booking.
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { Card } from '@wizeworks/silicaui-react';
import { PANE_SHELL } from '../../components/pane-toolbar';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useBookingSeries } from './bookings-data';
import { SeriesCreate } from './series-detail/series-create';
import { SeriesManage } from './series-detail/series-manage';

/* ══════════════════════════════════════════════════════════════════════════
   THE PANE
   ══════════════════════════════════════════════════════════════════════════ */

export function SeriesDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  const series = useBookingSeries(id);

  if (id === 'new') {
    return <SeriesCreate ctx={ctx} />;
  }

  if (series.isError) {
    return (
      <div className={PANE_SHELL}>
        <Card className="min-h-0 flex-1 items-center justify-center">
          <PaneLoadError
            error={series.error}
            title="Could not load this"
            description="This is a problem reaching the server. Nothing has changed."
            missingTitle="This repeating booking no longer exists"
            missingDescription="It may have been removed. Any bookings it already made are unaffected."
            onRetry={() => {
              void series.refetch();
            }}
          />
        </Card>
      </div>
    );
  }

  if (series.isPending || !series.data) {
    return (
      <div className={PANE_SHELL}>
        <PaneWaiting />
      </div>
    );
  }

  return (
    <SeriesManage
      key={series.data.id}
      ctx={ctx}
      series={series.data}
      isFetching={series.isFetching}
      updatedAt={series.dataUpdatedAt}
      onRefresh={() => {
        void series.refetch();
      }}
    />
  );
}

export default SeriesDetailSurface;
