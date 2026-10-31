// The app's `/api/auth/*`, forwarded to its brand's handler in api-rest.
//
// The public address stays the app's own: every emailed link, the Google
// redirect URI and the MCP issuer name it, and the session cookie stays
// first-party on the app's domain. Only where the work happens moves.
//
// A route handler rather than a `next.config` rewrite, because a rewrite's
// destination is fixed when the image is built, and api-rest's address is
// configuration the running pod is given.
//
// Usage, in `app/api/auth/[...all]/route.ts`:
//
//   export const { GET, POST, PUT, PATCH, DELETE, OPTIONS } = authProxyHandlers();

import { brandAuthUrl, PlatformAuthUnavailableError } from './platform-api';

/** Mount point the app serves Better Auth at. */
const APP_AUTH_BASE = '/api/auth';

/** Describe one connection, not the message, so they never cross the proxy. */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

/**
 * Response headers that describe the bytes as api-rest sent them. fetch()
 * decodes the body, so relaying `content-encoding: gzip` over a decoded body
 * would hand the browser bytes it cannot read.
 */
const STALE_RESPONSE_HEADERS = new Set([...HOP_BY_HOP, 'content-encoding']);

/** `/api/auth/sign-in/email?x=1` → `/sign-in/email?x=1`. Exported for its test. */
export function proxiedPath(url: URL): string {
  const rest = url.pathname.startsWith(`${APP_AUTH_BASE}/`)
    ? url.pathname.slice(APP_AUTH_BASE.length)
    : url.pathname;
  return `${rest}${url.search}`;
}

/** Also true for a spelling that only decodes to `/platform` (`/%70latform`),
 *  and for a path that will not decode at all. */
function isPlatformPath(path: string): boolean {
  let pathname: string;
  try {
    pathname = decodeURIComponent(path.split('?')[0]!);
  } catch {
    return true;
  }
  const normal = pathname.replace(/\/+/g, '/').toLowerCase();
  return normal === '/platform' || normal.startsWith('/platform/');
}

/** Forwards one request. Exported for its test. */
export async function proxyAuthRequest(
  request: Request,
  fetchImpl: typeof fetch = fetch
): Promise<Response> {
  const path = proxiedPath(new URL(request.url));
  // api-rest's own endpoints for app servers sit beside the handler under
  // `/platform`. They trust the caller to be this app's server, so a browser
  // must never reach them through this public path.
  if (isPlatformPath(path)) return new Response(null, { status: 404 });
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.append(key, value);
  });
  const method = request.method.toUpperCase();
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();

  let upstream: Response;
  try {
    upstream = await fetchImpl(brandAuthUrl(path), {
      method,
      headers,
      body,
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch {
    throw new PlatformAuthUnavailableError(path, null);
  }

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === 'set-cookie' || STALE_RESPONSE_HEADERS.has(lower)) return;
    out.set(key, value);
  });
  // One header per cookie: joined with commas they break on the comma inside
  // every Expires attribute.
  for (const cookie of upstream.headers.getSetCookie()) out.append('set-cookie', cookie);

  const bytes = method === 'HEAD' ? null : await upstream.arrayBuffer();
  return new Response(bytes, { status: upstream.status, headers: out });
}

type Handler = (request: Request) => Promise<Response>;

/** Every method Better Auth answers, bound to the proxy. */
export function authProxyHandlers(): Record<
  'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS',
  Handler
> {
  const handler: Handler = (request) => proxyAuthRequest(request);
  return {
    GET: handler,
    POST: handler,
    PUT: handler,
    PATCH: handler,
    DELETE: handler,
    OPTIONS: handler,
  };
}
