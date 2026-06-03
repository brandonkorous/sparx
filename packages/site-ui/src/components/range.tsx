// Range — a styled slider (docs/46 §3.6). Color-bearing: the track/thumb use the
// role var `--c-bg` via `accent-color`. `color` × `size`. SERVER component;
// forwards standard input props.

import * as React from 'react';
import { cx } from '../utils/cx';
import { colorClass, type ColorKey, type SizeKey } from './_recipes/variants';

export interface RangeProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'size' | 'color' | 'type'
> {
  /** Accent color slot. Defaults to `primary`. */
  color?: ColorKey | (string & {});
  /** Size. Defaults to `md`. */
  size?: SizeKey;
}

const SIZE_CLASS: Record<SizeKey, string> = {
  xs: 'sf-range--sz-xs',
  sm: 'sf-range--sz-sm',
  md: 'sf-range--sz-md',
  lg: 'sf-range--sz-lg',
  xl: 'sf-range--sz-xl',
};

export function Range({
  color = 'primary',
  size = 'md',
  className,
  ...rest
}: RangeProps): React.ReactElement {
  return (
    <input
      {...rest}
      type="range"
      className={cx('sf-range', colorClass(color), SIZE_CLASS[size], className)}
    />
  );
}
Range.displayName = 'Range';
