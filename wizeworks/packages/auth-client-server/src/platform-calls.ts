// The app server's calls to api-rest's `/auth/<brand>/platform/*`: account
// security, the cross-domain handoff, and signing out.

import { brandAuthUrl, forwardedHeaders, PlatformAuthUnavailableError } from './platform-api';

const NO_STORE = { 'cache-control': 'no-store, private' } as const;

async function post(path: string, init: { headers?: Headers; body?: unknown }): Promise<Response> {
  const headers = init.headers ? new Headers(init.headers) : new Headers();
  headers.set('content-type', 'application/json');
  try {
    return await fetch(brandAuthUrl(path), {
      method: 'POST',
      headers,
      body: JSON.stringify(init.body ?? {}),
      cache: 'no-store',
    });
  } catch {
    throw new PlatformAuthUnavailableError(path, null);
  }
}

// ── Account security ────────────────────────────────────────────────────────

/** `/api/account/two-factor/verify` → `two-factor/verify`. Exported for its test. */
export function accountOperationPath(url: URL): string {
  return url.pathname.replace(/^\/api\/account\/?/, '').replace(/\/+$/, '');
}

/**
 * Forward one `/api/account/*` request to the person's own account operations
 * in api-rest, and relay the answer as it came: status, and a JSON body whose
 * `error` is a sentence the Security surface shows as-is.
 */
export async function forwardAccountOperation(
  request: Request,
  fetchImpl: typeof fetch = fetch
): Promise<Response> {
  const op = accountOperationPath(new URL(request.url));
  const path = `/platform/account/${op}`;
  const method = request.method.toUpperCase() === 'GET' ? 'GET' : 'POST';
  const headers = forwardedHeaders(request.headers);
  let body: string | undefined;
  if (method === 'POST') {
    headers.set('content-type', 'application/json');
    // A body that will not parse is forwarded as empty, never as a 400 here:
    // each operation decides what a missing field means.
    const payload: unknown = await request.json().catch(() => null);
    body = JSON.stringify(payload && typeof payload === 'object' ? payload : {});
  }
  let res: Response;
  try {
    res = await fetchImpl(brandAuthUrl(path), { method, headers, body, cache: 'no-store' });
  } catch {
    return Response.json(
      { error: 'The sign-in service did not answer. Try again in a moment.' },
      { status: 503, headers: NO_STORE }
    );
  }
  return new Response(await res.text(), {
    status: res.status,
    headers: { ...NO_STORE, 'content-type': 'application/json' },
  });
}

/** For `app/api/account/[...op]/route.ts`. */
export function accountOperationHandlers(): Record<
  'GET' | 'POST',
  (r: Request) => Promise<Response>
> {
  const handler = (request: Request) => forwardAccountOperation(request);
  return { GET: handler, POST: handler };
}

// ── Cross-domain handoff ────────────────────────────────────────────────────

/** A cookie to set exactly as given. Mirrors `@wizeworks/auth`'s SessionCookie. */
export interface SessionCookie {
  name: string;
  /** Already signed. Do not encode it. */
  value: string;
  options: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'lax' | 'strict' | 'none';
    path: string;
    maxAge?: number;
    domain?: string;
  };
}

export type ConsumeHandoffResult =
  | { ok: true; userId: string; next: string; cookies: SessionCookie[] }
  | { ok: false; reason: 'missing' | 'expired' | 'wrong-audience' | 'malformed' };

/** A one-time token for the session these headers carry; null when signed out. */
export async function mintHandoff(
  requestHeaders: Headers,
  input: { audience: string; next?: string }
): Promise<{ token: string } | null> {
  const path = '/platform/handoff';
  const res = await post(path, { headers: forwardedHeaders(requestHeaders), body: input });
  if (res.status === 401) return null;
  if (!res.ok) throw new PlatformAuthUnavailableError(path, res.status);
  return (await res.json()) as { token: string };
}

/** Redeem a token for the cookies to set on this app's domain. */
export async function consumeHandoff(
  token: string | null,
  audience: string
): Promise<ConsumeHandoffResult> {
  const path = '/platform/handoff/consume';
  const res = await post(path, { body: { token, audience } });
  if (!res.ok) throw new PlatformAuthUnavailableError(path, res.status);
  return (await res.json()) as ConsumeHandoffResult;
}

// ── Signing out ─────────────────────────────────────────────────────────────

/** End the session these headers carry. Returns the cookies that clear it. */
export async function signOutSession(requestHeaders: Headers): Promise<SessionCookie[]> {
  const path = '/platform/sign-out';
  const res = await post(path, { headers: forwardedHeaders(requestHeaders) });
  if (!res.ok) throw new PlatformAuthUnavailableError(path, res.status);
  return ((await res.json()) as { cookies: SessionCookie[] }).cookies;
}
