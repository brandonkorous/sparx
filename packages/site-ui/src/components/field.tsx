// Field — a form-row wrapper composing label + control + hint/error (docs/46
// §5.2). SERVER component. Structural shell (no color axis of its own); it reuses
// the Label component and renders the error in the danger token. When both `hint`
// and `error` are present, the error wins (and is wired via `aria-describedby` by
// the caller using the provided ids if needed).

import * as React from 'react';
import { cx } from '../utils/cx';
import { Label } from './label';

export interface FieldProps {
  /** Field label text. */
  label?: React.ReactNode;
  /** The id of the control (sets the label's `for`). */
  htmlFor?: string;
  /** Helper text shown below the control when there's no error. */
  hint?: React.ReactNode;
  /** Error message (replaces the hint, rendered in the danger color). */
  error?: React.ReactNode;
  /** Append a required marker to the label. */
  required?: boolean;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children?: React.ReactNode;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  className,
  style,
  id,
  children,
}: FieldProps): React.ReactElement {
  return (
    <div className={cx('st-field', className)} style={style} id={id}>
      {label ? (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      ) : null}
      <div className="st-field__control">{children}</div>
      {error ? (
        <p className="st-field__error">{error}</p>
      ) : hint ? (
        <p className="st-field__hint">{hint}</p>
      ) : null}
    </div>
  );
}
Field.displayName = 'Field';
