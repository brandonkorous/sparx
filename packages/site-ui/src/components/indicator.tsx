// Indicator — positions a small item (badge, status) on a corner/edge of its
// content (docs/46 §5.2). Compound (Indicator + Item). SERVER component,
// structural. Wrap the content and one or more `Indicator.Item`s; each item pins to
// a `placement`.

import * as React from 'react';
import { cx } from '../utils/cx';

export type IndicatorPlacement =
  | 'top-start'
  | 'top-center'
  | 'top-end'
  | 'middle-start'
  | 'middle-center'
  | 'middle-end'
  | 'bottom-start'
  | 'bottom-center'
  | 'bottom-end';

export interface IndicatorProps {
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children?: React.ReactNode;
}

export interface IndicatorItemProps {
  /** Where the item pins. Defaults to `top-end`. */
  placement?: IndicatorPlacement;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

function IndicatorRoot({ className, style, id, children }: IndicatorProps): React.ReactElement {
  return (
    <div className={cx('st-indicator', className)} style={style} id={id}>
      {children}
    </div>
  );
}
IndicatorRoot.displayName = 'Indicator';

function IndicatorItem({
  placement = 'top-end',
  className,
  style,
  children,
}: IndicatorItemProps): React.ReactElement {
  return (
    <span
      className={cx('st-indicator__item', `st-indicator__item--${placement}`, className)}
      style={style}
    >
      {children}
    </span>
  );
}
IndicatorItem.displayName = 'IndicatorItem';

const Indicator = Object.assign(IndicatorRoot, { Item: IndicatorItem });

export { Indicator, IndicatorItem };
