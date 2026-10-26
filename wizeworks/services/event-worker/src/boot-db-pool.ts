// Set this PROCESS's Prisma pool before anything imports `@wizeworks/db`, whose client reads
// DB_CONNECTION_LIMIT at import (wizeworks/packages/db/src/connection-limit.ts). This module has
// no `@wizeworks/db` dependency, so importing it FIRST in index.ts lands the value in time.
//
// The floor is 2: `withAdvisoryTickLock` parks one connection on the lock transaction and runs
// the tick on another, so a pool of 1 deadlocks every tick with P2024.
// The default is 4, not the 20 this used to force: twelve handlers share it, and the whole
// platform has 35 Postgres slots (k8s/azure/apps/db-budget.yaml sets the real value).

export const MIN_CONNECTION_LIMIT = 2;
export const DEFAULT_CONNECTION_LIMIT = 4;

/** The pool this process opens: DB_CONNECTION_LIMIT when it is a positive integer, never below the floor. */
export function eventWorkerPool(raw: string | undefined): number {
  const n = Number(raw?.trim());
  const wanted = Number.isInteger(n) && n > 0 ? n : DEFAULT_CONNECTION_LIMIT;
  return Math.max(wanted, MIN_CONNECTION_LIMIT);
}

process.env.DB_CONNECTION_LIMIT = String(eventWorkerPool(process.env.DB_CONNECTION_LIMIT));
