'use client';

import { useEffect, useRef, useState } from 'react';

/** Ease-out cubic: fast off the mark, settling rather than slamming. */
const eased = (p: number) => 1 - Math.pow(1 - p, 3);

/**
 * Counts up to `to` each time `run()` is called. Returns the live figure.
 *
 * The timer is the correctness guarantee, not belt-and-braces: a browser stops
 * serving frames to a hidden tab, so without it "press, switch tabs, come back"
 * leaves the figure frozen at zero.
 */
export function useCountUp(to: number, ms = 650) {
  const [value, setValue] = useState(to);
  const raf = useRef<number | null>(null);
  const land = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      if (land.current) clearTimeout(land.current);
    },
    []
  );

  const run = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    if (land.current) clearTimeout(land.current);

    // Reduced motion gets the answer and no theatre. Read at click time, so
    // changing the setting mid-visit is respected without a listener.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(to);
      return;
    }

    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      setValue(Math.round(eased(p) * to));
      raf.current = p < 1 ? requestAnimationFrame(step) : null;
    };

    setValue(0);
    raf.current = requestAnimationFrame(step);
    land.current = setTimeout(() => {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = null;
      setValue(to);
    }, ms + 60);
  };

  return { value, run };
}
