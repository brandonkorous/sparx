'use client';

// Connected-app usage over time — requests per day across the window.
//
// A themed wrapper over silicaui's ECharts (`@wizeworks/silicaui-charts`), the
// sanctioned dataviz stack, matching the chat overview's VolumeChart. `<Chart>`
// auto-themes axes, gridlines and tooltip to the live `--color-*` tokens; the one
// thing it cannot guess is the series colour, so we resolve the ambient module
// hue off the DOM and hand ECharts a concrete value — which keeps the line in the
// AI module's hue with no wiring. Self-contained rather than shared: it is typed
// to this one series, and reaching across a module to reuse a chart couples two
// unrelated surfaces.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Chart, type EChartsOption } from '@wizeworks/silicaui-charts';
import type { AiTimeseriesPoint } from './data';

const SERIES_TOKENS = ['--color-module'] as const;

/** "5 Mar" for a day bucket. */
function dayLabel(bucket: string): string {
  const date = new Date(`${bucket}T00:00:00.000Z`);
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function UsageChart({ points }: { points: AiTimeseriesPoint[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [colors, setColors] = useState<string[]>([]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const cs = getComputedStyle(el);
      setColors(SERIES_TOKENS.map((n) => cs.getPropertyValue(n).trim()).filter(Boolean));
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class', 'style'],
    });
    return () => observer.disconnect();
  }, []);

  const option = useMemo<EChartsOption>(() => {
    const categories = points.map((p) => dayLabel(p.bucket));
    return {
      ...(colors.length ? { color: colors } : {}),
      grid: { left: 6, right: 12, top: 16, bottom: 2, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'line' } },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: categories,
        axisTick: { show: false },
        axisLabel: { hideOverlap: true },
      },
      yAxis: { type: 'value', splitNumber: 4, minInterval: 1 },
      series: [
        {
          name: 'Requests',
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2 },
          emphasis: { focus: 'series' },
          areaStyle: { opacity: 0.16 },
          data: points.map((p) => p.requests),
        },
      ],
    };
  }, [points, colors]);

  return (
    <div ref={ref} className="w-full">
      <Chart
        option={option}
        className="h-56! w-full"
        aria-label="Requests from connected apps, per day"
      />
    </div>
  );
}
