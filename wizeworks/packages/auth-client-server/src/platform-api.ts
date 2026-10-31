// Where api-rest's per-brand auth routes are, and which brand this app is.
//
// Both are read per call, never at module load: a server render asks per
// request, and a snapshot would freeze whatever the environment was when the
// bundle was first imported (or, in `next build`, an environment with neither).

import { currentPlatformBrand } from '@wizeworks/brand-core';

/** api-rest's port in local development (its own default). */
const LOCAL_API = 'http://localhost:3100';

/**
 * api-rest's in-cluster address. `SPARX_API_REST_URL` is the shared config's
 * name for it (sparx-app-env), already present in every app pod. Its routes
 * under `/auth/<brand>` answer only to that internal address, never to the
 * public API host.
 */
export function platformApiUrl(): string {
  // An empty value means unset, as everywhere else in the shared config.
  const value = process.env.SPARX_API_REST_URL?.trim();
  if (!value) return LOCAL_API;
  return value.replace(/\/+$/, '');
}

/** `http://api-rest…/auth/<brand>` plus `path`, for the brand this app serves. */
export function brandAuthUrl(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${platformApiUrl()}/auth/${encodeURIComponent(currentPlatformBrand())}${suffix}`;
}

/**
 * The incoming request headers api-rest needs to act for the same person: the
 * session cookie, and what Better Auth records about the client (address and
 * browser). Nothing else crosses: no Host, no connection headers.
 */
export const FORWARDED_REQUEST_HEADERS = [
  'cookie',
  'user-agent',
  'x-forwarded-for',
  'x-client-ip',
  'x-real-ip',
  'accept-language',
] as const;

export function forwardedHeaders(source: Headers): Headers {
  const out = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = source.get(name);
    if (value) out.set(name, value);
  }
  return out;
}

/** Raised when api-rest cannot answer a sign-in question. Never read as "signed out". */
export class PlatformAuthUnavailableError extends Error {
  constructor(
    readonly path: string,
    readonly status: number | null
  ) {
    super(
      status === null
        ? `auth: api-rest did not answer ${path}.`
        : `auth: api-rest answered ${path} with ${status}.`
    );
    this.name = 'PlatformAuthUnavailableError';
  }
}
