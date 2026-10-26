// Where api-rest is, from inside a Piggles pod: in-cluster by service name in
// production (PIGGLES_API_REST_URL), the laptop's api-rest otherwise. Server only.

export function apiOrigin(): string {
  const configured = process.env.PIGGLES_API_REST_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return 'http://localhost:3100';
}

/** Next's cache hint, asserted once so this package need not depend on `next`. */
export const REVALIDATE_ONE_MINUTE = { next: { revalidate: 60 } } as RequestInit;

/** How long a page waits on api-rest before it renders without the answer. */
export const API_TIMEOUT_MS = 1500;

/** The one-minute cache hint plus a timeout, so a hung api-rest never holds a page. */
export function cachedWithTimeout(): RequestInit {
  return { ...REVALIDATE_ONE_MINUTE, signal: AbortSignal.timeout(API_TIMEOUT_MS) };
}
