// Single-flight guard for the platform's background TICKS, built on a
// TRANSACTION-scoped Postgres advisory lock.
//
// ─── Why this exists (the bug it replaces) ─────────────────────────────────
//
// Every tick used to guard itself like:
//
//     await prisma.$queryRaw`SELECT pg_try_advisory_lock(KEY)`   // acquire
//     ...work...
//     await prisma.$queryRaw`SELECT pg_advisory_unlock(KEY)`     // release
//
// `pg_advisory_lock` is SESSION-scoped, but `prisma.$queryRaw` runs on whatever
// pooled connection is free. So the acquire could land on connection A and the
// release on connection B — where the unlock returns false (B is not the holder)
// and is silently discarded, leaving the lock held on A until that connection is
// recycled. A tick could thus PERMANENTLY lose its own lock: every later run saw
// `acquired: false`, logged the benign "held by another pod, skipping", and never
// ran again until the pod restarted. Observed directly in pg_locks against idle
// sessions.
//
// ─── The fix ───────────────────────────────────────────────────────────────
//
// `pg_advisory_xact_lock` is TRANSACTION-scoped: Postgres releases it
// automatically at commit or rollback, on the same connection that took it. So
// acquire + release can no longer split across connections — the leak is
// structurally impossible.
//
// The lock transaction holds ONLY the lock. The tick's real work — the per-tenant
// `withTenant` writes, the Pub/Sub publishes, the external HTTP — still runs on
// OTHER pooled connections exactly as before, so nothing about the work's
// transactional or error semantics changes. This deliberately does NOT wrap the
// tick's work in one big transaction (that would break per-row isolation and make
// an already-published Pub/Sub event roll back). The only cost is that one
// connection is pinned for the tick's DURATION — transient, released the moment
// the tick returns, not the permanent per-pod connection a dedicated lock client
// would need.
//
// `timeoutMs` must exceed the longest a tick can run: the whole callback executes
// inside the lock transaction, and Prisma aborts an interactive transaction that
// overruns its timeout (default 5s — far too short for a batch tick). It defaults
// generously; a tick with unusually heavy per-row work can raise it.

import { prisma } from './client';

/** The Prisma client this helper takes the lock on. `typeof prisma` so a
 *  dependency-injected client (the automation tick passes its own) is accepted
 *  with no extra import — it is the same PrismaClient type. */
type LockClient = typeof prisma;

/**
 * Run `fn` while holding the transaction-scoped advisory lock `key`, or return
 * `whenHeld` immediately if another pod/tick already holds it.
 *
 * @param key       one of ADVISORY_LOCKS (see ./advisory-locks)
 * @param whenHeld  the value to return when the lock could not be acquired —
 *                  each tick passes its own `{ acquired: false, ... }` skip result
 * @param fn        the tick body; runs to completion under the lock
 * @param opts.client  the Prisma client to take the lock on — defaults to the
 *                  shared `prisma`. A tick that runs its work on an INJECTED
 *                  client (e.g. the automation tick) must pass that SAME client,
 *                  or the lock and the work could sit on different pools. The
 *                  advisory lock is database-scoped, so any client on the same
 *                  Postgres database mutually excludes correctly.
 */
export async function withAdvisoryTickLock<T>(
  key: number,
  whenHeld: T,
  fn: () => Promise<T>,
  opts: { timeoutMs?: number; client?: LockClient } = {}
): Promise<T> {
  const client = opts.client ?? prisma;
  return client.$transaction(
    async (lockTx) => {
      const [row] = await lockTx.$queryRaw<{ acquired: boolean }[]>`
        SELECT pg_try_advisory_xact_lock(${key}::int) AS acquired
      `;
      if (!row?.acquired) return whenHeld;
      // The lock is held for as long as THIS transaction stays open. `fn` runs its
      // own queries on the pool (separate connections); we simply hold here until
      // it resolves, then the transaction commits and the lock releases.
      return fn();
    },
    // maxWait: time to get a connection from the pool to even start; timeout: the
    // ceiling on the whole tick. 10 min covers the largest batch tick with room to
    // spare, and a tick that somehow ran longer SHOULD abort rather than pin a
    // connection indefinitely.
    { maxWait: 5_000, timeout: opts.timeoutMs ?? 600_000 }
  );
}
