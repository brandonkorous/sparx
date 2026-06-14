// NativeSelect — a styled native `<select>` (docs/46 §3.6). SERVER component,
// sharing the `.st-input` base (focus/invalid states off the recipe) plus a
// custom chevron drawn with a `currentColor` mask (no hardcoded color). The
// `<select>` is wrapped so the chevron can sit over the (replaced) control.
// Forwards standard select props; children are the `<option>`s.

import * as React from 'react';
import { cx } from '../utils/cx';
import {
  colorClass,
  fieldTreatmentVariants,
  type ColorKey,
  type SizeKey,
} from './_recipes/variants';
import { FIELD_SIZE_CLASS, type FieldVariant } from './input';

export interface NativeSelectProps extends Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  'size' | 'color'
> {
  /** Focus-accent color slot. Defaults to `primary`. */
  color?: ColorKey | (string & {});
  /** Size. Defaults to `md`. */
  size?: SizeKey;
  /** Chrome treatment. Defaults to `outline`. */
  variant?: FieldVariant;
  /** Marks the control invalid (danger border + ring, `aria-invalid`). */
  invalid?: boolean;
  /** Class applied to the positioning wrapper (the `<select>` gets `className`). */
  wrapperClassName?: string;
  children?: React.ReactNode;
}

export function NativeSelect({
  color = 'primary',
  size = 'md',
  variant = 'outline',
  invalid = false,
  className,
  wrapperClassName,
  children,
  ...rest
}: NativeSelectProps): React.ReactElement {
  return (
    <span className={cx('st-select-wrap', wrapperClassName)}>
      <select
        {...rest}
        className={cx(
          'st-input',
          'st-select',
          colorClass(color),
          FIELD_SIZE_CLASS[size],
          fieldTreatmentVariants[variant],
          invalid && 'st-input--invalid',
          className
        )}
        aria-invalid={invalid || undefined}
      >
        {children}
      </select>
      <span className="st-select__chevron" aria-hidden="true" />
    </span>
  );
}
NativeSelect.displayName = 'NativeSelect';
