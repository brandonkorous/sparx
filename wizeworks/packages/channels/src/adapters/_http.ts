// Shared HTTP + OAuth helpers for the concrete channel adapters. Keeps the
// fetch-with-timeout, error-describe, platform-credential, and OAuth-response
// shapes uniform across Google / Meta / Pinterest (and future order adapters).
//
// Adapters are pure I/O against the channel's REST API — no SDKs, just `fetch`
// (mirrors the dropship printify adapter). The worker resolves the per-tenant
// access token; these helpers read sparx's PLATFORM app credentials from env.

const DEFAULT_TIMEOUT_MS = 20_000;

/** sparx's registered OAuth app credentials for one channel (NOT per-tenant). */
export interface PlatformOAuthCreds {
  clientId: string;
  clientSecret: string;
}

/** Read a channel's platform OAuth app credentials from env. Returns null when
 *  either half is missing → the adapter reports `isConfigured() === false` and the
 *  channel stays `coming_soon` until ops sets the env (docs/106 §4.6). */
export function readPlatformCreds(idVar: string, secretVar: string): PlatformOAuthCreds | null {
  const clientId = process.env[idVar];
  const clientSecret = process.env[secretVar];
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** Assert the platform creds are present (the connect/push path requires them). */
export function requireCreds(
  creds: PlatformOAuthCreds | null,
  channelName: string
): PlatformOAuthCreds {
  if (!creds) {
    throw new Error(
      `${channelName} platform OAuth credentials are not configured (set the app id/secret env).`
    );
  }
  return creds;
}

/** `fetch` with an abort timeout. The caller checks `res.ok` and surfaces detail
 *  via {@link describeResponse}. */
export function fetchT(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

/** Status + a slice of the response body, so a failure surfaces WHY (a missing
 *  scope, an invalid grant) instead of a bare status code the caller can't act on. */
export async function describeResponse(res: Response): Promise<string> {
  let detail = '';
  try {
    detail = (await res.text()).slice(0, 400).trim();
  } catch {
    // body unreadable — status alone has to do
  }
  return detail ? `${res.status} ${detail}` : `${res.status}`;
}

/** Seconds-until-expiry from an OAuth token response, defaulting when the channel
 *  omits `expires_in` (some long-lived grants do). */
export function expiresInSeconds(raw: unknown, fallbackSeconds: number): number {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallbackSeconds;
}

/** URL-encode a flat record into an `application/x-www-form-urlencoded` body. */
export function formBody(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

/** HTTP Basic auth header value for `client_id:client_secret` (Pinterest token). */
export function basicAuth(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
}

/** Format integer cents as a channel price string, e.g. 1999 → "19.99 USD". The
 *  feed channels all take a decimal-string price with an ISO currency suffix. */
export function priceString(priceCents: number, currency: string): string {
  return `${(priceCents / 100).toFixed(2)} ${currency.toUpperCase()}`;
}
