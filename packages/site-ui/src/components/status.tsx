// Status — a small presence/state dot (docs/46 §3.6). Color-bearing: the dot fill
// reads the role var `--c-bg`. `color` × `size`, with an optional `pulse` ping.
// SERVER component; `role="status"` with an accessible label.

import * as React from 'react';
import { cx } from '../utils/cx';
import { colorClass, type ColorKey, type SizeKey } from './_recipes/variants';

export interface StatusProps {
  /** Color slot. Defaults to `neutral`. */
  color?: ColorKey | (string & {});
  /** Size. Defaults to `md`. */
  size?: SizeKey;
  /** Animate an outward ping. Defaults to false. */
  pulse?: boolean;
  /** Accessible label (e.g. "Online"). */
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}

const SIZE_CLASS: Record<SizeKey, string> = {
  xs: 'sf-status--sz-xs',
  sm: 'sf-status--sz-sm',
  md: 'sf-status--sz-md',
  lg: 'sf-status--sz-lg',
  xl: 'sf-status--sz-xl',
};

export function Status({
  color = 'neutral',
  size = 'md',
  pulse = false,
  label,
  className,
  style,
  id,
}: StatusProps): React.ReactElement {
  return (
    <span
      role="status"
      aria-label={label}
      className={cx(
        'sf-status',
        colorClass(color),
        SIZE_CLASS[size],
        pulse && 'sf-status--pulse',
        className
      )}
      style={style}
      id={id}
    />
  );
}
Status.displayName = 'Status';
