'use client';

// REPORTS — what your stock is worth, what is sitting still, and how fast it moves.
//
// ── A reporting surface, not a list ──────────────────────────────────────
//
// There is nothing to create, open or narrow to a row here. It answers three
// questions an owner actually asks about the money tied up in stock, each with
// the headline figure large and the detail underneath: what it is worth, what
// is gathering dust, and how fast it turns over. So it is stat cards over a
// couple of quiet tables in one capped, centred column — never a grid of rows.
//
// ── Every figure is worked out on the SERVER ─────────────────────────────
//
// Valuation, turnover and ageing are sums over the whole of your stock and the
// movement ledger. The selling period and the location are server params, so
// the answer is always about ALL of your stock — not the rows that happened to
// load. Filtering a report in the browser would answer a question about a
// handful of items and present it as the whole picture.
//
// ── No charting library ──────────────────────────────────────────────────
//
// The one visual — a share bar beside each ageing band and each location — is
// built from a fixed set of Tailwind width classes, not an inline width and not
// a chart dependency. One series, no axes: pulling in a library to draw a few
// rectangles would be the tail wagging the dog.
//
// This file owns the filters and the routing. The cards are the sibling
// reports-* files; the column that assembles them is reports-column.

import { useMemo, useState } from 'react';
import { PANE_SHELL } from '../../components/pane-toolbar';
import { InlineWaiting } from '../../components/inline-waiting';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useStockLocations } from './data';
import { rangeForDays } from './reports-data';
import { useReportQueries, type ReportQueries, type ReportRange } from './reports-queries';
import { NothingToReportOn, ReportsLoadFailed } from './reports-empty';
import { ReportsColumn } from './reports-column';
import { ReportsToolbar } from './reports-toolbar';

function ReportsBody({
  ctx,
  q,
  range,
  locationId,
  locationName,
}: {
  ctx: SurfaceContext;
  q: ReportQueries;
  range: ReportRange;
  locationId: string;
  locationName: string | null;
}) {
  if (q.summary.isError) return <ReportsLoadFailed />;
  if (q.summary.isPending) return <InlineWaiting label="Working out your figures…" />;

  // `isPending` is a boolean, not the query's discriminant, so TypeScript does
  // not narrow `data` to defined from the guard above — this makes it explicit.
  const data = q.summary.data;
  if (!data) return null;

  if (data.stockStatus.skuCount === 0 && data.valuation.totalUnits === 0) {
    return <NothingToReportOn ctx={ctx} />;
  }

  return (
    <ReportsColumn
      ctx={ctx}
      q={q}
      data={data}
      currency={data.valuation.currency}
      locationName={locationName}
      range={range}
      locationId={locationId}
    />
  );
}

export function ReportsSurface({ ctx }: { ctx: SurfaceContext }) {
  const [rangeDays, setRangeDays] = useState(30);
  const [locationId, setLocationId] = useState('');

  // Memoised on the preset alone: rangeForDays reads the clock, so recomputing
  // it every render would mint a fresh query key each time and refetch forever.
  const range = useMemo(() => rangeForDays(rangeDays), [rangeDays]);
  const q = useReportQueries(range, locationId);

  const locations = useStockLocations();
  const activeLocations = (locations.data?.items ?? []).filter((l) => l.isActive);
  const locationName = activeLocations.find((l) => l.id === locationId)?.name ?? null;

  return (
    <div className={PANE_SHELL}>
      <ReportsToolbar
        rangeDays={rangeDays}
        onRangeDays={setRangeDays}
        locationId={locationId}
        onLocation={setLocationId}
        locations={activeLocations}
        isFetching={q.isFetching}
        updatedAt={q.summary.data ? q.summary.dataUpdatedAt : undefined}
        onRefresh={q.refreshAll}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <ReportsBody
          ctx={ctx}
          q={q}
          range={range}
          locationId={locationId}
          locationName={locationName}
        />
      </div>
    </div>
  );
}
