// Textarea — a multi-line input shell (docs/46 §3.6). SERVER component, sharing
// the `.sf-input` base look with Input (border, radius, focus/invalid states off
// the recipe) plus `.sf-textarea` for min-height + vertical resize. Forwards
// standard textarea props.

import * as React from 'react';
import { cx } from '../utils/cx';
import { colorClass, type ColorKey, type SizeKey } from './_recipes/variants';
import { FIELD_SIZE_CLASS, type FieldVariant } from './input';

export interface TextareaProps extends Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'color'
> {
  /** Focus-accent color slot. Defaults to `primary`. */
  color?: ColorKey | (string & {});
  /** Size. Defaults to `md`. */
  size?: SizeKey;
  /** Chrome treatment. Defaults to `default`. */
  variant?: FieldVariant;
  /** Marks the control invalid (danger border + ring, `aria-invalid`). */
  invalid?: boolean;
}

export function Textarea({
  color = 'primary',
  size = 'md',
  variant = 'default',
  invalid = false,
  className,
  ...rest
}: TextareaProps): React.ReactElement {
  return (
    <textarea
      {...rest}
      className={cx(
        'sf-input',
        'sf-textarea',
        colorClass(color),
        FIELD_SIZE_CLASS[size],
        variant === 'ghost' && 'sf-input--ghost',
        invalid && 'sf-input--invalid',
        className
      )}
      aria-invalid={invalid || undefined}
    />
  );
}
Textarea.displayName = 'Textarea';
