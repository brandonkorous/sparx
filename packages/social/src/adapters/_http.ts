// Shared HTTP + OAuth helpers for the concrete social adapters — the publish-side
// mirror of @sparx/channels' adapter `_http`. Kept local to @sparx/social so a social
// adapter never reaches into the channels package's internals.
//
// Adapters are pure I/O against the platform REST API — no SDKs, just `fetch`. The
// worker resolves the per-tenant access token; these helpers read sparx's PLATFORM
// app credentials from env.

const DEFAULT_TIMEOUT_MS = 20_000;

/** An error that carries the platform's HTTP status, so the worker can tell a PERMANENT
 *  rejection (a 4xx — a bad post/token that will never succeed) from a TRANSIENT one and
 *  stop retrying the former. Adapter HTTP helpers throw this instead of a bare Error. */
export class HttpError extends Error {
  readonly status: number;
  /** Seconds the platform asked us to wait, from its `Retry-After` header. Honouring
   *  this is the difference between backing off politely and stampeding a platform that
   *  already said "slow down" — which is how a rate limit becomes a longer ban. */
  readonly retryAfterSeconds?: number;

  constructor(message: string, status: number, retryAfterSeconds?: number) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    if (retryAfterSeconds !== undefined) this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Read `Retry-After`, which platforms send either as a number of seconds or as an HTTP
 * date. Returns undefined when absent or unparseable, and clamps to a day — a header
 * asking us to wait a month is a bug on their side, not an instruction.
 */
export function parseRetryAfter(res: Response): number | undefined {
  const raw = res.headers.get('retry-after');
  if (!raw) return undefined;

  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds, 86_400);

  const date = Date.parse(raw);
  if (Number.isNaN(date)) return undefined;
  return Math.min(Math.max(0, Math.round((date - Date.now()) / 1000)), 86_400);
}

/** Whether a publish error is worth retrying. A `429` (rate-limited) or any `5xx` is
 *  transient → retry; every other 4xx (400/401/403/404/422 …) is a permanent rejection
 *  the same request will never clear → fail fast, don't burn MAX_ATTEMPTS on it. A
 *  non-HttpError (network drop, timeout, bug) has no status → retry, since those are
 *  usually transient. */
export function isRetryableError(e: unknown): boolean {
  if (e instanceof HttpError) return e.status === 429 || e.status >= 500;
  return true;
}

/** sparx's registered OAuth app credentials for one platform (NOT per-tenant). */
export interface PlatformOAuthCreds {
  clientId: string;
  clientSecret: string;
}

/** Read a platform's OAuth app credentials from env. Returns null when either half is
 *  missing → the adapter reports `isConfigured() === false` and the platform stays
 *  `coming_soon` until ops sets the env (mirrors channels, docs/133 §6). */
export function readPlatformCreds(idVar: string, secretVar: string): PlatformOAuthCreds | null {
  // Trim, always: a client key/secret is a bare token with no legitimate surrounding
  // whitespace, and secrets loaded from Secret Manager routinely carry a trailing
  // newline (`echo "x" |` instead of `printf %s`). Left untrimmed, that newline rides
  // into the OAuth `client_key` query param as `%0A`, and the provider rejects the
  // authorize request with a bare "correct the following: client_key" — a brutal
  // footgun to diagnose. One trim here immunizes every platform against it.
  const clientId = process.env[idVar]?.trim();
  const clientSecret = process.env[secretVar]?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** Assert the platform creds are present (the connect/publish path requires them). */
export function requireCreds(
  creds: PlatformOAuthCreds | null,
  platformName: string
): PlatformOAuthCreds {
  if (!creds) {
    throw new Error(
      `${platformName} platform OAuth credentials are not configured (set the app id/secret env).`
    );
  }
  return creds;
}

/** `fetch` with an abort timeout. The caller checks `res.ok` and surfaces detail via
 *  {@link describeResponse}. */
export function fetchT(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

/** Status + a slice of the response body, so a failure surfaces WHY (a missing scope,
 *  an invalid grant) instead of a bare status the caller can't act on. */
export async function describeResponse(res: Response): Promise<string> {
  let detail = '';
  try {
    detail = (await res.text()).slice(0, 400).trim();
  } catch {
    // body unreadable — status alone has to do
  }
  return detail ? `${res.status} ${detail}` : `${res.status}`;
}

/** Seconds-until-expiry from an OAuth token response, defaulting when the platform
 *  omits `expires_in` (some long-lived grants do). */
export function expiresInSeconds(raw: unknown, fallbackSeconds: number): number {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallbackSeconds;
}

/** Split an OAuth scope string into individual scopes. The platforms disagree on the
 *  separator — Meta, TikTok and Pinterest use commas, LinkedIn and Google use spaces —
 *  so accept both rather than making every adapter remember which it is. Order is not
 *  meaningful and duplicates are dropped, because the only use is set comparison. */
export function splitScopes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(/[\s,]+/).filter(Boolean))];
}

/** URL-encode a flat record into an `application/x-www-form-urlencoded` body. */
export function formBody(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}
