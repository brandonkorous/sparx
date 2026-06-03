// Label — a form field label (docs/46 §5.2). STRUCTURAL/typographic — no color
// axis (same judgment as Text/Heading): a label is text, not a fill+foreground
// control. The only color it carries is the fixed `danger` required marker, a
// semantic token, not a selectable color axis. SERVER component.

import * as React from 'react';
import { cx } from '../utils/cx';

export interface LabelProps {
  /** The id of the control this labels. */
  htmlFor?: string;
  /** Append a required marker (`*`) in the danger color. Defaults to false. */
  required?: boolean;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children?: React.ReactNode;
}

export function Label({
  htmlFor,
  required = false,
  className,
  style,
  id,
  children,
}: LabelProps): React.ReactElement {
  return (
    <label htmlFor={htmlFor} className={cx('sf-label', className)} style={style} id={id}>
      {children}
      {required ? (
        <span className="sf-label__required" aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
  );
}
Label.displayName = 'Label';
