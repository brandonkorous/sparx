// Phone — a phone-device mockup frame (docs/46 §5.2). SERVER component, structural.
// A bezel with a camera notch around a display area; wraps a screenshot or preview.

import * as React from 'react';
import { cx } from '../utils/cx';

export interface PhoneProps {
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children?: React.ReactNode;
}

export function Phone({ className, style, id, children }: PhoneProps): React.ReactElement {
  return (
    <div className={cx('st-mockup-phone', className)} style={style} id={id}>
      <span className="st-mockup-phone__camera" aria-hidden="true" />
      <div className="st-mockup-phone__display">{children}</div>
    </div>
  );
}
Phone.displayName = 'Phone';
