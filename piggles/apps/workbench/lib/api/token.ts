// Browser-side token cache.
//
// Every pane in every window fetches through api-rest, and every one of those
// requests needs a live bearer token. This module makes that a non-event: it
// holds one token per window, refreshes it before it expires, and collapses
// concurrent requests so ten panes mounting at once produce ONE /api/token call
// rather than ten.
//
// Scope is per-window on purpose. A detached window is same-origin, so it holds
// the session cookie and can mint its own token; sharing one over the bus would
// buy little and would mean a token outliving the window that owns it.

import type { WorkbenchTokenResponse } from '../../app/api/token/route';

export interface TokenState {
  token: string;
  expiresAt: number;
  apiUrl: string;
  propertyId: string | null;
  /** Who is signed in, in plain form — see WorkbenchTokenResponse for why the
   *  token route carries this and why it is never a control. */
  userId: string;
  role: string;
  /** Display only, and possibly empty — see WorkbenchTokenResponse. */
  userName: string;
}

/** Refresh once 80% of the lifetime has burned, so a request never races expiry. */
const REFRESH_RATIO = 0.8;
/** Treat a token with under this much life left as already dead. */
const MIN_REMAINING_MS = 30_000;

export class TokenExpiredError extends Error {
  constructor() {
    super('The workbench session has ended. Sign in again to continue.');
    this.name = 'TokenExpiredError';
  }
}

let current: TokenState | null = null;
let inFlight: Promise<TokenState> | null = null;

async function fetchToken(): Promise<TokenState> {
  const response = await fetch('/api/token', {
    // Same-origin; the session cookie rides along and is the ONLY thing
    // authenticating this call.
    credentials: 'same-origin',
    cache: 'no-store',
  });

  if (response.status === 401 || response.status === 403) {
    current = null;
    throw new TokenExpiredError();
  }
  if (!response.ok) {
    throw new Error(`Could not start a secure session (${String(response.status)}).`);
  }

  const body = (await response.json()) as WorkbenchTokenResponse;
  return {
    token: body.token,
    expiresAt: body.expiresAt,
    apiUrl: body.apiUrl,
    propertyId: body.propertyId,
    userId: body.userId,
    role: body.role,
    // Older builds of the route did not send this. An absent name is already a
    // real state here, so it degrades into the same empty string rather than
    // needing a second branch anywhere downstream.
    userName: body.userName ?? '',
  };
}

function isFresh(state: TokenState | null): state is TokenState {
  if (!state) return false;
  const remaining = state.expiresAt - Date.now();
  if (remaining < MIN_REMAINING_MS) return false;
  const lifetime = remaining / REFRESH_RATIO;
  return remaining > lifetime * (1 - REFRESH_RATIO);
}

/**
 * Returns a live token state, minting or refreshing as needed. Concurrent
 * callers share one in-flight request.
 */
export async function getTokenState(): Promise<TokenState> {
  if (current && Date.now() < current.expiresAt - MIN_REMAINING_MS) {
    // Kick off a background refresh once we're into the last 20% of life, but
    // hand back the still-valid token now rather than making the caller wait.
    if (!isFresh(current) && !inFlight) {
      inFlight = fetchToken()
        .then((next) => {
          current = next;
          return next;
        })
        .finally(() => {
          inFlight = null;
        });
    }
    return current;
  }

  inFlight ??= fetchToken()
    .then((next) => {
      current = next;
      return next;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/** Lazy resolver handed to SparxClient's `token` option. */
export async function resolveToken(): Promise<string> {
  const state = await getTokenState();
  return state.token;
}

/**
 * The freshest cached token WITHOUT awaiting a refresh — for the chat socket's
 * synchronous handshake `auth` callback, which socket.io calls on every
 * (re)connect and can't await. Null before the first fetch; the socket primes
 * the cache with getTokenState() before it connects, and every pane's polling
 * keeps the token live thereafter, so a reconnect reads a valid token here. When
 * it is momentarily stale the handshake fails, api-rest's retry kicks in, and
 * the next poll refreshes the cache for the following attempt.
 */
export function peekToken(): string | null {
  return current?.token ?? null;
}

/** Drops the cached token — call after sign-out or on a hard 401 from api-rest. */
export function clearToken(): void {
  current = null;
  inFlight = null;
}
