// Platform capacity metering — what each tenant actually consumes.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
//
// Nothing was counting. Not storage, not email volume, not contacts, not seats.
// Piggles prices on exactly those ("charge for scale, not for access"), and
// sparx needs the same numbers to answer whether a tenant is expensive to serve.
//
// The urgency is that **usage history cannot be backfilled.** A tier priced next
// quarter needs to know what tenants were using last quarter, and nobody can
// reconstruct that after the fact — the rows either exist or the question is
// permanently unanswerable. So this runs and records long before anything bills
// on it.
//
// ── THE SHAPE: A NIGHTLY SNAPSHOT, NOT A LIVE COUNTER ───────────────────────
//
// Every measure here is recomputable from tables the platform already owns, so
// the cheap correct design is the one the other rollups use (docs/97 §5): a
// nightly pass that recomputes and overwrites, rather than an event-increment
// consumer that has to be perfectly reliable forever to stay accurate. A missed
// night is repaired by the next run; a missed increment is wrong until somebody
// notices.
//
// It also means enforcement must never read this table for a live decision. A
// figure up to 24 hours old is right for pricing and for a "you are near your
// limit" nudge, and wrong for "may this upload proceed" — that one has to count
// at the moment it acts.
//
// ── STOCKS, UNITS AND FLOWS ARE NOT THE SAME NUMBER ─────────────────────────
//
// Stocks and units are POINT-IN-TIME: what was true when the snapshot ran.
// Flows are a DAILY TOTAL: what happened during that day. Storing both in one
// row is convenient and is the single easiest thing to misread here, so the
// column comments and this note say it twice on purpose.
//
// Anything not measured stays NULL. It must never default to 0 — a defaulted
// zero renders identically to a real zero, and "no storage used" and "storage
// was never counted" are different answers that would produce different bills.
//
// ── RELATIVE IMPORTS HERE ARE EXTENSIONLESS, NOT `.js` ──────────────────────
//
// This package exports SOURCE (`"." : "./src/index.ts"`) and is consumed by a
// Next app, so Turbopack resolves these specifiers directly — and it does not do
// the `.js` → `.ts` remap that tsc and vitest both do. `./allowance.js` therefore
// typechecked, tested and linted clean and failed only in the image build with
// "Module not found". Extensionless is what every other source-exported package
// here uses; keep it that way.

import { prisma, withSystem, withTenant } from '@wizeworks/db';

// The two halves that read what this file writes: what a brand allows, and where
// a given tenant stands against it.
export {
  APPROACHING,
  METERS,
  NO_ALLOWANCE,
  readMeter,
  resolveCapacityAllowance,
  type CapacityAllowance,
  type Meter,
  type MeterReading,
  type MeterState,
  type ResolvedAllowance,
} from './allowance';
export { capacityReport, noticeableMeters, type CapacityReport } from './report';

/** What one tenant consumed. `null` means NOT MEASURED — never assume zero. */
export interface TenantUsage {
  storageBytes: bigint | null;
  contactsCount: number | null;
  seatsCount: number | null;
  sitesCount: number | null;
  locationsCount: number | null;
  emailSends: number | null;
}

/** UTC midnight for a date — the bucket key. Everything is bucketed in UTC so a
 *  tenant does not get two partial days when the clocks change. */
function utcDay(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
}

/**
 * Measure one tenant for one UTC day.
 *
 * Each measure is taken independently and degrades to `null` on its own rather
 * than failing the snapshot: one module's table being unavailable must not cost
 * us the other five numbers for that night. A partial row is useful; a missing
 * row is a hole in a history that cannot be refilled.
 */
export async function measureTenant(tenantId: string, day: Date): Promise<TenantUsage> {
  const bucket = utcDay(day);
  const nextDay = new Date(bucket.getTime() + 86_400_000);

  const safe = async <T>(read: () => Promise<T>): Promise<T | null> => {
    try {
      return await read();
    } catch {
      return null;
    }
  };

  // Tenant-scoped reads run inside the tenant's own RLS context — the same
  // guarantee every other consumer gets, rather than a privileged read that
  // would quietly work even if the scoping were wrong.
  const ctx = { tenantId };

  const [storageBytes, contactsCount, seatsCount, sitesCount, locationsCount, emailSends] =
    await Promise.all([
      safe(async () => {
        const agg = await withTenant(ctx, (tx) =>
          tx.mediaAsset.aggregate({ _sum: { byteSize: true } })
        );
        return agg._sum.byteSize ?? 0n;
      }),
      safe(() => withTenant(ctx, (tx) => tx.customer.count({ where: { deletedAt: null } }))),
      safe(() => withTenant(ctx, (tx) => tx.user.count())),
      safe(() => withTenant(ctx, (tx) => tx.property.count())),
      safe(() => withTenant(ctx, (tx) => tx.warehouse.count())),
      // The one FLOW: sends dispatched during this day, not a running total.
      //
      // `type: 'accepted'` is load-bearing. `email_events` records the whole
      // lifecycle of one email — accepted, delivered, opened, clicked — so
      // counting rows without filtering multiplies a single send by however many
      // times the recipient interacted with it, which would inflate the meter
      // roughly fourfold and bill people for their own customers' curiosity.
      //
      // `accepted` rather than `delivered` because accepted is the point the
      // provider took the message and charged us for it: a bounce still cost a
      // send, and delivery confirmations lag past the day boundary.
      safe(() =>
        withTenant(ctx, (tx) =>
          tx.emailEvent.count({
            where: { type: 'accepted', occurredAt: { gte: bucket, lt: nextDay } },
          })
        )
      ),
    ]);

  return { storageBytes, contactsCount, seatsCount, sitesCount, locationsCount, emailSends };
}

/** Measure a tenant and write its row. Idempotent — re-running for the same day
 *  overwrites, which is what makes a missed night self-repairing. */
export async function snapshotTenant(tenantId: string, day = new Date()): Promise<void> {
  const bucket = utcDay(day);
  const usage = await measureTenant(tenantId, bucket);

  await withTenant({ tenantId }, (tx) =>
    tx.rollupTenantDailyUsage.upsert({
      where: { tenantId_bucket: { tenantId, bucket } },
      create: { tenantId, bucket, ...usage, measuredAt: new Date() },
      update: { ...usage, measuredAt: new Date() },
    })
  );
}

export interface SnapshotSummary {
  tenants: number;
  written: number;
  failed: number;
}

/**
 * Snapshot every tenant for a day. The nightly cron's entry point.
 *
 * Tenants are processed one at a time rather than in a `Promise.all`: this runs
 * against the same database serving live traffic, and a thousand concurrent
 * six-query fans is a self-inflicted incident at 3am. Slow and finished beats
 * fast and throttled — there is a whole night for it.
 *
 * One tenant failing is logged and skipped. The alternative — throwing — loses
 * every remaining tenant's row for a day that can never be re-measured.
 */
export async function snapshotAllTenants(
  day = new Date(),
  log?: (msg: string, meta?: object) => void
): Promise<SnapshotSummary> {
  // The tenant list itself is a platform-level read: `tenants` is the non-RLS
  // dispatch row, and this is the one place that legitimately wants all of them.
  const tenants = await withSystem(() =>
    prisma.tenant.findMany({ select: { id: true }, orderBy: { createdAt: 'asc' } })
  );

  let written = 0;
  let failed = 0;

  for (const { id } of tenants) {
    try {
      await snapshotTenant(id, day);
      written++;
    } catch (err) {
      failed++;
      log?.('usage: snapshot failed for tenant', { tenantId: id, err: String(err) });
    }
  }

  return { tenants: tenants.length, written, failed };
}
