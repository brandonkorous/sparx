'use client';

// TextRotate — cycles a headline through a list of phrases on a timer.
//
// One of the sparx components filling a gap in silicaui (root CLAUDE.md RULE #1).
// CLIENT component: it owns an interval + index.
//
// It sets no type styles of its own — it is an inline `<span>`, so it inherits the
// size, weight and ink of whatever heading it sits inside. Each phrase enters with
// silica's own `sui-animate-fade-in`, and the timer stops entirely under
// prefers-reduced-motion (a phrase swapping under someone who asked for less
// motion is the motion, so gating only the transition would not honour it).

import * as React from 'react';
import { cx } from '@wizeworks/silicaui-react/server';

export interface TextRotateProps {
  items: string[];
  /** Seconds per phrase. Defaults to 2.5. */
  interval?: number;
  className?: string;
  id?: string;
}

export function TextRotate({
  items,
  interval = 2.5,
  className,
  id,
}: TextRotateProps): React.ReactElement | null {
  const [index, setIndex] = React.useState(0);
  const count = items.length;

  React.useEffect(() => {
    if (count <= 1) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const ms = Math.max(0.5, interval) * 1000;
    const t = setInterval(() => setIndex((p) => (p + 1) % count), ms);
    return () => clearInterval(t);
  }, [count, interval]);

  if (count === 0) return null;
  const current = items[Math.min(index, count - 1)]!;

  return (
    <span className={cx('inline-block', className)} id={id}>
      <span key={index} className="sui-animate-fade-in inline-block">
        {current}
      </span>
    </span>
  );
}
TextRotate.displayName = 'TextRotate';
