// Google OAuth 2.0 + Search Console API client (docs/50 §7, docs/97 §4).
//
// One thin module over Google's HTTP surface — no SDK. Two halves:
//   • OAuth: build the consent URL, exchange the code, refresh the access token.
//   • Search Console API (webmasters v3): list the caller's verified sites and
//     run Search Analytics queries (date- or query-dimensioned).
//
// Read-only scope (`webmasters.readonly`) — the connector never mutates a
// tenant's Search Console. `access_type=offline` + `prompt=consent` so Google
// always returns a refresh token the nightly job can use unattended.

import { badRequest } from '@sparx/api-core/errors';

import { env } from '../../env.js';
import { isTokenCryptoConfigured } from './crypto.js';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const WEBMASTERS_BASE = 'https://www.googleapis.com/webmasters/v3';
export const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

/** Whether the connector is fully configured (OAuth client + token crypto). The
 *  routes use this to fail closed with a clear "not configured" message instead
 *  of a half-working flow. */
export function isSearchConsoleConfigured(): boolean {
  return Boolean(
    env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET && isTokenCryptoConfigured()
  );
}

function requireClient(): { id: string; secret: string } {
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
    throw badRequest('Google Search Console is not configured on this platform.');
  }
  return { id: env.GOOGLE_OAUTH_CLIENT_ID, secret: env.GOOGLE_OAUTH_CLIENT_SECRET };
}

// ── OAuth ────────────────────────────────────────────────────────────────────
export interface OAuthTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  scope: string | null;
}

interface RawTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

/** The Google consent URL the dashboard redirects the browser to. `state` is the
 *  signed CSRF/identity token the callback verifies. */
export function buildAuthUrl(input: { redirectUri: string; state: string }): string {
  const { id } = requireClient();
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: GSC_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: input.state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

async function postToken(body: Record<string, string>): Promise<OAuthTokens> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as RawTokenResponse;
  if (!res.ok || !json.access_token) {
    const detail = json.error_description ?? json.error ?? `HTTP ${res.status}`;
    throw badRequest(`Google token exchange failed: ${detail}`);
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    // Subtract a 60s safety margin so we refresh slightly early rather than mid-call.
    expiresAt: new Date(Date.now() + ((json.expires_in ?? 3600) - 60) * 1000),
    scope: json.scope ?? null,
  };
}

/** Exchange an authorization code for tokens (the OAuth callback). */
export function exchangeCode(input: { code: string; redirectUri: string }): Promise<OAuthTokens> {
  const { id, secret } = requireClient();
  return postToken({
    code: input.code,
    client_id: id,
    client_secret: secret,
    redirect_uri: input.redirectUri,
    grant_type: 'authorization_code',
  });
}

/** Refresh an access token (Google rarely returns a new refresh token here, so
 *  the caller keeps the existing one when `refreshToken` is null). */
export function refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
  const { id, secret } = requireClient();
  return postToken({
    client_id: id,
    client_secret: secret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
}

// ── Search Console API ─────────────────────────────────────────────────────
export interface GscSite {
  siteUrl: string;
  permissionLevel: string;
}

async function gscGet<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${WEBMASTERS_BASE}${path}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw badRequest(`Search Console API error (${res.status}): ${detail.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** The verified sites the grant can read — the tenant picks one to connect. */
export async function listSites(accessToken: string): Promise<GscSite[]> {
  const json = await gscGet<{ siteEntry?: GscSite[] }>(accessToken, '/sites');
  return (json.siteEntry ?? []).map((s) => ({
    siteUrl: s.siteUrl,
    permissionLevel: s.permissionLevel,
  }));
}

export interface GscRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchAnalyticsQuery {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  dimensions: ('date' | 'query' | 'page')[];
  rowLimit?: number;
}

/** Run a Search Analytics query against one site. Returns the raw GSC rows
 *  (clicks / impressions / ctr / position keyed by the requested dimensions). */
export async function querySearchAnalytics(
  accessToken: string,
  siteUrl: string,
  query: SearchAnalyticsQuery
): Promise<GscRow[]> {
  const res = await fetch(
    `${WEBMASTERS_BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        startDate: query.startDate,
        endDate: query.endDate,
        dimensions: query.dimensions,
        rowLimit: query.rowLimit ?? 1000,
      }),
    }
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw badRequest(`Search Console query failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const json = (await res.json()) as { rows?: GscRow[] };
  return json.rows ?? [];
}
