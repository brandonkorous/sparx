// `data-sx-counter` — animated count-up stats (docs/98 Pillar 5 / docs/103).
//
// Each `[data-sx-item]` holds a target value as authored text — "10,000+", "98%",
// "$2.4M", "4.9". On first scroll into view (IntersectionObserver, `data-sx-duration`
// ms) the numeric part counts up from zero to the authored value, preserving any
// prefix/suffix and the thousands/decimal formatting. Like every behavior it only
// WIRES authored DOM — it never creates elements. In the canvas (ctx.edit) and under
// prefers-reduced-motion it leaves the authored final value in place (no animation),
// matching the carousel/marquee canvas-suppression convention.

import { type Behavior, type BehaviorCleanup, disposer, noop, numAttr } from './types';

interface CounterTarget {
  el: HTMLElement;
  /** The authored full text, e.g. "10,000+". */
  raw: string;
  /** The numeric substring matched within `raw`, e.g. "10,000". */
  token: string;
  /** Its parsed value, e.g. 10000. */
  value: number;
}

const NUMBER_RE = /-?\d[\d,]*\.?\d*/;

/** Format `value` to look like the authored `token` — same decimal places, and
 *  re-inserting thousands separators when the original had them. */
function formatLike(token: string, value: number): string {
  const decimals = token.includes('.') ? (token.split('.')[1]?.length ?? 0) : 0;
  const fixed = value.toFixed(decimals);
  if (!token.includes(',')) return fixed;
  const [int = '', dec] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec ? `${grouped}.${dec}` : grouped;
}

type Paint = (t: CounterTarget, value: number) => void;

/** The count-up targets under a root — each `[data-sx-item]` whose text holds a number. */
function collectTargets(root: HTMLElement): CounterTarget[] {
  const out: CounterTarget[] = [];
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('[data-sx-item]'))) {
    const raw = (el.textContent ?? '').trim();
    const match = NUMBER_RE.exec(raw);
    if (!match) continue;
    out.push({ el, raw, token: match[0], value: Number(match[0].replace(/,/g, '')) });
  }
  return out;
}

/** Animate every target from 0 to its value over `duration` ms; returns a canceller. */
function runCountUp(targets: CounterTarget[], paint: Paint, duration: number): BehaviorCleanup {
  const start = performance.now();
  let frame = 0;
  const tick = (now: number): void => {
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic — fast then settle
    targets.forEach((t) => paint(t, t.value * eased));
    if (p < 1) frame = requestAnimationFrame(tick);
    else targets.forEach((t) => paint(t, t.value)); // land exactly on the target
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

export const counter: Behavior = (root, ctx) => {
  const targets = collectTargets(root);
  if (targets.length === 0) return noop;
  const paint: Paint = (t, value) => {
    t.el.textContent = t.raw.replace(t.token, formatLike(t.token, value));
  };

  // Canvas + reduced-motion: keep the authored final value, don't animate.
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  if (ctx.edit || reduce) return noop;

  const duration = Math.max(200, numAttr(root, 'duration', 1400, 200));
  const d = disposer();
  targets.forEach((t) => paint(t, 0)); // reset to zero, then count up on intersection

  let started = false;
  const begin = (): void => {
    if (started) return;
    started = true;
    d.add(runCountUp(targets, paint, duration));
  };

  if (typeof IntersectionObserver === 'function') {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          begin();
          io.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    io.observe(root);
    d.add(() => io.disconnect());
  } else {
    begin(); // no observer support → just play once
  }
  return d.run;
};
