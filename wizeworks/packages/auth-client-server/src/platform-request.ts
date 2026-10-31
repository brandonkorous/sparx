// One call to api-rest's `/auth/<brand>/platform/*`, as the person signed in.
//
// The routes beside sign-in that act on the person's own business (consent,
// setup, billing) all take the same shape: forward the request's cookie, send
// JSON, read JSON. This is that shape once, so an app's own typed helpers are a
// path and a body each, and none of them re-states how to reach api-rest.

import { cookies, headers } from 'next/headers';
import { brandAuthUrl, forwardedHeaders } from './platform-api';
import type { SessionCookie } from './platform-calls';

/** api-rest answered, but not with a 2xx. `body` is its JSON, when it sent any. */
export class PlatformRequestError extends Error {
  constructor(
    readonly path: string,
    /** Null when api-rest could not be reached at all. */
    readonly status: number | null,
    readonly body: Record<string, unknown> = {}
  ) {
    super(
      status === null
        ? `api-rest did not answer ${path}.`
        : `api-rest answered ${path} with ${status}.`
    );
    this.name = 'PlatformRequestError';
  }
}

export interface PlatformRequestInit {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** The incoming request's headers. Defaults to the current request's, which
   *  only exists inside a server component, action or route handler. */
  requestHeaders?: Headers;
  /** Defaults to 20 seconds. Furnishing a business takes longer. */
  timeoutMs?: number;
}

/**
 * Call `path` under `/auth/<brand>/platform` and return its JSON.
 *
 * Throws `PlatformRequestError` for any answer that is not a 2xx, and when
 * api-rest cannot be reached. A 401 means the session has ended.
 */
export async function platformRequest<T>(path: string, init: PlatformRequestInit = {}): Promise<T> {
  const full = `/platform/${path.replace(/^\/+/, '')}`;
  const method = init.method ?? (init.body === undefined ? 'GET' : 'POST');
  const out = forwardedHeaders(init.requestHeaders ?? (await headers()));
  if (method === 'POST') out.set('content-type', 'application/json');
  let res: Response;
  try {
    res = await fetch(brandAuthUrl(full), {
      method,
      headers: out,
      ...(method === 'POST' ? { body: JSON.stringify(init.body ?? {}) } : {}),
      signal: AbortSignal.timeout(init.timeoutMs ?? 20_000),
      cache: 'no-store',
    });
  } catch {
    throw new PlatformRequestError(full, null);
  }
  const body: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new PlatformRequestError(
      full,
      res.status,
      body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
    );
  }
  return body as T;
}

/**
 * Set the session cookies an api-rest flow answered with (sign-up signs the new
 * owner in; joining a business switches to it). For a server action or a
 * route handler that has no response object of its own to put them on. Each is
 * set exactly as given: the value arrives unencoded, and Next encodes it once.
 */
export async function setSessionCookies(list: readonly SessionCookie[]): Promise<void> {
  const jar = await cookies();
  for (const cookie of list) jar.set({ name: cookie.name, value: cookie.value, ...cookie.options });
}
