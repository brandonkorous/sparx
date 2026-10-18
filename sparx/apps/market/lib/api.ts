// Server-side fetch client for the public marketplace API.
//
// Every marketplace read/write goes through api-rest's cross-tenant public
// market surface:
//   GET/POST {SPARX_API_REST_URL}/v1/public/market/<path>
// These routes read the GLOBAL market_listings projection (docs/72 §3) — they
// are not tenant-scoped at the edge; a listing carries its seller tenant, which
// the route resolves per-row. This module is the thin transport the data layer
// (listProducts, getMerchant, …) will build on; it intentionally ships only the
// base client + the `marketApi` helper, not the typed endpoint wrappers.

import { headers } from 'next/headers';
import { forwardedFor } from '@wizeworks/app-kit/forwarded-for';

const BASE_URL = process.env.SPARX_API_REST_URL ?? 'http://localhost:3100';

/** The marketplace API namespace. The data layer composes paths under this. */
const MARKET_PREFIX = '/v1/public/market';

/** Thrown when the marketplace API returns a non-2xx response. Carries the HTTP
 *  status + the parsed error body (when the API returned the standard
 *  `{ success: false, error }` envelope) so callers can branch on 404 vs 5xx. */
export class MarketApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'MarketApiError';
    this.status = status;
    this.code = code;
  }
}

/** The standard api-rest response envelope. */
type ApiEnvelope<T> =
  { success: true; data: T } | { success: false; error?: { code?: string; message?: string } };

/** A fetch init plus the one choice this client adds. */
export interface ApiFetchInit extends RequestInit {
  /**
   * Send the visitor's client chain (`x-forwarded-for` / `x-real-ip`) so api-rest
   * rate-limits the person who asked rather than this pod, whose one address every
   * shopper would otherwise share. ONLY on an uncached (`no-store`) read made
   * inside a request: Next.js puts request headers into the data-cache key, so a
   * cached read that carried it would get a cache entry per visitor.
   */
  forwardClient?: boolean;
}

/**
 * Low-level JSON fetch against an ABSOLUTE api-rest path. Prefer `marketApi`,
 * which scopes to the `/v1/public/market` namespace; this is the shared base it
 * (and any future non-market public read) delegates to. Unwraps the standard
 * `{ success, data }` envelope and throws `MarketApiError` on a transport or
 * API-level failure.
 */
export async function apiFetch<T>(path: string, init?: ApiFetchInit): Promise<T> {
  const { forwardClient, ...requestInit } = init ?? {};
  const client = forwardClient ? forwardedFor(await headers()) : {};
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...requestInit,
      headers: {
        accept: 'application/json',
        ...(requestInit.body ? { 'content-type': 'application/json' } : {}),
        ...client,
        ...requestInit.headers,
      },
    });
  } catch (cause) {
    throw new MarketApiError(0, `Marketplace API unreachable: ${String(cause)}`);
  }

  let json: ApiEnvelope<T> | null = null;
  try {
    json = (await res.json()) as ApiEnvelope<T>;
  } catch {
    // Non-JSON body (gateway error page, empty 204). Fall through to the status
    // check below, which throws with the HTTP status.
  }

  if (!res.ok || !json || json.success === false) {
    const err = json?.success === false ? json.error : undefined;
    throw new MarketApiError(
      res.status,
      err?.message ?? `Marketplace API error (${res.status})`,
      err?.code
    );
  }

  return json.data;
}

/**
 * GET/POST a path under the public marketplace namespace
 * (`/v1/public/market<path>`) and return the parsed `data`. `path` MUST start
 * with `/` (e.g. `marketApi('/products')`, `marketApi('/merchants/acme')`).
 *
 * The data layer (built in a later pass) wraps this with typed functions:
 *   listProducts() → marketApi<MarketProductPage>('/products?...')
 *   getMerchant(slug) → marketApi<MarketMerchant>(`/merchants/${slug}`)
 */
export function marketApi<T>(path: string, init?: ApiFetchInit): Promise<T> {
  return apiFetch<T>(`${MARKET_PREFIX}${path}`, init);
}
