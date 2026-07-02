// OAuth 2.0 authorize/token plumbing for Layer-3 calendar sync (docs/79 §8.3, §8.5)
// — the real-time path: a tenant connects Google Calendar or Microsoft Outlook over
// OAuth (platform-verified app or their OWN client), and sparx pulls busy times via
// the provider API + a push channel, instead of polling a stale `.ics` feed.
//
// PURE: no network, no DB, no env, no clock-of-its-own (the caller passes `nowMs`).
// It only builds the authorize URL, the token-request bodies, and parses the token
// response — so every branch is unit-tested. The api-rest oauth-client does the
// actual fetch + encrypts the returned tokens at rest (AES-256-GCM), exactly like
// the Search Console connector.

export type CalendarOAuthProvider = 'google' | 'microsoft';

// Calendar.events (read + write, for outbound import) + readonly (list/freebusy).
// Google still requires OAuth for Calendar (basic-auth CalDAV was removed in 2025),
// so this is the only API path for a Google account.
export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
];

// offline_access mints the refresh token; Calendars.ReadWrite covers busy-read +
// (future) event write. Microsoft has no CalDAV — Graph is the only path.
export const MICROSOFT_CALENDAR_SCOPES = [
  'offline_access',
  'https://graph.microsoft.com/Calendars.ReadWrite',
];

/** The directory a Microsoft authorize/token call targets. `common` = any
 *  work/school OR personal account; an org may pin its own tenant id. Ignored for
 *  Google. */
export function microsoftTenant(raw?: string | null): string {
  const t = (raw ?? '').trim();
  return t.length > 0 ? t : 'common';
}

export function calendarScopes(provider: CalendarOAuthProvider): string[] {
  return provider === 'google' ? GOOGLE_CALENDAR_SCOPES : MICROSOFT_CALENDAR_SCOPES;
}

/** The provider's token endpoint (the api-rest client POSTs the bodies below here). */
export function calendarTokenUrl(
  provider: CalendarOAuthProvider,
  msTenant?: string | null
): string {
  return provider === 'google'
    ? 'https://oauth2.googleapis.com/token'
    : `https://login.microsoftonline.com/${encodeURIComponent(microsoftTenant(msTenant))}/oauth2/v2.0/token`;
}

export interface AuthorizeUrlParams {
  provider: CalendarOAuthProvider;
  clientId: string;
  redirectUri: string;
  /** The signed, tamper-proof state token carrying tenant/user/resource/connection. */
  state: string;
  /** Microsoft directory (`common` default); ignored for Google. */
  msTenant?: string | null;
  /** Pre-fills the account chooser (the staff member's email), best-effort. */
  loginHint?: string | null;
}

/** Build the provider consent URL the browser is redirected to. Google needs
 *  `access_type=offline` + `prompt=consent` to reliably return a refresh token on
 *  every authorize; Microsoft mints one whenever `offline_access` is in scope. */
export function buildCalendarAuthorizeUrl(p: AuthorizeUrlParams): string {
  const scope = calendarScopes(p.provider).join(' ');
  if (p.provider === 'google') {
    const params = new URLSearchParams({
      client_id: p.clientId,
      redirect_uri: p.redirectUri,
      response_type: 'code',
      scope,
      access_type: 'offline',
      include_granted_scopes: 'true',
      prompt: 'consent',
      state: p.state,
    });
    if (p.loginHint) params.set('login_hint', p.loginHint);
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }
  const params = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: 'code',
    response_mode: 'query',
    scope,
    state: p.state,
  });
  if (p.loginHint) params.set('login_hint', p.loginHint);
  return `https://login.microsoftonline.com/${encodeURIComponent(microsoftTenant(p.msTenant))}/oauth2/v2.0/authorize?${params.toString()}`;
}

export interface TokenExchangeParams {
  provider: CalendarOAuthProvider;
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}

/** `application/x-www-form-urlencoded` body to exchange the authorization code for
 *  tokens. Microsoft wants the scope echoed; Google infers it from the grant. */
export function buildTokenExchangeBody(p: TokenExchangeParams): string {
  const params = new URLSearchParams({
    client_id: p.clientId,
    client_secret: p.clientSecret,
    code: p.code,
    redirect_uri: p.redirectUri,
    grant_type: 'authorization_code',
  });
  if (p.provider === 'microsoft') params.set('scope', MICROSOFT_CALENDAR_SCOPES.join(' '));
  return params.toString();
}

export interface TokenRefreshParams {
  provider: CalendarOAuthProvider;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

/** Body to mint a fresh access token from the stored refresh token. */
export function buildTokenRefreshBody(p: TokenRefreshParams): string {
  const params = new URLSearchParams({
    client_id: p.clientId,
    client_secret: p.clientSecret,
    refresh_token: p.refreshToken,
    grant_type: 'refresh_token',
  });
  if (p.provider === 'microsoft') params.set('scope', MICROSOFT_CALENDAR_SCOPES.join(' '));
  return params.toString();
}

export interface OAuthTokens {
  accessToken: string;
  /** Google omits this on refresh (the original refresh token stays valid); the
   *  caller keeps the existing one when null. */
  refreshToken: string | null;
  /** Absolute expiry (epoch ms) computed from `expires_in` + the passed `nowMs`. */
  expiresAtMs: number;
  scope: string | null;
}

/** Parse a token endpoint JSON response into absolute-expiry tokens. Throws on a
 *  response missing the access token (a provider error body) so the caller records
 *  it rather than persisting an empty grant. */
export function parseTokenResponse(json: unknown, nowMs: number): OAuthTokens {
  const o = (json ?? {}) as Record<string, unknown>;
  const accessToken = typeof o.access_token === 'string' ? o.access_token : '';
  if (!accessToken) {
    const err = typeof o.error_description === 'string' ? o.error_description : o.error;
    throw new Error(typeof err === 'string' ? err : 'OAuth token response had no access_token.');
  }
  const rawExpires = typeof o.expires_in === 'number' ? o.expires_in : Number(o.expires_in);
  const expiresInSec = Number.isFinite(rawExpires) && rawExpires > 0 ? rawExpires : 3600;
  return {
    accessToken,
    refreshToken: typeof o.refresh_token === 'string' && o.refresh_token ? o.refresh_token : null,
    expiresAtMs: nowMs + expiresInSec * 1000,
    scope: typeof o.scope === 'string' ? o.scope : null,
  };
}

/** Whether a stored access token is expired (or close enough that it should be
 *  refreshed before use). A null/absent expiry counts as expired. */
export function isAccessTokenExpired(
  expiresAtMs: number | null | undefined,
  nowMs: number,
  skewMs = 120_000
): boolean {
  if (!expiresAtMs) return true;
  return nowMs >= expiresAtMs - skewMs;
}
