// Radio + RadioGroup (docs/46 §3.6). SERVER components. Radio is an
// `appearance:none` input whose CHECKED inner dot is the `color` axis (`--c-bg`);
// `color` × `size`. RadioGroup is a presentational `role="radiogroup"` layout
// wrapper (vertical / horizontal) — it does NOT inject `name`, so each Radio keeps
// its standard input props (set `name` on the radios you place inside).

import * as React from 'react';
import { cx } from '../utils/cx';
import { colorClass, type ColorKey, type SizeKey } from './_recipes/variants';

export interface RadioProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'size' | 'color' | 'type'
> {
  /** Checked-dot color slot. Defaults to `primary`. */
  color?: ColorKey | (string & {});
  /** Size. Defaults to `md`. */
  size?: SizeKey;
}

const SIZE_CLASS: Record<SizeKey, string> = {
  xs: 'sf-radio--sz-xs',
  sm: 'sf-radio--sz-sm',
  md: 'sf-radio--sz-md',
  lg: 'sf-radio--sz-lg',
  xl: 'sf-radio--sz-xl',
};

export function Radio({
  color = 'primary',
  size = 'md',
  className,
  ...rest
}: RadioProps): React.ReactElement {
  return (
    <input
      {...rest}
      type="radio"
      className={cx('sf-radio', colorClass(color), SIZE_CLASS[size], className)}
    />
  );
}
Radio.displayName = 'Radio';

export type RadioGroupOrientation = 'vertical' | 'horizontal';

export interface RadioGroupProps {
  orientation?: RadioGroupOrientation;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children?: React.ReactNode;
}

export function RadioGroup({
  orientation = 'vertical',
  className,
  style,
  id,
  children,
  ...aria
}: RadioGroupProps): React.ReactElement {
  return (
    <div
      role="radiogroup"
      aria-label={aria['aria-label']}
      aria-labelledby={aria['aria-labelledby']}
      className={cx('sf-radio-group', `sf-radio-group--${orientation}`, className)}
      style={style}
      id={id}
    >
      {children}
    </div>
  );
}
RadioGroup.displayName = 'RadioGroup';
