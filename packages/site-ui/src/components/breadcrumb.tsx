// Breadcrumb — a COMPOUND navigation trail (docs/46 §5.2). SERVER component,
// structural (no color axis). The root is a labelled <nav><ol>; items render an
// <a> when given an `href`, or the current page as plain text with
// `aria-current="page"`. Separators are drawn in CSS. Parts attach to the root
// (Breadcrumb.Item) and export by name.

import * as React from 'react';
import { cx } from '../utils/cx';

export interface BreadcrumbProps {
  /** Accessible label for the nav landmark. Defaults to `Breadcrumb`. */
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children?: React.ReactNode;
}

export interface BreadcrumbItemProps {
  /** Link target. Omit (or set `current`) for the final, non-link crumb. */
  href?: string;
  /** Marks the current page (plain text + `aria-current="page"`). */
  current?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

function BreadcrumbRoot({
  label = 'Breadcrumb',
  className,
  style,
  id,
  children,
}: BreadcrumbProps): React.ReactElement {
  return (
    <nav aria-label={label} className={cx('st-breadcrumb', className)} style={style} id={id}>
      <ol className="st-breadcrumb__list">{children}</ol>
    </nav>
  );
}
BreadcrumbRoot.displayName = 'Breadcrumb';

function BreadcrumbItem({
  href,
  current = false,
  className,
  style,
  children,
}: BreadcrumbItemProps): React.ReactElement {
  return (
    <li className={cx('st-breadcrumb__item', className)} style={style}>
      {href && !current ? (
        <a href={href} className="st-breadcrumb__link">
          {children}
        </a>
      ) : (
        <span className="st-breadcrumb__current" aria-current={current ? 'page' : undefined}>
          {children}
        </span>
      )}
    </li>
  );
}
BreadcrumbItem.displayName = 'BreadcrumbItem';

/** Breadcrumb with its item part attached: `<Breadcrumb.Item>`. Also a named export. */
const Breadcrumb = Object.assign(BreadcrumbRoot, { Item: BreadcrumbItem });

export { Breadcrumb, BreadcrumbItem };
