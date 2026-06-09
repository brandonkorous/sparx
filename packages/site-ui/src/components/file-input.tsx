// FileInput — a styled native file input (docs/46 §3.6). SERVER component,
// color-bearing in its file-selector button (reads the role var `--c-bg`).
// `color` × `size`; a `ghost` variant drops the field chrome. Forwards standard
// input props.

import * as React from 'react';
import { cx } from '../utils/cx';
import {
  colorClass,
  fieldTreatmentVariants,
  type ColorKey,
  type SizeKey,
} from './_recipes/variants';
import { type FieldVariant } from './input';

export interface FileInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'size' | 'color' | 'type'
> {
  /** File-button color slot. Defaults to `primary`. */
  color?: ColorKey | (string & {});
  /** Size. Defaults to `md`. */
  size?: SizeKey;
  /** Chrome treatment. Defaults to `outline`. */
  variant?: FieldVariant;
}

const SIZE_CLASS: Record<SizeKey, string> = {
  xs: 'sf-file--sz-xs',
  sm: 'sf-file--sz-sm',
  md: 'sf-file--sz-md',
  lg: 'sf-file--sz-lg',
  xl: 'sf-file--sz-xl',
};

export function FileInput({
  color = 'primary',
  size = 'md',
  variant = 'outline',
  className,
  ...rest
}: FileInputProps): React.ReactElement {
  return (
    <input
      {...rest}
      type="file"
      className={cx(
        'sf-file',
        colorClass(color),
        SIZE_CLASS[size],
        fieldTreatmentVariants[variant],
        className
      )}
    />
  );
}
FileInput.displayName = 'FileInput';
