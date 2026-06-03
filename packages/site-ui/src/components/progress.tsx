// Progress — a determinate or indeterminate progress bar (docs/46 §3.6). Its fill
// is a color, so per the recipe rule it carries the `color` axis (off the shared
// `.sf-c-*` role var → fill = `--c-bg`), plus a `size` (height) scale. Omit
// `value` for an indeterminate (animated) bar. SERVER component; `role=progressbar`
// with the ARIA value attributes for assistive tech.
//
// NOTE (judgment): the task grouped Progress under "structural, no color axis",
// but hard-rule #1 says a fill-bearing element MUST compose the recipe, and the
// daisyUI reference gives progress common colors. The recipe wins — Progress is a
// color-bearing consumer, defaulting to `primary`.

import * as React from 'react';
import { cx } from '../utils/cx';
import { colorClass, type ColorKey, type SizeKey } from './_recipes/variants';

export interface ProgressProps {
  /** Current value. Omit for an indeterminate bar. */
  value?: number;
  /** Maximum value. Defaults to 100. */
  max?: number;
  /** Fill color slot. Defaults to `primary`. */
  color?: ColorKey | (string & {});
  /** Bar height. Defaults to `md`. */
  size?: SizeKey;
  /** Accessible label for the bar. */
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}

const SIZE_CLASS: Record<SizeKey, string> = {
  xs: 'sf-progress--sz-xs',
  sm: 'sf-progress--sz-sm',
  md: 'sf-progress--sz-md',
  lg: 'sf-progress--sz-lg',
  xl: 'sf-progress--sz-xl',
};

export function Progress({
  value,
  max = 100,
  color = 'primary',
  size = 'md',
  label,
  className,
  style,
  id,
}: ProgressProps): React.ReactElement {
  const indeterminate = value == null || !Number.isFinite(value);
  const pct = indeterminate ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={indeterminate ? undefined : value}
      className={cx(
        'sf-progress',
        colorClass(color),
        SIZE_CLASS[size],
        indeterminate && 'sf-progress--indeterminate',
        className
      )}
      style={style}
      id={id}
    >
      <div className="sf-progress__fill" style={indeterminate ? undefined : { width: `${pct}%` }} />
    </div>
  );
}
Progress.displayName = 'Progress';
