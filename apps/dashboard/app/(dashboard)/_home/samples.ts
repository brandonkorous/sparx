import type { SiteSourceRow, SiteTopPage } from './types';

// Illustrative fallbacks for the always-visible spine (hero chart, traffic
// sources, top pages, funnel) so a brand-new or quiet tenant still sees a
// populated command center instead of a wall of empty states — shown behind an
// "Example data" badge and replaced the moment real data exists (docs/97 §9).
// Deterministic (no RNG) so server render + hydration match.

/** A gentle upward-trending series of `n` points, scaled around `base`. */
export function sampleSeries(n: number, base: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const trend = base * (0.6 + (i / Math.max(1, n - 1)) * 0.6);
    const wobble = Math.sin(i * 1.1) * base * 0.12 + Math.cos(i * 0.5) * base * 0.06;
    out.push(Math.max(0, Math.round(trend + wobble)));
  }
  return out;
}

export const SAMPLE_SOURCES: SiteSourceRow[] = [
  { source: 'search', visits: 480 },
  { source: 'direct', visits: 260 },
  { source: 'social', visits: 180 },
  { source: 'referral', visits: 80 },
];

export const SAMPLE_TOP_PAGES: SiteTopPage[] = [
  { path: '/', views: 9840, visitors: 7090 },
  { path: '/shop', views: 6210, visitors: 4470 },
  { path: '/about', views: 1690, visitors: 1220 },
  { path: '/blog/getting-started', views: 1120, visitors: 960 },
];

/** Sample conversion funnel (counts), used when there's no live session data. */
export const SAMPLE_FUNNEL = {
  visitors: 8420,
  sessions: 6180,
  leads: 940,
  addToCart: 1320,
  checkout: 720,
  orders: 184,
};
