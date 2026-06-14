// Checkbox — a styled native checkbox (docs/46 §3.6). SERVER component: an
// `appearance:none` input whose CHECKED fill is the `color` axis (`--c-bg`), with
// a checkmark drawn from a mask. `color` × `size`. Forwards standard input props.

import * as React from 'react';
import { cx } from '../utils/cx';
import { colorClass, type ColorKey, type SizeKey } from './_recipes/variants';

export interface CheckboxProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'size' | 'color' | 'type'
> {
  /** Checked-fill color slot. Defaults to `primary`. */
  color?: ColorKey | (string & {});
  /** Size. Defaults to `md`. */
  size?: SizeKey;
}

const SIZE_CLASS: Record<SizeKey, string> = {
  xs: 'st-checkbox--sz-xs',
  sm: 'st-checkbox--sz-sm',
  md: 'st-checkbox--sz-md',
  lg: 'st-checkbox--sz-lg',
  xl: 'st-checkbox--sz-xl',
};

export function Checkbox({
  color = 'primary',
  size = 'md',
  className,
  ...rest
}: CheckboxProps): React.ReactElement {
  return (
    <input
      {...rest}
      type="checkbox"
      className={cx('st-checkbox', colorClass(color), SIZE_CLASS[size], className)}
    />
  );
}
Checkbox.displayName = 'Checkbox';
