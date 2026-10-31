// The short-lived token a console's browser calls api-rest with.
//
// The console used to mint it with its own copy of SPARX_INTERNAL_JWT_SECRET.
// api-rest mints it now (`POST /auth/<brand>/platform/api-token`), stamping the tenant
// from the session, so the secret leaves the console. The console's own
// `/api/token` route forwards here and adds the two values that are its own:
// the public API origin and the active-site cookie.

import { brandAuthUrl, forwardedHeaders, PlatformAuthUnavailableError } from './platform-api';

/** The body of `POST /auth/<brand>/platform/api-token`. */
export interface ApiToken {
  token: string;
  /** Absolute epoch-ms expiry. */
  expiresAt: number;
  userId: string;
  role: string;
  /** Empty when the account has no name set. Display only. */
  userName: string;
  email: string;
  emailVerified: boolean;
}

/** The token for these request headers, or null when nobody is signed in. */
export async function fetchApiToken(
  requestHeaders: Headers,
  fetchImpl: typeof fetch = fetch
): Promise<ApiToken | null> {
  const path = '/platform/api-token';
  let res: Response;
  try {
    res = await fetchImpl(brandAuthUrl(path), {
      method: 'POST',
      headers: forwardedHeaders(requestHeaders),
      cache: 'no-store',
    });
  } catch {
    throw new PlatformAuthUnavailableError(path, null);
  }
  if (res.status === 401) return null;
  if (!res.ok) throw new PlatformAuthUnavailableError(path, res.status);
  return (await res.json()) as ApiToken;
}
