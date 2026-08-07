// Where the workbench lives, for code that writes links someone will click in
// an email — server side only.
//
// A separate entry point rather than part of the root barrel, so nothing in a
// browser bundle can reach for `process.env` by accident. In a browser the
// answer is always `window.location.origin` and never a build-time constant.
//
// WHY THIS EXISTS AT ALL. Four environment variables named the same URL —
// `SPARX_DASHBOARD_URL`, `NEXT_PUBLIC_APP_URL`, `WORKBENCH_BASE_URL`,
// `NEXT_PUBLIC_DASHBOARD_URL` — and each emitter picked one, with its own
// fallback, so which host an email pointed at depended on which service sent it.
// Only `NEXT_PUBLIC_APP_URL` was actually set in all three environments; the
// others were set in one each. `SPARX_APP_URL` is now the canonical name and is
// set everywhere, and the rest are kept as fallbacks so nothing breaks in the
// window between the config landing and the images rolling.

import { buildPath } from './resolve';
import type { LinkOptions } from './types';

/** Last resort in production. The workbench has served this host since it replaced the dashboard. */
const DEFAULT_ORIGIN = 'https://app.sparx.works';

/**
 * Last resort on a developer's laptop, where none of these variables is set.
 *
 * Port 3011 is the workbench. Several emitters carried their own local fallback
 * and one still said 3001 — the DASHBOARD's port, from before it was removed — so
 * every invitation link generated locally pointed at nothing. Getting this right
 * once, here, is the point of the whole file.
 */
const DEV_ORIGIN = 'http://localhost:3011';

/**
 * Ordered by intent, not by age: the canonical name first, then the legacy names
 * in the order they were introduced. Reading them in a fixed order in ONE place
 * is the whole point — an emitter that consults its own two-name fallback chain
 * is an emitter that can disagree with its neighbour about where the app is.
 */
const ORIGIN_VARS = [
  'SPARX_APP_URL',
  'SPARX_DASHBOARD_URL',
  'NEXT_PUBLIC_APP_URL',
  'WORKBENCH_BASE_URL',
  'NEXT_PUBLIC_DASHBOARD_URL',
] as const;

/** The workbench origin, with no trailing slash. */
export function appOrigin(): string {
  if (typeof process === 'undefined') return DEFAULT_ORIGIN;
  for (const name of ORIGIN_VARS) {
    const value = process.env[name];
    if (typeof value === 'string' && value.trim() !== '') return value.trim().replace(/\/$/, '');
  }
  // Nothing configured. In production that is a misconfiguration and the public
  // host is the only safe guess; anywhere else it is simply a laptop, where
  // guessing production would send every locally-generated link to the live app.
  return process.env.NODE_ENV === 'production' ? DEFAULT_ORIGIN : DEV_ORIGIN;
}

/**
 * An absolute link to a surface, resolved against the configured origin.
 *
 * This is what a service calls. It never takes a surface key from a caller's
 * imagination — `buildPath` returns null for a surface that is not in the table,
 * and null for a detail address with no record, so a link is either right or
 * absent. Absent is recoverable (the email says what happened without a button);
 * a link to `/undefined` is not.
 */
export function appLink(
  surface: string,
  params?: Readonly<Record<string, string | undefined>>,
  options?: Omit<LinkOptions, 'origin'>
): string | null {
  return buildPath(surface, params, { ...options, origin: appOrigin() });
}
