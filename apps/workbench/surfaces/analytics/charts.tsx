'use client';

// The real charts — a themed wrapper over silicaui's ECharts (`@wizeworks/
// silicaui-charts`), the sanctioned dataviz stack for the design system the
// workbench is built on.
//
// `<Chart>` already auto-themes axes, gridlines, text and tooltip to the live
// `--color-*` tokens (and re-inits on a light/dark flip). What it can't guess is
// which SERIES colours we want — so we resolve the ambient module hue (and a
// small palette) off the DOM and hand ECharts concrete values. Reading from a
// ref inside the pane's <ModuleScope> means the hues track the dashboard's
// module: a Traffic chart draws in builder indigo, a Sales one in commerce
// orange, with no per-dashboard wiring.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Chart, type EChartsOption } from '@wizeworks/silicaui-charts';
import type { TimeseriesPoint, TimeseriesSeries } from './data';

/** Resolve a set of `--color-*` custom properties to concrete values off a live
 *  element, re-reading when the ambient theme flips. Returns the ref to attach to
 *  an element inside the themed subtree, plus the resolved colours (empty until
 *  the first paint, at which point ECharts falls back to its themed palette). */
function useTokenColors(names: readonly string[]): {
  ref: React.RefObject<HTMLDivElement | null>;
  colors: string[];
} {
  const ref = useRef<HTMLDivElement | null>(null);
  const [colors, setColors] = useState<string[]>([]);
  const key = names.join(',');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const cs = getComputedStyle(el);
      setColors(names.map((n) => cs.getPropertyValue(n).trim()).filter(Boolean));
    };
    read();
    // Re-resolve when the theme toggles (data-theme / class on <html>), since the
    // concrete colours change even though the token names don't.
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class', 'style'],
    });
    return () => observer.disconnect();
    // names is a stable literal per call site; key guards the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { ref, colors };
}

/** The ambient module hue as a CONCRETE colour (ECharts on canvas can't read a
 *  CSS `var()`), plus the ref to anchor it inside the themed subtree. Used by KPI
 *  sparklines so their trend matches the dashboard's module. */
export function useModuleColor(): {
  ref: React.RefObject<HTMLDivElement | null>;
  color: string | undefined;
} {
  const { ref, colors } = useTokenColors(['--color-module']);
  return { ref, color: colors[0] };
}

/** A bucket label sized to the grain: a day/week gets "5 Mar", a month "Mar". */
function bucketLabel(bucket: string, grain: string): string {
  const date = new Date(`${bucket}T00:00:00.000Z`);
  if (grain === 'month') {
    return date.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' });
  }
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

const TREND_TOKENS = ['--color-module', '--color-info'] as const;

/**
 * The hero trend chart: named series over time on one axis, with a soft area fill
 * under the lead series. Real axes, gridlines, and an axis-triggered crosshair
 * tooltip — the thing a bar strip cannot be.
 */
export function TrendChart({
  series,
  points,
  grain,
}: {
  series: TimeseriesSeries[];
  points: TimeseriesPoint[];
  grain: string;
}) {
  const { ref, colors } = useTokenColors(TREND_TOKENS);

  const option = useMemo<EChartsOption>(() => {
    const categories = points.map((p) => bucketLabel(String(p.bucket), grain));
    return {
      ...(colors.length ? { color: colors } : {}),
      grid: { left: 6, right: 12, top: 34, bottom: 2, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line' },
      },
      legend: {
        top: 2,
        right: 2,
        icon: 'roundRect',
        itemWidth: 11,
        itemHeight: 11,
        itemGap: 16,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: categories,
        axisTick: { show: false },
        // Keep the axis readable at any width — ECharts thins the labels itself.
        axisLabel: { hideOverlap: true },
      },
      yAxis: {
        type: 'value',
        splitNumber: 4,
        minInterval: 1,
      },
      series: series.map((s, index) => ({
        name: s.label,
        type: 'line',
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2 },
        emphasis: { focus: 'series' },
        // Only the lead series gets an area fill; two overlapping washes muddy.
        ...(index === 0 ? { areaStyle: { opacity: 0.16 } } : {}),
        data: points.map((p) => Number(p[s.key] ?? 0)),
      })),
    };
  }, [series, points, grain, colors]);

  return (
    <div ref={ref} className="w-full">
      {/* h-80! (320px) — the important modifier beats the Chart's inline default
          height (20rem), so the size is ours to set, not a class the inline style
          silently wins over. Height via a class, never an inline style. */}
      <Chart
        option={option}
        className="h-80! w-full"
        aria-label="Visitors and page views over time"
      />
    </div>
  );
}

