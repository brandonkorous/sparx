// Switch (Toggle) — a styled on/off control (docs/46 §3.6). SERVER component: an
// `appearance:none` checkbox rendered as a track + sliding knob. The CHECKED track
// fill is the `color` axis (`--c-bg`); `role="switch"` for assistive tech.
// `color` × `size`. Forwards standard input props.

import * as React from 'react';
import { cx } from '../utils/cx';
import { colorClass, type ColorKey, type SizeKey } from './_recipes/variants';

export interface SwitchProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'size' | 'color' | 'type'
> {
  /** Checked-track color slot. Defaults to `primary`. */
  color?: ColorKey | (string & {});
  /** Size. Defaults to `md`. */
  size?: SizeKey;
}

const SIZE_CLASS: Record<SizeKey, string> = {
  xs: 'st-switch--sz-xs',
  sm: 'st-switch--sz-sm',
  md: 'st-switch--sz-md',
  lg: 'st-switch--sz-lg',
  xl: 'st-switch--sz-xl',
};

export function Switch({
  color = 'primary',
  size = 'md',
  className,
  ...rest
}: SwitchProps): React.ReactElement {
  return (
    <input
      {...rest}
      type="checkbox"
      role="switch"
      className={cx('st-switch', colorClass(color), SIZE_CLASS[size], className)}
    />
  );
}
Switch.displayName = 'Switch';
