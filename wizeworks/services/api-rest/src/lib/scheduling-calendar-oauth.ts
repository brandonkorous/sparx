// OAuth plumbing for Layer-3 calendar sync (docs/79 §8.3, §8.5) — the api-rest side
// the PURE @wizeworks/scheduling helpers can't do: resolve the client credentials
// (platform app vs the tenant's BYO client), run the token exchange/refresh over the
// network, encrypt the returned tokens at rest, and sign the two round-trip tokens
// (the browser `state`, and the push-channel token the provider echoes back).
//
// Credentials: Google reuses the shared GOOGLE_OAUTH_CLIENT_ID/_SECRET (Calendar
// scopes added); Microsoft has its own MICROSOFT_OAUTH_CLIENT_ID/_SECRET. A BYO
// connection carries the tenant's own client id + (encrypted) secret on the row.

import { SignJWT, jwtVerify } from 'jose';
import { forbidden } from '@wizeworks/api-core/errors';
import type { CalendarConnection } from '@wizeworks/db';
import {
  buildTokenExchangeBody,
  buildTokenRefreshBody,
  calendarTokenUrl,
  isAccessTokenExpired,
  microsoftTenant,
  parseTokenResponse,
  updateConnectionSyncState,
  type CalendarOAuthProvider,
  type OAuthTokens,
} from '@wizeworks/scheduling';

import { env } from '../env.js';
import { decryptCalendarSecret, encryptCalendarSecret } from './scheduling-calendar-crypto.js';

const TOKEN_TIMEOUT_MS = 12_000;

export interface ResolvedOAuthClient {
  clientId: string;
  clientSecret: string;
  msTenant: string;
}

/** Resolve the OAuth client for a connection: the tenant's BYO client when the row
 *  carries one, else the platform app from env. Null when neither is configured
 *  (the provider's connect path then reports "not configured"). */
export function resolveOAuthClient(conn: CalendarConnection): ResolvedOAuthClient | null {
  const provider = conn.provider as CalendarOAuthProvider;
  if (conn.credentialSource === 'tenant_byo' && conn.oauthClientId && conn.oauthClientSecretEnc) {
    return {
      clientId: conn.oauthClientId,
      clientSecret: decryptCalendarSecret(conn.oauthClientSecretEnc),
      msTenant: microsoftTenant(env.MICROSOFT_OAUTH_TENANT),
    };
  }
  if (provider === 'google' && env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET) {
    return {
      clientId: env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      msTenant: 'common',
    };
  }
  if (
    provider === 'microsoft' &&
    env.MICROSOFT_OAUTH_CLIENT_ID &&
    env.MICROSOFT_OAUTH_CLIENT_SECRET
  ) {
    return {
      clientId: env.MICROSOFT_OAUTH_CLIENT_ID,
      clientSecret: env.MICROSOFT_OAUTH_CLIENT_SECRET,
      msTenant: microsoftTenant(env.MICROSOFT_OAUTH_TENANT),
    };
  }
  return null;
}

/** Whether the platform app for a provider is configured (drives the dashboard's
 *  "Connect" button availability without exposing secrets). */
export function isOAuthProviderConfigured(provider: CalendarOAuthProvider): boolean {
  if (!env.SCHEDULING_CALENDAR_TOKEN_KEY) return false;
  return provider === 'google'
    ? Boolean(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET)
    : Boolean(env.MICROSOFT_OAUTH_CLIENT_ID && env.MICROSOFT_OAUTH_CLIENT_SECRET);
}

async function postForm(url: string, body: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOKEN_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
    });
    const json: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
      const o = (json ?? {}) as Record<string, unknown>;
      const detail =
        (typeof o.error_description === 'string' && o.error_description) ||
        (typeof o.error === 'string' && o.error) ||
        `HTTP ${res.status}`;
      throw new Error(`OAuth token request failed: ${detail}`);
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

/** Exchange the authorization code for tokens (the callback step). */
export async function exchangeAuthCode(
  client: ResolvedOAuthClient,
  provider: CalendarOAuthProvider,
  code: string,
  redirectUri: string,
  nowMs: number
): Promise<OAuthTokens> {
  const body = buildTokenExchangeBody({
    provider,
    clientId: client.clientId,
    clientSecret: client.clientSecret,
    code,
    redirectUri,
  });
  return parseTokenResponse(
    await postForm(calendarTokenUrl(provider, client.msTenant), body),
    nowMs
  );
}

