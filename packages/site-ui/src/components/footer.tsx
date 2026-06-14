// Footer — a site footer (docs/46 §5.2). Compound (Footer + Column + Title). SERVER
// component, structural. `center` centers a single-row footer; otherwise columns
// flow in a responsive grid.

import * as React from 'react';
import { cx } from '../utils/cx';

export interface FooterProps {
  /** Center the footer content (single-row layout). Defaults to false. */
  center?: boolean;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children?: React.ReactNode;
}

export interface FooterSlotProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

function FooterRoot({
  center = false,
  className,
  style,
  id,
  children,
}: FooterProps): React.ReactElement {
  return (
    <footer
      className={cx('st-footer', center && 'st-footer--center', className)}
      style={style}
      id={id}
    >
      {children}
    </footer>
  );
}
FooterRoot.displayName = 'Footer';

function FooterColumn({ className, style, children }: FooterSlotProps): React.ReactElement {
  return (
    <div className={cx('st-footer__col', className)} style={style}>
      {children}
    </div>
  );
}
FooterColumn.displayName = 'FooterColumn';

function FooterTitle({ className, style, children }: FooterSlotProps): React.ReactElement {
  return (
    <h6 className={cx('st-footer__title', className)} style={style}>
      {children}
    </h6>
  );
}
FooterTitle.displayName = 'FooterTitle';

const Footer = Object.assign(FooterRoot, { Column: FooterColumn, Title: FooterTitle });

export { Footer, FooterColumn, FooterTitle };
