// FAB / Speed Dial — a floating action button with optional expanding actions
// (docs/46 §5.2). SERVER component, color-bearing (the main button dogfoods the
// recipe's solid treatment off `--c-bg`). `placement` pins it to a corner; the
// `actions` reveal on hover/focus (CSS group), no JS. The main control is an `<a>`
// (href) or `<button>`.

import * as React from 'react';
import { cx } from '../utils/cx';
import { colorClass, type ColorKey } from './_recipes/variants';

export type FABPlacement = 'bottom-end' | 'bottom-start' | 'top-end' | 'top-start';

export interface FABProps {
  /** Color slot for the main button. Defaults to `primary`. */
  color?: ColorKey | (string & {});
  /** Corner placement. Defaults to `bottom-end`. */
  placement?: FABPlacement;
  href?: string;
  'aria-label': string;
  /** Optional speed-dial actions revealed on hover/focus. */
  actions?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  /** The main button icon/content. */
  children?: React.ReactNode;
}

export function FAB({
  color = 'primary',
  placement = 'bottom-end',
  href,
  actions,
  className,
  style,
  id,
  children,
  ...aria
}: FABProps): React.ReactElement {
  const label = aria['aria-label'];
  const mainClass = cx('sf-fab__main', colorClass(color), 'sf-v-solid');
  return (
    <div className={cx('sf-fab', `sf-fab--${placement}`, className)} style={style} id={id}>
      {actions ? <div className="sf-fab__actions">{actions}</div> : null}
      {href ? (
        <a href={href} className={mainClass} aria-label={label}>
          {children}
        </a>
      ) : (
        <button type="button" className={mainClass} aria-label={label}>
          {children}
        </button>
      )}
    </div>
  );
}
FAB.displayName = 'FAB';
