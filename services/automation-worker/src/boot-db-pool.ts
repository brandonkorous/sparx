// Raise the Prisma connection-pool size for THIS worker before anything imports
// `@sparx/db` — its client is constructed at import time and reads the pool size
// from the `connection_limit` query param on DATABASE_URL (packages/db/src/client.ts).
// This module has no `@sparx/db` dependency, so importing it FIRST in index.ts
// guarantees the rewrite lands before the client exists.
//
// WHY this worker is special. The platform tick pattern `withAdvisoryTickLock`
// (packages/db/src/advisory-tick-lock.ts) deliberately PARKS one connection on the
// advisory-lock transaction and runs the tick's own work on SEPARATE pool
// connections — so it needs a pool of at least 2. Every service that runs these
// ticks (api-rest, and this worker) must satisfy that. The shared
// `database-url-cloudrun` secret pins `connection_limit=1`, which is correct for the
// simple one-query Pub/Sub consumers that also use it (email-worker, media-worker…)
// but deadlocks every tick here with P2024 "Timed out fetching a connection". Rather
// than widen the shared secret (blast radius: every worker), this bumps the floor for
// THIS process only.
//
// INVARIANT: connection_limit must be >= 2 * Cloud Run max_instance_request_concurrency
// (each in-flight request can hold two connections: the lock tx + its work). This
// worker runs at concurrency = 2 (terraform/envs/prod/automation.tf), so the floor of
// 5 leaves headroom. If you raise the Cloud Run concurrency, raise this floor with it.

const MIN_CONNECTION_LIMIT = 5;

/**
 * Return `url` with `connection_limit` raised to at least `min`. Pure string work on
 * the query segment only — never touches the userinfo/host, so a password with URL
 * metacharacters is left byte-for-byte intact.
 */
export function withMinConnectionLimit(url: string, min: number): string {
  const match = /([?&]connection_limit=)(\d+)/.exec(url);
  if (match) {
    if (Number(match[2]) >= min) return url;
    return url.replace(/([?&]connection_limit=)\d+/, `$1${min}`);
  }
  return `${url}${url.includes('?') ? '&' : '?'}connection_limit=${min}`;
}

const current = process.env.DATABASE_URL;
if (current) {
  process.env.DATABASE_URL = withMinConnectionLimit(current, MIN_CONNECTION_LIMIT);
}
