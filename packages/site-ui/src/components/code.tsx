// Code — a terminal/code-block mockup (docs/46 §5.2). Compound (Code + Line). SERVER
// component, structural. Each line can carry a `prefix` (e.g. `$`, `>`, a line
// number) shown in the gutter, and a `highlight` flag.

import * as React from 'react';
import { cx } from '../utils/cx';

export interface CodeProps {
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children?: React.ReactNode;
}

export interface CodeLineProps {
  /** Gutter prefix (e.g. `$`, `1`, `>`). */
  prefix?: string;
  /** Emphasize this line. */
  highlight?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

function CodeRoot({ className, style, id, children }: CodeProps): React.ReactElement {
  return (
    <div className={cx('sf-mockup-code', className)} style={style} id={id}>
      {children}
    </div>
  );
}
CodeRoot.displayName = 'Code';

function CodeLine({
  prefix,
  highlight = false,
  className,
  style,
  children,
}: CodeLineProps): React.ReactElement {
  return (
    <pre
      className={cx('sf-mockup-code__line', highlight && 'sf-mockup-code__line--hl', className)}
      style={style}
      data-prefix={prefix}
    >
      <code>{children}</code>
    </pre>
  );
}
CodeLine.displayName = 'CodeLine';

const Code = Object.assign(CodeRoot, { Line: CodeLine });

export { Code, CodeLine };