/** Return a valid access token for a connection, refreshing (and persisting the new
 *  token) when the stored one is expired. Throws when the grant can't be refreshed
 *  (no refresh token / revoked) — the caller flips the connection to `expired`. */
export async function ensureFreshAccessToken(
  tenantId: string,
  conn: CalendarConnection,
  nowMs: number
): Promise<string> {
  if (!conn.accessTokenEnc) throw new Error('Calendar connection has no access token.');
  if (!isAccessTokenExpired(conn.tokenExpiresAt?.getTime(), nowMs)) {
    return decryptCalendarSecret(conn.accessTokenEnc);
  }
  if (!conn.refreshTokenEnc) throw new Error('Calendar grant expired and cannot be refreshed.');
  const client = resolveOAuthClient(conn);
  if (!client) throw new Error('Calendar OAuth client is not configured.');
  const provider = conn.provider as CalendarOAuthProvider;
  const body = buildTokenRefreshBody({
    provider,
    clientId: client.clientId,
    clientSecret: client.clientSecret,
    refreshToken: decryptCalendarSecret(conn.refreshTokenEnc),
  });
  const tokens = parseTokenResponse(
    await postForm(calendarTokenUrl(provider, client.msTenant), body),
    nowMs
  );
  await updateConnectionSyncState(tenantId, conn.id, {
    accessTokenEnc: encryptCalendarSecret(tokens.accessToken),
    tokenExpiresAt: new Date(tokens.expiresAtMs),
    // Google omits the refresh token on refresh — keep the existing one.
    ...(tokens.refreshToken ? { refreshTokenEnc: encryptCalendarSecret(tokens.refreshToken) } : {}),
  });
  return tokens.accessToken;
}

// ── Signed round-trip tokens ─────────────────────────────────────────────────

const STATE_KIND = 'scheduling_calendar_oauth';
const STATE_TTL = '10m';
const PUSH_KIND = 'scheduling_calendar_push';

function secret(): Uint8Array {
  return new TextEncoder().encode(env.SPARX_INTERNAL_JWT_SECRET);
}

export interface CalendarOAuthState {
  tenantId: string;
  userId: string;
  connectionId: string;
  provider: CalendarOAuthProvider;
  redirectUri: string;
}

/** Sign the browser `state` carrying who/what is connecting + the exact redirect_uri
 *  (the token exchange must replay the same one). Mirrors channels-oauth state. */
export async function signCalendarOAuthState(state: CalendarOAuthState): Promise<string> {
  return new SignJWT({
    kind: STATE_KIND,
    tid: state.tenantId,
    uid: state.userId,
    cid: state.connectionId,
    provider: state.provider,
    redirect_uri: state.redirectUri,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(STATE_TTL)
    .sign(secret());
}

export async function verifyCalendarOAuthState(token: string): Promise<CalendarOAuthState> {
  let payload: Record<string, unknown>;
  try {
    payload = (await jwtVerify(token, secret())).payload;
  } catch {
    throw forbidden('Invalid or expired calendar connect token.');
  }
  if (
    payload.kind !== STATE_KIND ||
    typeof payload.tid !== 'string' ||
    typeof payload.uid !== 'string' ||
    typeof payload.cid !== 'string' ||
    (payload.provider !== 'google' && payload.provider !== 'microsoft') ||
    typeof payload.redirect_uri !== 'string'
  ) {
    throw forbidden('Malformed calendar connect token.');
  }
  return {
    tenantId: payload.tid,
    userId: payload.uid,
    connectionId: payload.cid,
    provider: payload.provider,
    redirectUri: payload.redirect_uri,
  };
}

/** Sign the push-channel token the provider echoes back on every notification, so
 *  the public webhook resolves {tenant, connection} WITHOUT a cross-tenant scan
 *  (Google sends it as the channel `token`, Microsoft as the subscription
 *  `clientState`). No expiry — it lives as long as the channel does. */
export async function signCalendarPushToken(
  tenantId: string,
  connectionId: string
): Promise<string> {
  return new SignJWT({ kind: PUSH_KIND, tid: tenantId, cid: connectionId })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .sign(secret());
}

export async function verifyCalendarPushToken(
  token: string
): Promise<{ tenantId: string; connectionId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (
      payload.kind !== PUSH_KIND ||
      typeof payload.tid !== 'string' ||
      typeof payload.cid !== 'string'
    ) {
      return null;
    }
    return { tenantId: payload.tid, connectionId: payload.cid };
  } catch {
    return null;
  }
}