const DONUT_TOKENS = [
  '--color-module',
  '--color-info',
  '--color-secondary',
  '--color-accent',
  '--color-success',
  '--color-warning',
] as const;

// The dot colour for each legend row, in the SAME order as DONUT_TOKENS, so the
// hand-rendered legend matches the ECharts slices without an inline style (silica
// emits these bg-* utilities from the same tokens the chart resolves).
const DONUT_DOT = [
  'bg-module',
  'bg-info',
  'bg-secondary',
  'bg-accent',
  'bg-success',
  'bg-warning',
] as const;

const NUMBER = new Intl.NumberFormat();

export interface DonutRow {
  key: string;
  label: string;
  value: number;
  sharePct?: number;
}

/**
 * A breakdown as a donut with the total in the hole and a value legend beside it —
 * the right shape for "what's it made of".
 *
 * Two things that keep it from looking cheap: the donut lives in a genuinely
 * SQUARE box (a non-square box distorts the ring), and the centre total is a real
 * React element absolutely centred over the chart rather than an ECharts title
 * floated by percentage — so it lands dead-centre in the hole, in the app's own
 * type, every time. Slice colours and legend dots walk the module-led palette in
 * lockstep.
 */
export function DonutChart({
  rows,
  centerLabel,
  format,
}: {
  rows: DonutRow[];
  centerLabel?: string;
  /** Formats each slice/legend/centre value for its unit — currency, count, … */
  format?: (value: number) => string;
}) {
  const { ref, colors } = useTokenColors(DONUT_TOKENS);
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  const fmt = useMemo(() => format ?? ((n: number) => NUMBER.format(n)), [format]);

  const option = useMemo<EChartsOption>(
    () => ({
      ...(colors.length ? { color: colors } : {}),
      tooltip: {
        trigger: 'item',
        // valueFormatter keeps the default "name: value (percent%)" tooltip but
        // renders the value in its unit. `value` is typed to ECharts' broad
        // option-value union, so we take `unknown` and coerce.
        valueFormatter: (value: unknown) => fmt(Number(value)),
      },
      series: [
        {
          type: 'pie',
          radius: ['64%', '92%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: true,
          label: { show: false },
          labelLine: { show: false },
          data: rows.map((r) => ({ name: r.label, value: r.value })),
        },
      ],
    }),
    [rows, colors, fmt]
  );

  return (
    <div className="flex flex-wrap items-center gap-6" ref={ref}>
      <div className="relative size-44 shrink-0">
        {/* `size-44!` — the important modifier beats the Chart's inline default
            height (20rem); a plain class can't, and a mismatch renders the ring
            in a taller canvas than the centred overlay expects. */}
        <Chart option={option} className="size-44!" aria-label="Breakdown" />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className="text-xl leading-none font-semibold tabular-nums">{fmt(total)}</span>
          {centerLabel ? <span className="text-sm leading-none">{centerLabel}</span> : null}
        </div>
      </div>
      <ul className="flex min-w-40 flex-1 flex-col gap-2.5">
        {rows.map((row, index) => (
          <li key={row.key} className="flex items-center gap-2.5 text-sm">
            <span
              className={`size-2.5 shrink-0 rounded-full ${DONUT_DOT[index % DONUT_DOT.length]}`}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate">{row.label}</span>
            {typeof row.sharePct === 'number' ? (
              <span className="w-10 shrink-0 text-right tabular-nums">{row.sharePct}%</span>
            ) : null}
            <span className="shrink-0 text-right font-semibold tabular-nums">{fmt(row.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
