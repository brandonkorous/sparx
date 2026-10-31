// What one brand's Better Auth instance is configured with.
//
// A frontend deployment serves one brand and reads these from its own
// environment (`authBrandConfigFromEnv()`), the way it always has. api-rest
// serves every brand from one process, so it reads each brand's values from
// brand-prefixed variables (`authBrandConfigForBrand('piggles')` reads
// `PIGGLES_BETTER_AUTH_SECRET`, ...) and builds one instance per brand.
//
// Every value here is part of a session's identity. The secret signs the
// cookie, the base URL is in every emailed link and every OAuth redirect URI,
// and the cookie prefix is the session's address. Changing any of them for a
// brand signs that brand's users out, so api-rest must be given the SAME values
// the brand's frontend runs with today.

import {
  brandEnvName,
  currentPlatformBrand,
  DEFAULT_PLATFORM_BRAND,
  normalizeBrandKey,
} from '@wizeworks/brand-core';

export interface AuthBrandConfig {
  /** The brand key (`sparx`, `piggles`). Scopes every user lookup. */
  brand: string;
  /** The product name: the passkey prompt and the MCP server's display name. */
  appName: string;
  /** Public origin + path the brand's auth is served at. In every emailed link. */
  baseURL: string;
  /** Signs session cookies and encrypts stored OAuth tokens. */
  secret: string | undefined;
  /** The session cookie's name prefix. Changing it signs everyone out. */
  cookiePrefix: string;
  googleClientId: string | undefined;
  googleClientSecret: string | undefined;
  /** WebAuthn relying party id, only when the auth host differs from the app host. */
  passkeyRpId: string | undefined;
  /**
   * Register Better Auth's `nextCookies()` plugin. True inside a Next.js app,
   * where server actions set cookies through `next/headers`. False in api-rest,
   * which has no Next runtime and returns Set-Cookie on the response itself.
   */
  nextCookies: boolean;
}

const DEFAULT_BASE_URL = 'http://localhost:3001';

function env(name: string): string | undefined {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

/** A single-brand frontend process: the unprefixed variables it always read. */
export function authBrandConfigFromEnv(): AuthBrandConfig {
  return {
    brand: currentPlatformBrand(),
    appName: env('BETTER_AUTH_APP_NAME') ?? 'sparx',
    baseURL: env('BETTER_AUTH_URL') ?? DEFAULT_BASE_URL,
    secret: env('BETTER_AUTH_SECRET'),
    cookiePrefix: env('BETTER_AUTH_COOKIE_PREFIX') ?? 'better-auth',
    googleClientId: env('GOOGLE_CLIENT_ID'),
    googleClientSecret: env('GOOGLE_CLIENT_SECRET'),
    passkeyRpId: env('PASSKEY_RP_ID'),
    nextCookies: true,
  };
}

/**
 * One brand inside a process that serves every brand: `<BRAND>_BETTER_AUTH_*`.
 *
 * The default brand falls back to the unprefixed name for each value, because
 * that is where its values have always lived. Another brand has no fallback:
 * borrowing the default brand's secret or cookie prefix would let one brand's
 * cookie name or signature stand in for the other's.
 *
 * Throws when the brand has no secret or no base URL. An instance without a
 * secret cannot verify a cookie, and one without a base URL would email links
 * to localhost; neither should start.
 */
export function authBrandConfigForBrand(brand: string): AuthBrandConfig {
  const key = normalizeBrandKey(brand);
  const isDefault = key === DEFAULT_PLATFORM_BRAND;
  const read = (suffix: string): string | undefined =>
    env(brandEnvName(key, suffix)) ?? (isDefault ? env(suffix) : undefined);

  const secret = read('BETTER_AUTH_SECRET');
  const baseURL = read('BETTER_AUTH_URL');
  if (!secret || !baseURL) {
    throw new Error(
      `auth: brand "${key}" needs ${brandEnvName(key, 'BETTER_AUTH_SECRET')} and ` +
        `${brandEnvName(key, 'BETTER_AUTH_URL')} to serve sign-in.`
    );
  }

  return {
    brand: key,
    appName: read('BETTER_AUTH_APP_NAME') ?? key,
    baseURL,
    secret,
    cookiePrefix: read('BETTER_AUTH_COOKIE_PREFIX') ?? 'better-auth',
    googleClientId: read('GOOGLE_CLIENT_ID'),
    googleClientSecret: read('GOOGLE_CLIENT_SECRET'),
    passkeyRpId: read('PASSKEY_RP_ID'),
    nextCookies: false,
  };
}
