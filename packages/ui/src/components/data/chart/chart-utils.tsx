'use client';

import * as React from 'react';
import { MODULE_COLOR_KEYS } from '../../_recipes/variants';
import { type ValueFormatter } from './value-format';

// Shared internals for the chart primitives (docs/34 §15). Everything here is
// themed off token CSS vars so charts inherit light/dark and the active
// module's color automatically — feature code never names a hex.

export interface ChartSeries {
  /** Key in each datum holding the numeric value for this series. */
  key: string;
  /** Legend + tooltip label. Defaults to `key`. */
  label?: string;
  /**
   * Series color. Accepts:
   *  - `'module'`        → the active module's color (`--module-active`)
   *  - a module key      → e.g. `'commerce'` → `--module-commerce`
   *  - any CSS color     → `'#abc'`, `'var(--chart-2)'`, `'tomato'`
   * Omit to auto-assign from the categorical chart palette by position.
   */
  color?: string;
}

const CHART_PALETTE_SIZE = 6;

/** Resolve a `ChartSeries.color` (or absence of one) to a CSS color string. */
export function resolveSeriesColor(color: string | undefined, index: number): string {
  if (!color) return `var(--chart-${(index % CHART_PALETTE_SIZE) + 1})`;
  if (color === 'module') return 'var(--color-module)';
  if ((MODULE_COLOR_KEYS as readonly string[]).includes(color))
    return `var(--color-module-${color})`;
  return color;
}

// Shared axis / grid styling, expressed as plain objects so each chart can
// spread them onto the Recharts elements.
export const AXIS_TICK = {
  fill: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
  fontSize: 12,
} as const;
export const AXIS_LINE = { stroke: 'var(--color-base-300)' } as const;
export const GRID_STROKE = 'var(--color-base-300)';

// Value formatting lives in the pure (non-client) ./value-format module so
// server components can use it too; re-exported here for existing importers.
export {
  resolveValueFormat,
  resolveFormatter,
  type ValueFormatter,
  type ValueFormat,
  type ValueFormatKind,
} from './value-format';

interface TooltipEntry {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
  color?: string;
}

interface ChartTooltipContentProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: React.ReactNode;
  valueFormatter?: ValueFormatter;
}

/** Themed replacement for Recharts' default tooltip. */
export function ChartTooltipContent({
  active,
  payload,
  label,
  valueFormatter,
}: ChartTooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="border-base-300 bg-base-100 rounded-lg border px-3 py-2 text-xs shadow-md">
      {label != null && label !== '' && (
        <div className="text-base-content mb-1.5 font-medium">{label}</div>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((entry, i) => (
          <div key={entry.dataKey ?? i} className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: entry.color }}
            />
            <span className="text-base-content">{entry.name}</span>
            <span className="text-base-content ml-auto font-medium">
              {typeof entry.value === 'number' && valueFormatter
                ? valueFormatter(entry.value)
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface LegendEntry {
  value?: React.ReactNode;
  color?: string;
}

/** Themed legend row rendered below the plot. */
export function ChartLegendContent({ payload }: { payload?: LegendEntry[] }) {
  if (!payload || payload.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-3">
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: entry.color }}
          />
          <span className="text-base-content text-xs">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}
