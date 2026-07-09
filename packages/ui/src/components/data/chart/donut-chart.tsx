'use client';

import * as React from 'react';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import { cn } from '../../../utils/cn';
import {
  resolveSeriesColor,
  resolveFormatter,
  type ValueFormatter,
  type ValueFormat,
  ChartTooltipContent,
} from './chart-utils';

export type { ValueFormat } from './chart-utils';

// DonutChart — a part-to-whole ring (content mix, leads by source, AI usage by
// surface). Same token contract as the rest of the chart family: each slice's
// color accepts `'module'`, a module key, or any CSS color; omit it to draw
// from the categorical palette by position. An optional center label and a
// swatch legend make it self-describing on an overview.

export interface DonutDatum {
  label: string;
  value: number;
  /** `'module'`, a module key, or any CSS color. Defaults to the palette by position. */
  color?: string;
}

export interface DonutChartProps {
  data: DonutDatum[];
  /** Ring diameter in px. Default 132. */
  size?: number;
  /** Ring thickness in px. Default 16. */
  thickness?: number;
  /** Format slice values in the tooltip + legend (e.g. `v => `${v}%``). Client
   *  -only; from a Server Component use `valueFormat`. `valueFormatter` wins. */
  valueFormatter?: ValueFormatter;
  /** Serializable formatting spec, safe from Server Components (e.g. `'percent'`). */
  valueFormat?: ValueFormat;
  /** Large text in the ring center (e.g. a headline share or total). */
  centerValue?: React.ReactNode;
  /** Muted caption under `centerValue`. */
  centerLabel?: React.ReactNode;
  /** Render the swatch legend beside the ring. Default true. */
  legend?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function DonutChart({
  data,
  size = 132,
  thickness = 16,
  valueFormatter: valueFormatterProp,
  valueFormat,
  centerValue,
  centerLabel,
  legend = true,
  className,
  ariaLabel,
}: DonutChartProps) {
  const valueFormatter = resolveFormatter(valueFormatterProp, valueFormat);
  const colors = data.map((d, i) => resolveSeriesColor(d.color, i));

  return (
    <div className={cn('flex items-center gap-5', className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <PieChart width={size} height={size} role="img" aria-label={ariaLabel}>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={size / 2 - thickness}
            outerRadius={size / 2}
            startAngle={90}
            endAngle={-270}
            paddingAngle={data.length > 1 ? 1.5 : 0}
            stroke="none"
            isAnimationActive={false}
          >
            {data.map((d, i) => (
              <Cell key={d.label} fill={colors[i]} />
            ))}
          </Pie>
          <Tooltip
            cursor={false}
            content={<ChartTooltipContent valueFormatter={valueFormatter} />}
          />
        </PieChart>
        {(centerValue != null || centerLabel != null) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            {centerValue != null && (
              <span className="text-base-content text-xl leading-none font-medium">
                {centerValue}
              </span>
            )}
            {centerLabel != null && (
              <span className="text-base-content/50 mt-1 text-xs">{centerLabel}</span>
            )}
          </div>
        )}
      </div>

      {legend && (
        <ul className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
          {data.map((d, i) => (
            <li key={d.label} className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: colors[i] }}
              />
              <span className="text-base-content/70 truncate">{d.label}</span>
              <span className="text-base-content ml-auto pl-3 font-medium tabular-nums">
                {valueFormatter ? valueFormatter(d.value) : d.value}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
