// Diff — a draggable before/after comparison (docs/46 §5.2). SERVER component,
// structural (CSS-only resize, no JS). Compound: Diff.Item1 (the resizable top
// layer) over Diff.Item2, with a Diff.Resizer handle.

import * as React from 'react';
import { cx } from '../utils/cx';

export interface DiffProps {
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children?: React.ReactNode;
}

export interface DiffSlotProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

function DiffRoot({ className, style, id, children }: DiffProps): React.ReactElement {
  return (
    <figure className={cx('st-diff', className)} style={style} id={id}>
      {children}
    </figure>
  );
}
DiffRoot.displayName = 'Diff';

function DiffItem1({ className, style, children }: DiffSlotProps): React.ReactElement {
  return (
    <div className={cx('st-diff__item-1', className)} style={style}>
      {children}
    </div>
  );
}
DiffItem1.displayName = 'DiffItem1';

function DiffItem2({ className, style, children }: DiffSlotProps): React.ReactElement {
  return (
    <div className={cx('st-diff__item-2', className)} style={style}>
      {children}
    </div>
  );
}
DiffItem2.displayName = 'DiffItem2';

function DiffResizer({ className, style }: DiffSlotProps): React.ReactElement {
  return <div className={cx('st-diff__resizer', className)} style={style} aria-hidden="true" />;
}
DiffResizer.displayName = 'DiffResizer';

const Diff = Object.assign(DiffRoot, {
  Item1: DiffItem1,
  Item2: DiffItem2,
  Resizer: DiffResizer,
});

export { Diff, DiffItem1, DiffItem2, DiffResizer };
