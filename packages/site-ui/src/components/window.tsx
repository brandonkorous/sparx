// Window — an OS-window mockup frame (docs/46 §5.2). SERVER component, structural. A
// title bar (traffic-light dots + optional title) over a content area.

import * as React from 'react';
import { cx } from '../utils/cx';

export interface WindowProps {
  /** Title-bar caption. */
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children?: React.ReactNode;
}

export function Window({ title, className, style, id, children }: WindowProps): React.ReactElement {
  return (
    <div className={cx('sf-mockup-window', className)} style={style} id={id}>
      <div className="sf-mockup-window__bar">
        <span className="sf-mockup__dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        {title != null ? <span className="sf-mockup-window__title">{title}</span> : null}
      </div>
      <div className="sf-mockup-window__content">{children}</div>
    </div>
  );
}
Window.displayName = 'Window';
