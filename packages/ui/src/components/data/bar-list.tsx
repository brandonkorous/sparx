import * as React from 'react';
import { cn } from '../../utils/cn';
import { Progress } from './progress';
import { type ColorKey } from '../_recipes/variants';
import { resolveFormatter, type ValueFormat } from './chart/value-format';

// BarList — a labelled set of horizontal proportional bars (traffic sources,
// A/R aging buckets, model mix, pipeline stages). Each row is label · track ·
// value; the track reuses <Progress> so it themes off the same role vars. Bars
// scale to `max` (defaults to the largest value) so the set reads comparatively.

export interface BarListItem {
  label: React.ReactNode;
  /** Numeric magnitude that drives the bar width. */
  value: number;
  /** What to render on the right. Defaults to `valueFormatter(value)` or `value`. */
  display?: React.ReactNode;
  /** Per-row fill color override (e.g. aging buckets going amber → danger). */
  color?: ColorKey | (string & {});
  /** Stable key when `label` isn't a plain string. */
  key?: string;
}

export interface BarListProps extends React.HTMLAttributes<HTMLDivElement> {
  items: BarListItem[];
  /** Upper bound for bar width. Default = max value in `items`. */
  max?: number;
  /** Fill color for rows without their own `color`. Default `module`. */
  color?: ColorKey | (string & {});
  /** Hide the right-hand value column. */
  showValue?: boolean;
  /** Format the default right-hand value (client callers). */
  valueFormatter?: (value: number) => string;
  /** Serializable formatting spec, safe from Server Components (e.g. `'percent'`). */
  valueFormat?: ValueFormat;
}

export const BarList = React.forwardRef<HTMLDivElement, BarListProps>(
  (
    {
      className,
      items,
      max,
      color = 'module',
      showValue = true,
      valueFormatter: valueFormatterProp,
      valueFormat,
      ...props
    },
    ref
  ) => {
    const valueFormatter = resolveFormatter(valueFormatterProp, valueFormat);
    const ceiling = max ?? Math.max(1, ...items.map((i) => i.value));
    return (
      <div ref={ref} className={cn('flex flex-col gap-3', className)} {...props}>
        {items.map((item, i) => {
          const display =
            item.display ?? (valueFormatter ? valueFormatter(item.value) : item.value);
          return (
            <div
              key={item.key ?? i}
              className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 text-sm"
            >
              <span className="text-base-content/70 truncate">{item.label}</span>
              <Progress value={item.value} max={ceiling} color={item.color ?? color} />
              {showValue && (
                <span className="text-base-content text-right font-medium tabular-nums">
                  {display}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }
);
BarList.displayName = 'BarList';
