// Join — groups adjacent controls into a single seamless unit (docs/46 §5.2).
// SERVER component, structural. Children's outer corners stay rounded while the
// inner edges square up and collapse, e.g. a button group or an input + button.

import * as React from 'react';
import { cx } from '../utils/cx';

export type JoinOrientation = 'horizontal' | 'vertical';

export interface JoinProps {
  /** Direction the items join. Defaults to `horizontal`. */
  orientation?: JoinOrientation;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children?: React.ReactNode;
}

export function Join({
  orientation = 'horizontal',
  className,
  style,
  id,
  children,
}: JoinProps): React.ReactElement {
  return (
    <div className={cx('sf-join', `sf-join--${orientation}`, className)} style={style} id={id}>
      {children}
    </div>
  );
}
Join.displayName = 'Join';
