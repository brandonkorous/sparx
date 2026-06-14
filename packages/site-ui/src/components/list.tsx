// List — a vertical list of rows (docs/46 §5.2). Compound (List + Row). SERVER
// component, structural. Rows are flex containers with a divider between them.

import * as React from 'react';
import { cx } from '../utils/cx';

export interface ListProps {
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children?: React.ReactNode;
}

export interface ListRowProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

function ListRoot({ className, style, id, children }: ListProps): React.ReactElement {
  return (
    <ul className={cx('st-list', className)} style={style} id={id}>
      {children}
    </ul>
  );
}
ListRoot.displayName = 'List';

function ListRow({ className, style, children }: ListRowProps): React.ReactElement {
  return (
    <li className={cx('st-list__row', className)} style={style}>
      {children}
    </li>
  );
}
ListRow.displayName = 'ListRow';

const List = Object.assign(ListRoot, { Row: ListRow });

export { List, ListRow };
