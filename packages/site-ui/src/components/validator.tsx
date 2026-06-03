// Validator — wraps a form control and surfaces a validation hint (docs/46 §5.2).
// SERVER component, structural. Pure CSS: when any contained control is
// `:user-invalid`, the control border turns danger and the hint appears (no JS).
// The danger color is the fixed semantic token, not a selectable color axis.

import * as React from 'react';
import { cx } from '../utils/cx';

export interface ValidatorProps {
  /** Message shown when the contained control is invalid. */
  hint?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children?: React.ReactNode;
}

export function Validator({
  hint,
  className,
  style,
  id,
  children,
}: ValidatorProps): React.ReactElement {
  return (
    <div className={cx('sf-validator', className)} style={style} id={id}>
      {children}
      {hint != null ? <p className="sf-validator__hint">{hint}</p> : null}
    </div>
  );
}
Validator.displayName = 'Validator';
