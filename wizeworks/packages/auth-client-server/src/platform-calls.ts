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
 * Run one of the person's own account operations in api-rest, as the person
 * these request headers sign in, and answer as it came: status, a JSON body
 * whose `error` is a sentence the Security surface shows as-is, and any new
 * session cookie. An operation that rotates the session (a password change, the
 * two-step steps, switching business) answers with one, and dropping it would
 * leave the browser holding a cookie for a deleted session.
 */
export async function callAccountOperation(
  op: string,
  init: { method: 'GET' | 'POST'; requestHeaders: Headers; body?: unknown },
  fetchImpl: typeof fetch = fetch
): Promise<Response> {
  const path = `/platform/account/${op}`;
  const headers = forwardedHeaders(init.requestHeaders);
  let body: string | undefined;
  if (init.method === 'POST') {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(init.body && typeof init.body === 'object' ? init.body : {});
  }
  let res: Response;
  try {
    res = await fetchImpl(brandAuthUrl(path), {
      method: init.method,
      headers,
      body,
      cache: 'no-store',
    });
  } catch {
    return Response.json(
      { error: 'The sign-in service did not answer. Try again in a moment.' },
      { status: 503, headers: NO_STORE }
    );
  }
  const out = new Headers({ ...NO_STORE, 'content-type': 'application/json' });
  for (const cookie of res.headers.getSetCookie()) out.append('set-cookie', cookie);
  return new Response(await res.text(), { status: res.status, headers: out });
}

/** Forward one `/api/account/*` request to the operation its path names. */
export async function forwardAccountOperation(
  request: Request,
  fetchImpl: typeof fetch = fetch
): Promise<Response> {
  const method = request.method.toUpperCase() === 'GET' ? 'GET' : 'POST';
  // A body that will not parse is forwarded as empty, never as a 400 here:
  // each operation decides what a missing field means.
  const body: unknown = method === 'POST' ? await request.json().catch(() => null) : undefined;
  return callAccountOperation(
    accountOperationPath(new URL(request.url)),
    { method, requestHeaders: request.headers, body },
    fetchImpl
  );
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

/** A Better Auth session cookie's name, under any prefix: the token, the cached
 *  session and its numbered parts, and the "Keep me signed in" marker. */
const SESSION_COOKIE = /\.(session_token|session_data(\.\d+)?|dont_remember)$/;

/**
 * Every session cookie this request carries, emptied. The fallback when api-rest
 * cannot be reached: it cannot name the brand's cookies then, but the request
 * can, and the person who asked to be signed out must not be left holding them.
 * Exported for its test.
 */
export function expiredSessionCookiesIn(cookieHeader: string | null): SessionCookie[] {
  const names = (cookieHeader ?? '')
    .split(';')
    .map((part) => part.trim().split('=')[0] ?? '')
    .filter((name) => SESSION_COOKIE.test(name));
  return [...new Set(names)].map((name) => ({
    name,
    value: '',
    // A `__Secure-` cookie is refused by the browser unless it is Secure, even
    // to delete it.
    options: {
      httpOnly: true,
      secure: name.startsWith('__Secure-'),
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    },
  }));
}

/**
 * End the session these headers carry. Returns the cookies that clear it.
 *
 * Never throws. If api-rest cannot revoke the session, the cookies are still
 * cleared: a person who asked to be signed out and was left signed in because a
 * call failed is the worst outcome here. The session row then simply expires.
 */
export async function signOutSession(
  requestHeaders: Headers,
  fetchImpl: typeof fetch = fetch
): Promise<SessionCookie[]> {
  try {
    const res = await fetchImpl(brandAuthUrl('/platform/sign-out'), {
      method: 'POST',
      headers: forwardedHeaders(requestHeaders),
      cache: 'no-store',
    });
    if (res.ok) return ((await res.json()) as { cookies: SessionCookie[] }).cookies;
  } catch {
    // Fall through to clearing what the request carries.
  }
  return expiredSessionCookiesIn(requestHeaders.get('cookie'));
}
