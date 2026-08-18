'use client';

// StatValue — renders a stat figure, optionally counting up from zero the first
// time it scrolls into view. Only the numeric core of the string is animated;
// any prefix ("$", "~") and suffix ("+", "%", "/mo", "K") are preserved, as is
// the original thousands grouping and decimal precision. Degrades to the static
// value with no JS or under prefers-reduced-motion (and for non-numeric values).

import { useEffect, useRef, useState } from 'react';

const DURATION_MS = 1400;

// prefix (non-digit lead) | numeric core (digits, commas, dots) | suffix (rest)
const PARTS = /^(\D*?)(\d[\d.,]*)(.*)$/s;

interface Parsed {
  prefix: string;
  suffix: string;
  target: number;
  decimals: number;
  grouped: boolean;
}

function parse(value: string): Parsed | null {
  const m = PARTS.exec(value);
  if (!m) return null;
  const prefix = m[1] ?? '';
  const core = m[2] ?? '';
  const suffix = m[3] ?? '';
  const target = Number(core.replace(/,/g, ''));
  if (!Number.isFinite(target)) return null;
  const dot = core.indexOf('.');
  const decimals = dot === -1 ? 0 : core.length - dot - 1;
  return { prefix, suffix, target, decimals, grouped: core.includes(',') };
}

function format(n: number, p: Parsed): string {
  const num = p.grouped
    ? n.toLocaleString('en-US', {
        minimumFractionDigits: p.decimals,
        maximumFractionDigits: p.decimals,
      })
    : n.toFixed(p.decimals);
  return `${p.prefix}${num}${p.suffix}`;
}

// easeOutCubic — fast start, gentle settle.
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export function StatValue({ value, animate }: { value: string; animate: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  // First render (server + hydration) shows the final value, so no-JS and SEO
  // see the real number and hydration matches.
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || !animate) return;
    const parsed = parse(value);
    if (!parsed) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    // Reset to the start before it's revealed so the count-up reads from zero.
    setDisplay(format(0, parsed));

    let raf = 0;
    let startTs = 0;
    const step = (ts: number) => {
      if (!startTs) startTs = ts;
      const t = Math.min(1, (ts - startTs) / DURATION_MS);
      setDisplay(format(parsed.target * ease(t), parsed));
      if (t < 1) raf = requestAnimationFrame(step);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            io.disconnect();
            raf = requestAnimationFrame(step);
            break;
          }
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);

    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, animate]);

  return (
    <span
      ref={ref}
      className="text-[clamp(1.75rem,3vw,2.5rem)] leading-none font-bold tracking-[-0.02em] tabular-nums"
    >
      {display}
    </span>
  );
}
