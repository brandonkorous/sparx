// Raise the Prisma connection-pool size for this PROCESS before anything imports
// `@sparx/db` — its client is constructed at import time and reads the pool size
// from the `connection_limit` query param on DATABASE_URL (packages/db/src/client.ts).
// This module has no `@sparx/db` dependency, so importing it FIRST in index.ts
// guarantees the rewrite lands before the client exists.
//
// WHY THE FLOOR EXISTS. The platform tick pattern `withAdvisoryTickLock`
// (packages/db/src/advisory-tick-lock.ts) deliberately PARKS one connection on the
// advisory-lock transaction and runs the tick's own work on SEPARATE pool
// connections — so it needs a pool of at least 2. A pool of 1 deadlocks every tick
// with P2024, "Timed out fetching a connection".
//
// WHY IT IS 20 AND NOT 5. This file belonged to automation-worker, which was one
// process holding one pool for one handler. It is now the entrypoint for the whole
// event-worker, where TWELVE handlers share a single pool: an `email.send` in flight
// holds a connection while a `product.updated` wants one, and the automation tick
// still wants its two. Prisma's default here would be 5 (num_cpus * 2 + 1 on a
// 2-vCPU node), which was ample per-worker and is a queue when twelve of them share
// it — handlers would serialize behind the pool rather than behind their work.
//
// This still cuts total connections sharply. Twelve pods at Prisma's default of 5
// was up to 60; one pod at 20 is 20, against a database with no pooler in front of
// it. If the fleet is ever split again, or a handler is added that holds a
// connection across an external call, revisit this number rather than letting it
// drift.

const MIN_CONNECTION_LIMIT = 20;

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
