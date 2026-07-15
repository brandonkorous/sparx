// Concurrency guards for the two booking paths the partial `booking_resources`
// EXCLUDE constraint does NOT cover (docs/79 §7.4). The EXCLUDE is authoritative for
// EXCLUSIVE resources (1:1 appointments) — two overlapping allocations on the same
// resource can't both commit. But it deliberately excludes:
//   · class SEATS — a class session's resource is non-exclusive; seats live in
//     booking_attendees, which has no overlap constraint. A naive count-then-insert
//     lets two concurrent joins both read "1 seat left" and both take it (overbook).
//   · POOLED (non-exclusive) resources — the EXCLUDE's `WHERE (exclusive …)` skips
//     them, so two concurrent bookings can both pass the in-app free check and both
//     allocate the same pooled unit (double-book).
//
// Both are read-then-write TOCTOU races under READ COMMITTED. We close them with a
// transaction-scoped advisory lock keyed on the contended entity, so the second
// writer BLOCKS until the first commits and then sees the committed state. The lock
// is held only for the life of the enclosing `withTenant` transaction (it uses
// pg_advisory_xact_lock), so it releases on commit/rollback with no manual unlock.

import type { TxClient } from '@sparx/db';

// Advisory-lock namespaces — the first key of pg_advisory_xact_lock's two-int form,
// so scheduling's locks occupy a distinct region from any other advisory-lock user
// (e.g. the automation run-tick). Arbitrary but STABLE — never renumber.
const LOCK_NS_CLASS_SEAT = 4801;
const LOCK_NS_POOLED_RESOURCE = 4802;

/** Serialize every seat mutation (join / cancel / promote) for one class session
 *  within this transaction, so a concurrent join can't read a stale seat count and
 *  overbook. Keyed on the session booking id; released at transaction end. */
export async function lockClassSession(tx: TxClient, bookingId: string): Promise<void> {
  // $executeRaw, not $queryRaw — the function returns `void`, a column type
  // Prisma's query path can't deserialize ("Failed to deserialize column of
  // type 'void'"). We never read a result, only wait for the lock, so the
  // statement-execution path (no result-row deserialization) is correct here.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NS_CLASS_SEAT}::int4, hashtext(${bookingId})::int4)`;
}

/** Serialize concurrent bookings competing for the same non-exclusive (pooled)
 *  resource — the case the partial EXCLUDE constraint doesn't guard. Locks are taken
 *  in a stable, de-duplicated order so two racing bookings that share more than one
 *  pooled candidate can't deadlock by acquiring them in opposite orders. Exclusive
 *  resources are NOT locked here (the DB EXCLUDE already covers them), so the common
 *  1:1-appointment path takes no extra lock. Released at transaction end. */
export async function lockPooledResources(tx: TxClient, resourceIds: string[]): Promise<void> {
  const sorted = [...new Set(resourceIds)].sort();
  for (const id of sorted) {
    // $executeRaw — see lockClassSession's comment; `void`-returning function.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NS_POOLED_RESOURCE}::int4, hashtext(${id})::int4)`;
  }
}
