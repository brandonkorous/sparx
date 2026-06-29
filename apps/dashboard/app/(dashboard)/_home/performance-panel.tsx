import {
  AreaChart,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  LineChart,
  ModuleProvider,
  Stack,
  Text,
  cn,
} from '@sparx/ui';

import { SampleBadge } from '../_components/overview-bits';
import { MetricSwitcher } from './controls';
import type { PerfPanel } from './types';

// The hero trend chart — the "explain the movement" layer. One metric at a time
// (switcher), the period total + delta-vs-previous as the headline, and the
// previous-period ghost overlaid when comparing. The card stays NEUTRAL: its hue
// would track the active metric's module and so collide with whichever deep-dive
// card owns that hue (revenue→Sales-by-channel, subscribers→Email, …), breaking
// the one-tinted-card-per-hue rule. The module signal rides the chart line
// (series color="module"), so identity isn't lost — the deep-dive cards below
// remain the stable single tint per hue.

const DELTA_CLASS: Record<string, string> = {
  up: 'text-[var(--color-success-text)]',
  down: 'text-[var(--color-danger-text)]',
  neutral: 'text-[var(--color-text-tertiary)]',
};

export function PerformancePanel({ perf, rangeLabel }: { perf: PerfPanel; rangeLabel: string }) {
  const { metric, available, points, total, delta, isSample } = perf;
  const comparing = points.some((p) => p.prev != null);

  const chart = comparing ? (
    <LineChart
      data={points}
      xKey="label"
      height={280}
      valueFormat={metric.format}
      series={[
        { key: 'value', label: metric.label, color: 'module' },
        { key: 'prev', label: 'Previous period', color: 'var(--color-text-tertiary)' },
      ]}
      ariaLabel={`${metric.label} over ${rangeLabel}`}
    />
  ) : (
    <AreaChart
      data={points}
      xKey="label"
      height={280}
      valueFormat={metric.format}
      series={[{ key: 'value', label: metric.label, color: 'module' }]}
      ariaLabel={`${metric.label} over ${rangeLabel}`}
    />
  );

  return (
    <ModuleProvider module={metric.module}>
      <Card>
        <CardHeader>
          <Stack direction="row" align="start" justify="between" gap={3} className="flex-wrap">
            <Stack gap={1}>
              <CardTitle>Performance</CardTitle>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight text-[var(--color-text-primary)] tabular-nums">
                  {total}
                </span>
                {delta && (
                  <span className={cn('text-sm font-medium', DELTA_CLASS[delta.trend])}>
                    {delta.value}
                  </span>
                )}
              </div>
              <Text size="sm" variant="muted">
                {metric.caption} · {rangeLabel}
              </Text>
            </Stack>
            <Stack align="end" gap={2}>
              {isSample && <SampleBadge reason="no-data" />}
              <MetricSwitcher active={metric.key} metrics={available} />
            </Stack>
          </Stack>
        </CardHeader>
        <CardContent>{chart}</CardContent>
      </Card>
    </ModuleProvider>
  );
}
