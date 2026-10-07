// The signup source, for the Google path. Google leaves the site mid-form, so the
// source rides in the return address, and the page it lands on records it.

const SETUP_PATH = '/onboarding';

/** `path` with the source on it, or `path` unchanged when there is none. */
export function withSource(path: string, from: string, attribution: string): string {
  if (!from && !attribution) return path;
  const q = new URLSearchParams();
  if (from) q.set('from', from);
  if (attribution) q.set('a', attribution);
  return `${path}?${q.toString()}`;
}

/** Signup's Google return. Only for a brand-new business: an invitation link (any
 *  other `next`) is joining a business, not starting one. */
export function googleReturnPath(next: string, from: string, attribution: string): string {
  return next === SETUP_PATH ? withSource(SETUP_PATH, from, attribution) : next;
}
