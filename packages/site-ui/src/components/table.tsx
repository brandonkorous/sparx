// Table — a styled data table (docs/46 §5.2). SERVER component, structural. Wraps a
// native `<table>`; the caller provides `<thead>/<tbody>`. Modifiers: `zebra`
// striping, `pinRows` (sticky header), `pinCols` (sticky first/last column), and a
// `size` (cell density) scale.

import * as React from 'react';
import { cx } from '../utils/cx';
import type { SizeKey } from './_recipes/variants';

export interface TableProps extends Omit<React.TableHTMLAttributes<HTMLTableElement>, 'border'> {
  /** Alternate-row striping. */
  zebra?: boolean;
  /** Sticky header rows. */
  pinRows?: boolean;
  /** Sticky first/last columns. */
  pinCols?: boolean;
  /** Cell density. Defaults to `md`. */
  size?: SizeKey;
  /** Wraps the table in a horizontally-scrollable container. Defaults to true. */
  scrollable?: boolean;
  wrapperClassName?: string;
}

const SIZE_CLASS: Record<SizeKey, string> = {
  xs: 'sf-table--sz-xs',
  sm: 'sf-table--sz-sm',
  md: 'sf-table--sz-md',
  lg: 'sf-table--sz-lg',
  xl: 'sf-table--sz-xl',
};

export function Table({
  zebra = false,
  pinRows = false,
  pinCols = false,
  size = 'md',
  scrollable = true,
  className,
  wrapperClassName,
  children,
  ...rest
}: TableProps): React.ReactElement {
  const table = (
    <table
      {...rest}
      className={cx(
        'sf-table',
        zebra && 'sf-table--zebra',
        pinRows && 'sf-table--pin-rows',
        pinCols && 'sf-table--pin-cols',
        SIZE_CLASS[size],
        className
      )}
    >
      {children}
    </table>
  );
  if (!scrollable) return table;
  return <div className={cx('sf-table-wrap', wrapperClassName)}>{table}</div>;
}
Table.displayName = 'Table';
