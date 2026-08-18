'use client';

import { useEffect, useState } from 'react';

/**
 * Rotates a single word in place — the leading noun of the hero tagline —
 * while "ignited." stays fixed beneath it. Cycling through every offering lets
 * the one-liner speak for the whole platform (content, commerce, CRM, …), not
 * just the shop.
 *
 * - SSR-safe: renders words[0] on the server and the first client paint, so
 *   there is no hydration mismatch; rotation only starts after mount.
 * - Honors prefers-reduced-motion: holds on the first word with no animation.
 * - Decorative, not a live region — the surrounding <h1> reads as a complete
 *   tagline to assistive tech without announcing every swap.
 */
export function RotatingWord({
  words,
  holdMs = 1900,
  fadeMs = 420,
}: {
  words: readonly string[];
  holdMs?: number;
  fadeMs?: number;
}) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (words.length <= 1) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let swap: ReturnType<typeof setTimeout>;
    const tick = setInterval(() => {
      setVisible(false); // fade the current word out
      swap = setTimeout(() => {
        setIndex((i) => (i + 1) % words.length);
        setVisible(true); // fade the next word in
      }, fadeMs);
    }, holdMs + fadeMs);

    return () => {
      clearInterval(tick);
      clearTimeout(swap);
    };
  }, [words.length, holdMs, fadeMs]);

  return (
    <span
      style={{
        display: 'inline-block',
        transition: `opacity ${fadeMs}ms ease, transform ${fadeMs}ms ease`,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(0.14em)',
        willChange: 'opacity, transform',
      }}
    >
      {words[index]}
    </span>
  );
}
