// RadialProgress — a circular progress dial (docs/46 §3.6). Color-bearing: the arc
// reads the role var `--c-bg`. Pure CSS (conic-gradient + a ring mask) driven by
// the `--st-radial-*` custom properties; `size`/`thickness` are free dimensions.
// SERVER component; `role="progressbar"` with ARIA values.

import * as React from 'react';
import { cx } from '../utils/cx';
import { colorClass, type ColorKey } from './_recipes/variants';

export interface RadialProgressProps {
  /** Current value. */
  value?: number;
  /** Maximum value. Defaults to 100. */
  max?: number;
  /** Arc color slot. Defaults to `primary`. */
  color?: ColorKey | (string & {});
  /** Diameter (number → px). Defaults to `4rem`. */
  size?: number | string;
  /** Ring thickness. Defaults to `0.5rem`. */
  thickness?: number | string;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  /** Center content. Defaults to the rounded percentage. */
  children?: React.ReactNode;
}

const dim = (v: number | string): string => (typeof v === 'number' ? `${v}px` : v);

export function RadialProgress({
  value = 0,
  max = 100,
  color = 'primary',
  size = '4rem',
  thickness = '0.5rem',
  className,
  style,
  id,
  children,
}: RadialProgressProps): React.ReactElement {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const vars = {
    '--st-radial-value': String(Math.round(pct)),
    '--st-radial-size': dim(size),
    '--st-radial-thickness': dim(thickness),
    ...style,
  } as React.CSSProperties;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cx('st-radial', colorClass(color), className)}
      style={vars}
      id={id}
    >
      <span className="st-radial__label">{children ?? `${Math.round(pct)}%`}</span>
    </div>
  );
}
RadialProgress.displayName = 'RadialProgress';
