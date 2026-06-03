'use client';

// TextRotate — cycles through a list of phrases on a timer (docs/46 §5.2). CLIENT
// component: it owns an interval + index (same justification as Carousel). Honors
// reduced-motion by simply showing the first item (no cycling) when paused via CSS
// is not possible for a timer, so it always cycles but the transition is CSS-gated.

import * as React from 'react';
import { cx } from '../utils/cx';

export interface TextRotateProps {
  items: string[];
  /** Seconds per phrase. Defaults to 2.5. */
  interval?: number;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}

export function TextRotate({
  items,
  interval = 2.5,
  className,
  style,
  id,
}: TextRotateProps): React.ReactElement | null {
  const [index, setIndex] = React.useState(0);
  const count = items.length;

  React.useEffect(() => {
    if (count <= 1) return;
    const ms = Math.max(0.5, interval) * 1000;
    const t = setInterval(() => setIndex((p) => (p + 1) % count), ms);
    return () => clearInterval(t);
  }, [count, interval]);

  if (count === 0) return null;
  const current = items[Math.min(index, count - 1)]!;

  return (
    <span className={cx('sf-textrotate', className)} style={style} id={id}>
      <span key={index} className="sf-textrotate__item">
        {current}
      </span>
    </span>
  );
}
TextRotate.displayName = 'TextRotate';
