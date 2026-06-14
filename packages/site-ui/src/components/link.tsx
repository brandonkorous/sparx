// Link — a themed inline anchor (docs/46 §3.6). Color-bearing: the text reads the
// role var `--c-ink` and hover reads `--c-hover`. `underline` controls when the
// rule shows. SERVER component; forwards standard anchor props.

import * as React from 'react';
import { cx } from '../utils/cx';
import { colorClass, type ColorKey } from './_recipes/variants';

export type LinkUnderline = 'always' | 'hover' | 'none';

export interface LinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'color'> {
  /** Color slot. Defaults to `primary`. */
  color?: ColorKey | (string & {});
  /** When the underline shows. Defaults to `hover`. */
  underline?: LinkUnderline;
}

export function Link({
  color = 'primary',
  underline = 'hover',
  className,
  children,
  ...rest
}: LinkProps): React.ReactElement {
  return (
    <a
      {...rest}
      className={cx('st-link', colorClass(color), `st-link--ul-${underline}`, className)}
    >
      {children}
    </a>
  );
}
Link.displayName = 'Link';
