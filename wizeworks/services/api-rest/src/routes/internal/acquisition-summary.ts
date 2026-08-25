// The L-PLAT acquisition aggregation (docs/80 §10) — pure, and deliberately not
// owned by either route that serves it.
//
// It groups the `tenants.acquisition_*` columns (written once at signup from the
// first-party attribution cookies) into a channel / source / campaign breakdown
// that answers "which channels send us paying tenants?".
//
// ── WHY THIS IS ITS OWN FILE ────────────────────────────────────────────────
//
// Two callers need the same numbers and must never disagree about them:
//
//   • /internal/acquisition/summary — the shared-token endpoint, which also
//     emits CSV for a spreadsheet.
//   • /internal/operator/acquisition — the operator console's read, behind the
//     admin app's capability check.
//
// A second implementation of the grouping is how the console and the CSV start
// reporting different totals for the same week, with nothing to say which is
// right. One aggregation, two doors.

import type { Prisma } from '@wizeworks/db';
import type {
  OperatorAcquisitionBucket,
  OperatorAcquisitionSummary,
  OperatorAcquisitionTotals,
} from '@wizeworks/operator';

/**
 * NULL `acquisitionChannel` = signed up before attribution shipped, or arrived
 * with no touch cookie (which includes everybody who declined the consent bar).
 *
 * Kept DISTINCT from a classified `direct` touch on purpose: "we never measured
 * this" and "they typed the URL in" are different facts, and folding the first
 * into the second reports an absence as a measurement.
 */
export const UNATTRIBUTED = '(unknown)';

/** The columns the summary reads — nothing tenant-scoped, so it runs on the
 *  plain system client against the non-RLS `tenants` dispatch table. */
export const ACQUISITION_SELECT = {
  acquisitionChannel: true,
  acquisitionSource: true,
  acquisitionCampaign: true,
  acquiredAt: true,
  status: true,
  stripeCustomerId: true,
  createdAt: true,
} satisfies Prisma.TenantSelect;

export interface AcquisitionRow {
  acquisitionChannel: string | null;
  acquisitionSource: string | null;
  acquisitionCampaign: string | null;
  acquiredAt: Date | null;
  status: string;
  stripeCustomerId: string | null;
  createdAt: Date;
}

interface Acc {
  key: string;
  tenants: number;
  withBilling: number;
  active: number;
  firstAcquiredAt: Date | null;
  lastAcquiredAt: Date | null;
  channelTally: Map<string, number>;
  sourceTally: Map<string, number>;
}

/** Accumulates rows into one bucket per `keyOf` value, tracking dominant
 *  channel/source via a per-bucket tally so source/campaign rows can name the
 *  channel they overwhelmingly came through. */
function groupBy(
  rows: AcquisitionRow[],
  keyOf: (r: AcquisitionRow) => string,
  channelOf: (r: AcquisitionRow) => string,
  sourceOf: (r: AcquisitionRow) => string
): OperatorAcquisitionBucket[] {
  const acc = new Map<string, Acc>();
  for (const r of rows) {
    const key = keyOf(r);
    let bucket = acc.get(key);
    if (!bucket) {
      bucket = {
        key,
        tenants: 0,
        withBilling: 0,
        active: 0,
        firstAcquiredAt: null,
        lastAcquiredAt: null,
        channelTally: new Map(),
        sourceTally: new Map(),
      };
      acc.set(key, bucket);
    }
    bucket.tenants += 1;
    if (r.stripeCustomerId) bucket.withBilling += 1;
    if (r.status === 'active') bucket.active += 1;
    if (r.acquiredAt) {
      if (!bucket.firstAcquiredAt || r.acquiredAt < bucket.firstAcquiredAt) {
        bucket.firstAcquiredAt = r.acquiredAt;
      }
      if (!bucket.lastAcquiredAt || r.acquiredAt > bucket.lastAcquiredAt) {
        bucket.lastAcquiredAt = r.acquiredAt;
      }
    }
    const ch = channelOf(r);
    bucket.channelTally.set(ch, (bucket.channelTally.get(ch) ?? 0) + 1);
    const src = sourceOf(r);
    bucket.sourceTally.set(src, (bucket.sourceTally.get(src) ?? 0) + 1);
  }

  function dominant(tally: Map<string, number>): string {
    let best = '';
    let bestN = -1;
    for (const [k, n] of tally) {
      if (n > bestN) {
        best = k;
        bestN = n;
      }
    }
    return best;
  }

  return [...acc.values()]
    .map((b) => ({
      key: b.key,
      channel: dominant(b.channelTally),
      source: dominant(b.sourceTally),
      tenants: b.tenants,
      withBilling: b.withBilling,
      active: b.active,
      firstAcquiredAt: b.firstAcquiredAt ? b.firstAcquiredAt.toISOString() : null,
      lastAcquiredAt: b.lastAcquiredAt ? b.lastAcquiredAt.toISOString() : null,
    }))
    .sort((x, y) => y.tenants - x.tenants);
}

/**
 * The whole breakdown, in memory.
 *
 * Tenant count is small enough that one `findMany` plus this grouping is the
 * right shape; swap to a SQL `GROUP BY` if the table ever grows past what a
 * single read should carry.
 */
export function summarizeAcquisition(
  rows: AcquisitionRow[],
  window: { since: Date | null; until: Date | null },
  now: Date
): OperatorAcquisitionSummary {
  const totals: OperatorAcquisitionTotals = {
    tenants: rows.length,
    attributed: rows.filter((r) => r.acquisitionChannel !== null).length,
    unattributed: rows.filter((r) => r.acquisitionChannel === null).length,
    withBilling: rows.filter((r) => r.stripeCustomerId !== null).length,
  };

  const channelOf = (r: AcquisitionRow): string => r.acquisitionChannel ?? UNATTRIBUTED;
  const sourceOf = (r: AcquisitionRow): string => r.acquisitionSource ?? UNATTRIBUTED;

  return {
    generatedAt: now.toISOString(),
    window: {
      since: window.since ? window.since.toISOString() : null,
      until: window.until ? window.until.toISOString() : null,
    },
    totals,
    byChannel: groupBy(rows, channelOf, channelOf, sourceOf),
    // Source and campaign rows drop the un-attributed tenants entirely rather
    // than bucketing them under "(unknown)": a tenant with no campaign is not a
    // member of some campaign called nothing, and counting them as one would put
    // the biggest bar in every campaign chart on a row that means "no data".
    bySource: groupBy(
      rows.filter((r) => r.acquisitionSource !== null),
      sourceOf,
      channelOf,
      sourceOf
    ),
    byCampaign: groupBy(
      rows.filter((r) => r.acquisitionCampaign !== null),
      (r) => r.acquisitionCampaign ?? UNATTRIBUTED,
      channelOf,
      sourceOf
    ),
  };
}
