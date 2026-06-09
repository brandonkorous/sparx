// Input — a text input shell (docs/46 §3.6). SERVER component, presentational:
// it forwards standard input props (name/value/defaultValue/placeholder/…) and
// owns only the styling. The recipe shows up in the *states*: the focus ring reads
// the `color` axis (`--c-bg`), and `invalid` flips border + ring to the danger
// role. A `ghost` variant drops the chrome until focus.

import * as React from 'react';
import { cx } from '../utils/cx';
import {
  colorClass,
  fieldTreatmentVariants,
  type ColorKey,
  type FieldTreatmentKey,
  type SizeKey,
} from './_recipes/variants';

/** The field `variant` axis (docs/35) — outline | filled | ghost. Re-exported as
 *  `FieldVariant` for the controls that share it (Textarea/NativeSelect/FileInput). */
export type FieldVariant = FieldTreatmentKey;

export interface InputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
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
}

export const FIELD_SIZE_CLASS: Record<SizeKey, string> = {
  xs: 'sf-input--sz-xs',
  sm: 'sf-input--sz-sm',
  md: 'sf-input--sz-md',
  lg: 'sf-input--sz-lg',
  xl: 'sf-input--sz-xl',
};

export function Input({
  color = 'primary',
  size = 'md',
  variant = 'outline',
  invalid = false,
  className,
  ...rest
}: InputProps): React.ReactElement {
  return (
    <input
      {...rest}
      className={cx(
        'sf-input',
        colorClass(color),
        FIELD_SIZE_CLASS[size],
        fieldTreatmentVariants[variant],
        invalid && 'sf-input--invalid',
        className
      )}
      aria-invalid={invalid || undefined}
    />
  );
}
Input.displayName = 'Input';
