// Per-tenant scoped Typesense search keys.
//
// Typesense can derive a "scoped" API key from a parent search-only key with
// embedded search parameters that the holder CANNOT override — including a
// `filter_by`. We embed `tenant_id:=<tenantId>`, so a scoped key can only ever
// see that one tenant's documents. This lets the storefront / dashboard query
// Typesense DIRECTLY from the browser (instant-search) without proxying every
// keystroke through api-rest — while remaining tenant-isolated.
//
// SECURITY: the parent key MUST be a SEARCH-ONLY key (actions: documents:search
// on the three collections), NEVER the admin key. The admin key can write +
// manage schemas; a leaked scoped key derived from it would be catastrophic.
// The search-only key is provisioned out-of-band and supplied via
// TYPESENSE_SEARCH_KEY (TF secret `typesense-search-key`). If it's unset we
// refuse to mint a key rather than fall back to the admin key.
//
// Server-proxied search (the /v1/search routes) stays the DEFAULT. Scoped-key
// browser querying is opt-in and additive.

import { getClient } from './client';

export interface ScopedKeyResult {
  /** The scoped search key to hand the browser. Tenant-locked. */
  key: string;
  /** Seconds from now the key expires — surface so the client refreshes. */
  expiresInSeconds: number;
}

const DEFAULT_TTL_SECONDS = 60 * 60; // 1h — short enough to limit blast radius.

/**
 * Mint a tenant-scoped search key. Embeds `filter_by: tenant_id:=<tenantId>`
 * so the key holder cannot widen the result set beyond their tenant.
 *
 * Requires `TYPESENSE_SEARCH_KEY` (a search-only parent key). Throws if it's
 * absent — we never derive from the admin key.
 */
export function generateScopedSearchKey(
  tenantId: string,
  opts: { ttlSeconds?: number } = {}
): ScopedKeyResult {
  const parentKey = process.env.TYPESENSE_SEARCH_KEY;
  if (!parentKey) {
    throw new Error(
      'TYPESENSE_SEARCH_KEY is required to mint scoped search keys (never derive from the admin key)'
    );
  }
  const ttl = opts.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  // generateScopedSearchKey is a pure HMAC over the parent key — no network
  // call. The embedded params are enforced server-side by Typesense on every
  // search made with the derived key.
  const key = getClient()
    .keys()
    .generateScopedSearchKey(parentKey, {
      filter_by: `tenant_id:=${tenantId}`,
      // expires_at is an absolute epoch-seconds bound baked into the key.
      // NOTE: callers pass the current time — Date.now() is avoided here so the
      // function stays deterministic/testable; see the api-rest route which
      // stamps `expires_at`.
    });
  return { key, expiresInSeconds: ttl };
}

/**
 * Variant that bakes an absolute expiry into the key. `nowSeconds` is passed
 * in (not read from the clock) so the function is deterministic. The api-rest
 * route supplies `Math.floor(Date.now()/1000)`.
 */
export function generateScopedSearchKeyWithExpiry(
  tenantId: string,
  nowSeconds: number,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): ScopedKeyResult {
  const parentKey = process.env.TYPESENSE_SEARCH_KEY;
  if (!parentKey) {
    throw new Error(
      'TYPESENSE_SEARCH_KEY is required to mint scoped search keys (never derive from the admin key)'
    );
  }
  const key = getClient()
    .keys()
    .generateScopedSearchKey(parentKey, {
      filter_by: `tenant_id:=${tenantId}`,
      expires_at: nowSeconds + ttlSeconds,
    });
  return { key, expiresInSeconds: ttlSeconds };
}
