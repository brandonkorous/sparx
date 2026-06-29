'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/**
 * Reveal — fades + rises its children into view as they enter the viewport.
 *
 * A tiny IntersectionObserver wrapper (no animation library). The motion itself
 * lives in marketing.css (`.mkt-reveal` / `.in`) and honours
 * prefers-reduced-motion, so reduced-motion users see the final state instantly.
 *
 * Layout note: this renders a single block <div>, so wrap the flex-COLUMN
 * children of a section (header / body) — not flex-ROW items, whose flex sizing
 * would not survive the extra wrapper. Pass an incrementing `index` to stagger
 * sibling reveals.
 */
export function Reveal({
  children,
  index = 0,
  className,
  style,
}: {
  children: ReactNode;
  /** Stagger order among siblings — each step adds 80ms of delay. */
  index?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
            break;
          }
        }
      },
      // threshold 0 + a small fixed bottom inset: fires once the element is ~64px
      // into view. A fixed px (not %) inset guarantees the LAST section can still
      // cross the line — a percentage inset can strand it below the fold forever.
      { threshold: 0, rootMargin: '0px 0px -64px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={['mkt-reveal', shown ? 'in' : '', className].filter(Boolean).join(' ')}
      style={{ ['--i' as string]: index, ...style }}
    >
      {children}
    </div>
  );
}
