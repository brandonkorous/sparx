'use client';

// The generic tile renderer.
//
// One renderer draws every dashboard. A dashboard is a config object — a list of
// tile specs — and NO dashboard is a hand-written component with tiles in its
// markup (docs/129 §6). A user-authored dashboard, when it arrives, feeds this
// exact renderer.
//
// Five shapes, each pulling its weight: a KPI (number + delta + inline trend), a
// real timeseries chart, a categorical donut, and a ranked list. Each tile owns
// its own status, so one failing metric is one broken tile and never an empty
// dashboard (docs/129 §5) — and each has a designed loading skeleton and empty
// state, because a new tenant's dashboard is all zeros and that is the state most
// likely to decide whether they stay.

import { Badge, Skeleton, Text, Tooltip } from '@wizeworks/silicaui-react';
import { Sparkline } from '@wizeworks/silicaui-charts';
import {
  faArrowDownRight,
  faArrowUpRight,
  faExclamationTriangle,
  faMinus,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import type { OpenTarget } from '../../lib/surfaces/registry';
import { DonutChart, TrendChart, useModuleColor } from './charts';
import type {
  BreakdownData,
  DashboardTile,
  KpiData,
  ListData,
  MetricResult,
  MetricUnit,
  ScalarData,
  TimeseriesData,
} from './data';

const NUMBER = new Intl.NumberFormat();

/** Map a modifier-chord to where an opened pane lands — the same contract as
 *  every list in the app: plain opens a tab, Shift opens alongside, Alt sends it
 *  to a new window. */
export function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/** Format a raw metric value for its unit, in an owner's vocabulary. */
function formatValue(value: number, unit: MetricUnit | undefined): string {
  switch (unit) {
    case 'currency':
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(value / 100);
    case 'percent':
      return `${NUMBER.format(value)}%`;
    case 'duration':
      return value < 1000
        ? `${NUMBER.format(Math.round(value))} ms`
        : `${(value / 1000).toFixed(1)} s`;
    case 'ratio':
      return value.toFixed(2);
    case 'count':
    default:
      return NUMBER.format(value);
  }
}

/* ── Span → grid class ───────────────────────────────────────────────────── */

/** How many columns a NON-kpi tile occupies in the 4-wide body grid. Container
 *  queries, not viewport ones — a pane is a fraction of the window, so its
 *  breakpoints must be its own width. `4` is the full-width hero. */
export function spanClass(span: 1 | 2 | 3 | 4 | undefined): string {
  switch (span) {
    case 4:
      return 'col-span-full';
    case 3:
      return '@2xl:col-span-2 @5xl:col-span-3';
    case 2:
      return '@2xl:col-span-2';
    default:
      return '';
  }
}

/* ── The delta chip (shared by KPI) ──────────────────────────────────────── */

function DeltaChip({ compare }: { compare: NonNullable<MetricResult['compare']> }) {
  if (compare.deltaPct === null) {
    return (
      <Text as="span" className="text-sm">
        no baseline
      </Text>
    );
  }
  const up = compare.deltaPct > 0;
  const flat = compare.deltaPct === 0;
  const tone = flat ? 'neutral' : up ? 'success' : 'danger';
  const glyph = flat ? faMinus : up ? faArrowUpRight : faArrowDownRight;
  return (
    <Tooltip content="vs previous period">
      <Badge color={tone} variant="soft" size="sm">
        <Icon glyph={glyph} className="size-3.5" aria-hidden />
        {Math.abs(compare.deltaPct)}%
      </Badge>
    </Tooltip>
  );
}

/* ── KPI ─────────────────────────────────────────────────────────────────── */

function KpiTile({ tile, result }: { tile: DashboardTile; result: MetricResult | undefined }) {
  const { ref, color } = useModuleColor();
  return (
    <div
      ref={ref}
      className="border-base-300 bg-base-100 flex flex-col gap-1.5 rounded-lg border p-3"
    >
      <span className="text-sm">{tile.title}</span>
      {!result ? (
        <>
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-7 w-full" />
        </>
      ) : result.status !== 'ok' ? (
        <StatusLine result={result} tile={tile} />
      ) : (
        <KpiValue result={result} tile={tile} sparkColor={color} />
      )}
    </div>
  );
}

function KpiValue({
  tile,
  result,
  sparkColor,
}: {
  tile: DashboardTile;
  result: MetricResult;
  sparkColor: string | undefined;
}) {
  const kpi = result.data as KpiData;
  const isEmpty = kpi.value <= 0;
  return (
    <>
      <div className="flex items-end justify-between gap-2">
        <span className="text-2xl font-semibold tabular-nums">
          {formatValue(kpi.value, result.unit)}
        </span>
        {result.compare ? <DeltaChip compare={result.compare} /> : null}
      </div>
      {kpi.spark && kpi.spark.length > 1 && !isEmpty ? (
        <Sparkline data={kpi.spark} type="line" area color={sparkColor} className="h-7 w-full" />
      ) : isEmpty ? (
        <Text className="text-sm">{tile.emptyHint ?? 'No data yet.'}</Text>
      ) : (
        <div className="h-7" />
      )}
    </>
  );
}

/* ── Timeseries (the hero chart) ─────────────────────────────────────────── */

function TimeseriesTile({ result }: { result: MetricResult }) {
  const series = result.data as TimeseriesData;
  const hasData = series.points.some((p) => series.series.some((s) => Number(p[s.key] ?? 0) > 0));
  if (!hasData) {
    return <TileMessage>No figures for this period yet.</TileMessage>;
  }
  return <TrendChart series={series.series} points={series.points} grain={series.grain} />;
}

/* ── Breakdown (donut) ───────────────────────────────────────────────────── */

function BreakdownTile({ tile, result }: { tile: DashboardTile; result: MetricResult }) {
  const rows = (result.data as BreakdownData).rows;
  if (rows.length === 0) {
    return <TileMessage>{tile.emptyHint ?? 'Nothing to break down in this period.'}</TileMessage>;
  }
  return (
    <DonutChart
      rows={rows}
      centerLabel={tile.centerLabel}
      format={(n) => formatValue(n, result.unit)}
    />
  );
}

/* ── List (dense, ranked, with a proportion bar) ─────────────────────────── */

// Proportion-bar widths as literal classes rather than an inline style — the same
// finite-set trick the height bars use, so Tailwind emits every one.
const BAR_WIDTH = [
  'w-0',
  'w-[5%]',
  'w-[10%]',
  'w-[15%]',
  'w-[20%]',
  'w-[25%]',
  'w-[30%]',
  'w-[35%]',
  'w-[40%]',
  'w-[45%]',
  'w-[50%]',
  'w-[55%]',
  'w-[60%]',
  'w-[65%]',
  'w-[70%]',
  'w-[75%]',
  'w-[80%]',
  'w-[85%]',
  'w-[90%]',
  'w-[95%]',
  'w-full',
];

function ListTile({
  result,
  onRowDrill,
}: {
  result: MetricResult;
  onRowDrill?: (
    params: Record<string, string>,
    event: { shiftKey: boolean; altKey: boolean }
  ) => void;
}) {
  const rows = (result.data as ListData).rows;
  if (rows.length === 0) {
    return <TileMessage>Nothing to show for this period yet.</TileMessage>;
  }
  const peak = Math.max(1, ...rows.map((r) => r.value));

  return (
    <ol className="flex flex-col">
      {rows.map((row, index) => {
        const step = row.value <= 0 ? 0 : Math.round((row.value / peak) * 20);
        const canDrill = Boolean(onRowDrill && row.drillParams);
        const inner = (
          <>
            <span className="w-5 shrink-0 text-right text-sm tabular-nums">{index + 1}</span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 flex-1 truncate font-mono text-sm">{row.label}</span>
                {row.secondary ? (
                  <span className="shrink-0 text-sm tabular-nums">{row.secondary}</span>
                ) : null}
                <span className="w-12 shrink-0 text-right font-semibold tabular-nums">
                  {formatValue(row.value, result.unit)}
                </span>
              </div>
              {/* The proportion track — a functional data bar, not decoration. */}
              <div className="bg-base-200 h-1 overflow-hidden rounded-full">
                <div className={`bg-module h-full rounded-full ${BAR_WIDTH[step] ?? 'w-0'}`} />
              </div>
            </div>
          </>
        );
        return canDrill ? (
          <button
            key={row.id}
            type="button"
            className="hover:bg-base-200 flex items-center gap-3 rounded-md px-1.5 py-2 text-left"
            onClick={(event) => onRowDrill?.(row.drillParams ?? {}, event)}
          >
            {inner}
          </button>
        ) : (
          <li key={row.id} className="flex items-center gap-3 px-1.5 py-2">
            {inner}
          </li>
        );
      })}
    </ol>
  );
}

/* ── Shared status / empty / skeleton ────────────────────────────────────── */

function TileMessage({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-sm" role="status">
      {children}
    </Text>
  );
}

function StatusLine({ result, tile }: { result: MetricResult; tile: DashboardTile }) {
  if (result.status === 'unknown_metric') {
    return <TileMessage>This figure isn’t available.</TileMessage>;
  }
  if (result.status === 'unavailable') {
    return <TileMessage>{result.message ?? 'Not available for this account.'}</TileMessage>;
  }
  if (result.status === 'error') {
    return (
      <div className="flex items-start gap-2">
        <Icon
          glyph={faExclamationTriangle}
          className="text-warning mt-0.5 size-4 shrink-0"
          aria-hidden
        />
        <Text className="text-sm">{result.message ?? 'Couldn’t load this just now.'}</Text>
      </div>
    );
  }
  return <TileMessage>{tile.emptyHint ?? 'Nothing here yet.'}</TileMessage>;
}

/** A shape-appropriate loading placeholder for a non-KPI tile. */
function TileSkeleton({ shape }: { shape: DashboardTile['shape'] }) {
  if (shape === 'timeseries') return <Skeleton className="h-80 w-full" />;
  if (shape === 'breakdown') {
    return (
      <div className="flex items-center gap-4">
        <Skeleton className="size-40 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}

/* ── The tile shell (non-KPI) ────────────────────────────────────────────── */

interface TileProps {
  tile: DashboardTile;
  result: MetricResult | undefined;
  /** Open the tile's drill target. Absent when the tile has no `drill`. */
  onDrill?: (
    extraParams: Record<string, string>,
    event: { shiftKey: boolean; altKey: boolean }
  ) => void;
}

/** KPI tiles render in a dedicated strip and are exported for it. */
export function KpiCard({
  tile,
  result,
}: {
  tile: DashboardTile;
  result: MetricResult | undefined;
}) {
  return <KpiTile tile={tile} result={result} />;
}

/** A body tile (everything that isn't a KPI) in its titled panel. */
export function Tile({ tile, result, onDrill }: TileProps) {
  const body = (() => {
    if (!result) return <TileSkeleton shape={tile.shape} />;
    if (result.status !== 'ok') return <StatusLine result={result} tile={tile} />;
    switch (result.shape) {
      case 'timeseries':
        return <TimeseriesTile result={result} />;
      case 'breakdown':
        return <BreakdownTile tile={tile} result={result} />;
      case 'list':
        return <ListTile result={result} onRowDrill={onDrill} />;
      case 'scalar':
        return (
          <span className="text-2xl font-semibold tabular-nums">
            {formatValue((result.data as ScalarData).value, result.unit)}
          </span>
        );
      default:
        return null;
    }
  })();

  return (
    <section className="border-base-300 bg-base-100 flex h-full flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{tile.title}</h3>
      </div>
      {body}
    </section>
  );
}
