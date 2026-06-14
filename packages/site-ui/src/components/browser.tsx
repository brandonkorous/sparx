// Browser — a browser-window mockup frame (docs/46 §5.2). SERVER component,
// structural. A toolbar (traffic-light dots + optional URL) over a content area;
// wraps a screenshot or live preview.

import * as React from 'react';
import { cx } from '../utils/cx';

export interface BrowserProps {
  /** Address-bar text. */
  url?: string;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children?: React.ReactNode;
}

export function Browser({ url, className, style, id, children }: BrowserProps): React.ReactElement {
  return (
    <div className={cx('st-mockup-browser', className)} style={style} id={id}>
      <div className="st-mockup-browser__toolbar">
        <span className="st-mockup__dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        {url != null ? <span className="st-mockup-browser__url">{url}</span> : null}
      </div>
      <div className="st-mockup-browser__content">{children}</div>
    </div>
  );
}
Browser.displayName = 'Browser';
