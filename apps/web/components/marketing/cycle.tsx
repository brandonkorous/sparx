'use client';

import * as React from 'react';

/**
 * Crossfades through a set of items on a timer — the marketing site's
 * "industry rotation" device. It proves a capability is vertical-agnostic by
 * cycling ONE focal example (a product, an audience noun, a whole authored
 * receipt scene) instead of anchoring the page on a single kind of business.
 * See [[feedback-industry-agnostic-no-diesel]] and the rotation rule in
 * `.claude/agents/marketing-designer.md`.
 *
 * Restraint is the contract: ONE <Cycle> per page, on the focal proof only,
 * slow. Everything around it stays still — multiple competing animations read
 * as a casino, not a demonstration.
 *
 * - No layout shift: items are grid-stacked into a single cell, so the box is
 *   sized to the TALLEST item and never reflows as it rotates. Author scenes to
 *   the same shape (e.g. same line-item count) so the box doesn't jump.
 * - Respects prefers-reduced-motion: pins to the first item, no timer, no fade.
 * - SSR-safe: the first item renders on the server (index 0 on both sides), so
 *   there's no hydration mismatch; rotation begins after mount.
 * - The rotation is decorative — inactive layers are aria-hidden, so assistive
 *   tech reads one coherent item rather than a flicker of all of them.
 */
export function Cycle({
  items,
  interval = 3400,
  fadeMs = 500,
  className,
  style,
}: {
  items: React.ReactNode[];
  /** ms each item is shown before the crossfade to the next. */
  interval?: number;
  /** crossfade duration in ms. */
  fadeMs?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (items.length <= 1) return;
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, interval);
    return () => window.clearInterval(id);
  }, [items.length, interval]);

  return (
    <div
      // minmax(0, 1fr) lets the single stacked column shrink below its
      // content's intrinsic width, so a wide focal surface (e.g. a product
      // frame with a long URL) never forces page overflow on narrow viewports.
      className={['grid grid-cols-[minmax(0,1fr)]', className].filter(Boolean).join(' ')}
      style={style}
    >
      {items.map((item, i) => (
        <div
          // Static list rendered once; index is positional and stable.
          key={i}
          aria-hidden={i === index ? undefined : true}
          className="col-start-1 row-start-1 min-w-0"
          // Crossfade state is per-item and index-driven, so it stays inline.
          style={{
            opacity: i === index ? 1 : 0,
            transition: `opacity ${fadeMs}ms ease`,
            pointerEvents: i === index ? undefined : 'none',
          }}
        >
          {item}
        </div>
      ))}
    </div>
  );
}
