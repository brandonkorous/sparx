import { withTenant } from '@wizeworks/db';

import {
  METERS,
  readMeter,
  resolveCapacityAllowance,
  type CapacityAllowance,
  type Meter,
  type MeterReading,
} from './allowance';

// Where a tenant stands against its allowance — the thing a surface renders.
//
// `index.ts` measures and files the nightly snapshot; `allowance.ts` says what
// the ceilings are. This joins them, and the join is not a lookup: HALF THE
// METERS ARE COUNTED LIVE and half are read from last night's row, on purpose.
//
// ── WHY NOT ALL FROM THE SNAPSHOT ───────────────────────────────────────────
//
// Because a person who has just invited a teammate and is looking at "3 of 3
// users" would reasonably conclude the invitation failed. Discrete units — seats,
// sites, locations — are small, deliberately changed, and changed by the person
// reading the screen; a figure that lags a day behind their own action reads as a
// broken meter, and there is nothing to gain by it. They are three `count()`s.
//
// ── WHY NOT ALL LIVE ────────────────────────────────────────────────────────
//
// Because stocks and flows do not work that way. Storage is an aggregate over
// every media row; contacts can be six figures; the month's sends is a scan of an
// event table. Those drift continuously rather than in response to one action, a
// figure from last night is a true answer to the question being asked, and the
// nightly snapshot exists precisely so a page does not pay for them. `measuredAt`
// is returned so a surface can SAY when they were taken rather than implying they
// are current.
//
// The split follows the taxonomy the pricing rules already use — stocks, flows,
// discrete units — which is the same reason those three words are in the schema.
//
// ── STILL NOT AN ENFORCEMENT POINT ──────────────────────────────────────────
//
// Nothing here blocks. This tells somebody where they stand; whether an addition
// may proceed is decided at the addition, counting live, at that moment.

/** A tenant's standing against every meter. */
export interface CapacityReport {
  meters: MeterReading[];
  /**
   * When the stocks and the flow were measured, or `null` if this tenant has
   * never been snapshotted.
   *
   * Null is NOT "zero" and NOT "today". A surface must say "not measured yet"
   * rather than draw an empty bar — a tenant provisioned this afternoon has no
   * row, and four bars at zero would tell them they have used nothing when the
   * truth is that nobody has looked.
   */
  measuredAt: Date | null;
  /** Whether this brand publishes ceilings at all. `none` → every meter reads
   *  `unmetered`, which is a deliberate state and not a failure. */
  allowanceSource: 'configured' | 'none';
  /** Meter names in the brand's capacity config that could not be read. Non-empty
   *  means somebody's configuration is wrong — surface it, do not swallow it. */
  rejected: string[];
}

/** UTC month start — the bucket the email FLOW is summed from. The allowance is
 *  written per calendar month, so the window has to be the calendar month; a
 *  rolling 30 days would quietly meter a different thing than the price says. */
function monthStart(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
}

function toBig(value: number | bigint | null): bigint | null {
  if (value === null) return null;
  return typeof value === 'bigint' ? value : BigInt(value);
}

/**
 * Read one tenant's capacity standing.
 *
 * Every read degrades on its own to `null` — "not measured" — rather than
 * failing the report. A capacity panel that 500s because one count timed out is
 * strictly worse than one that shows five meters and says the sixth is unknown,
 * and this renders on a page somebody opened to fix a problem.
 */
export async function capacityReport(
  tenantId: string,
  brand: string | null | undefined,
  now = new Date()
): Promise<CapacityReport> {
  const { allowance, source, rejected } = resolveCapacityAllowance(brand);
  const ctx = { tenantId };

  const safe = async <T>(read: () => Promise<T>): Promise<T | null> => {
    try {
      return await read();
    } catch {
      return null;
    }
  };

  const [snapshot, seats, sites, locations, emailSends] = await Promise.all([
    // Last night's stocks. `orderBy bucket desc` rather than "today's row",
    // because the job may not have run yet today and the most recent real
    // measurement is a better answer than none.
    safe(() =>
      withTenant(ctx, (tx) =>
        tx.rollupTenantDailyUsage.findFirst({
          where: { tenantId },
          orderBy: { bucket: 'desc' },
          select: { storageBytes: true, contactsCount: true, measuredAt: true },
        })
      )
    ),
    safe(() => withTenant(ctx, (tx) => tx.user.count())),
    safe(() => withTenant(ctx, (tx) => tx.property.count())),
    safe(() => withTenant(ctx, (tx) => tx.warehouse.count())),
    // The FLOW, summed across the calendar month's daily rows. Summing is the
    // correct read for this column and the wrong one for every other column in
    // that table — see the schema's own note.
    safe(() =>
      withTenant(ctx, (tx) =>
        tx.rollupTenantDailyUsage.aggregate({
          _sum: { emailSends: true },
          where: { tenantId, bucket: { gte: monthStart(now) } },
        })
      )
    ),
  ]);

  const used: Record<Meter, bigint | null> = {
    seats: toBig(seats),
    sites: toBig(sites),
    locations: toBig(locations),
    contacts: toBig(snapshot?.contactsCount ?? null),
    storageBytes: toBig(snapshot?.storageBytes ?? null),
    // `_sum` over no rows is null, which is exactly right: a tenant with no
    // measured days this month has an UNKNOWN month, not a month of zero sends.
    emailSendsPerMonth: toBig(emailSends?._sum.emailSends ?? null),
  };

  return {
    meters: METERS.map((meter) => readMeter(meter, used[meter], limitOf(allowance, meter))),
    measuredAt: snapshot?.measuredAt ?? null,
    allowanceSource: source,
    rejected,
  };
}

function limitOf(allowance: CapacityAllowance, meter: Meter): bigint | null {
  const value = meter === 'storageBytes' ? allowance.storageBytes : allowance[meter];
  return value === null ? null : BigInt(value);
}

/**
 * The meters worth interrupting somebody about, worst first.
 *
 * `over` before `approaching`, and within each the fullest first — a surface that
 * can show one notice should show the one that is actually about to cost them
 * something. Empty is the common and correct answer.
 */
export function noticeableMeters(report: CapacityReport): MeterReading[] {
  const rank = (m: MeterReading) => (m.state === 'over' ? 0 : 1);
  return report.meters
    .filter((m) => m.state === 'over' || m.state === 'approaching')
    .sort((a, b) => rank(a) - rank(b) || (b.fraction ?? 0) - (a.fraction ?? 0));
}
