// Reporting isolation, the part of it that ships with the first dashboards.
//
// Dashboards multiply reporting load by exactly the factor that makes an
// unbounded, un-timed reporting query dangerous (docs/129 §2.3, §5). Two
// properties matter and are cheap to give a metric resolver:
//
//   1. A STATEMENT TIMEOUT, so a slow report degrades reporting only — never
//      checkout. Set with `SET LOCAL` inside each resolver's transaction, so it
//      is scoped to that one reporting query and released on commit.
//   2. GENUINE CONCURRENCY, BOUNDED. Each resolver opens its OWN transaction (its
//      own pooled connection) so several metrics run at once; a semaphore caps how
//      many, so a malformed request cannot fan out unbounded.
//
// A dedicated capped connection POOL (docs/129 §10 step 1) is the fuller form of
// this and a later refinement — these two properties are what a metric resolver
// actually needs first, and they cost no new infrastructure.

import { withTenant, type TxClient } from '@sparx/db';

// A reporting query that runs longer than this is a bug or an abuse, not a
// report anyone is waiting on. Milliseconds, per Postgres `statement_timeout`.
const STATEMENT_TIMEOUT_MS = 8_000;

// How many resolvers may hold a reporting connection at once. Kept well under the
// pool size so reporting can never starve the operational request path.
const MAX_CONCURRENCY = 6;

/**
 * A `run` for one tenant: opens a fresh tenant-scoped transaction with a
 * statement timeout and hands the resolver its `tx`. Each call is an independent
 * connection, which is what makes concurrent resolvers actually concurrent
 * (Prisma serialises queries within a single transaction).
 */
export function makeReportingRunner(tenantId: string) {
  return <T>(fn: (tx: TxClient) => Promise<T>): Promise<T> =>
    withTenant({ tenantId }, async (tx) => {
      // Integer literal (ms) — a constant, never interpolated from input.
      await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
      return fn(tx);
    });
}

/**
 * Run `tasks` with at most `MAX_CONCURRENCY` in flight, preserving input order in
 * the result. Each task settles independently — the caller wraps its own
 * try/catch so one failing metric never rejects the batch (docs/129 §5).
 */
export async function mapBounded<T, R>(
  items: readonly T[],
  task: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await task(items[index]!, index);
    }
  }
  const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
