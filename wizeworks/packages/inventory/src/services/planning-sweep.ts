// The nightly planning pass (docs/146 Phase 7.1–7.5, 7.8, 7.9).
//
// Four measurements and one generation, in an order that is load-bearing:
//
//   1. LEAD TIMES   — from purchase orders against goods receipts. First,
//                     because the reorder maths needs them and nothing needs it.
//   2. DEMAND       — from the movement ledger. Independent of (1), but it must
//                     precede (3) and (4), both of which read what it wrote.
//   3. CLASSIFY     — ABC needs the year's usage value, XYZ needs the
//                     coefficient of variation demand just measured.
//   4. REORDER      — needs the demand rate, its spread, and the measured lead
//                     time and ITS spread. Everything above.
//   5. COUNTS       — generates the counts that are due, and its ABC filter reads
//                     the class step 3 just wrote. Last for that reason: a
//                     schedule for A-class stock run before classification would
//                     count yesterday's idea of what an A is.
//   6. SUPPLIERS    — scores every supplier (docs/146 Phase 8.1). After (1),
//                     because it COPIES the lead-time measurement rather than
//                     taking its own.
//   7. LATE ORDERS  — flags the submitted orders that have passed their due date
//                     with nothing received, and publishes one event each
//                     (docs/146 Phase 8.3). Independent of everything above.
//
// Six and seven ride this pass rather than a CronJob of their own for a plain
// reason: both are nightly, per-tenant, inventory-wide passes over the same
// tables, and a second scheduler would be a second thing to keep alive for no
// gain. They are the LAST stages so a failure in either cannot cost a business
// its stock numbers.
//
// ── Failures are collected, never thrown ─────────────────────────────────────
//
// Same discipline as Phase 1's integrity sweep. One tenant with a corrupt level
// must not stop the pass for everyone else, and one failing STAGE must not skip
// the stages after it — a business whose lead-time measurement failed still
// wants its demand forecast. Each stage records what it managed and what it did
// not, and the caller reports the lot.
//
// ── Why nightly, and why not on read ─────────────────────────────────────────
//
// The standard deviation of daily demand across ninety buckets, for every
// (variant, location), ranked against every other one for the ABC cut, is
// minutes of work on a real catalogue. It also does not change meaningfully
// between one afternoon and the next. What DOES change hour to hour — how much
// is on the shelf, how much is on order — is never materialised: days of cover
// and revenue at risk are computed live from the stored rate against the live
// quantity, so the figure a buyer reads at 4pm is not last night's.

import { withTenant } from '@wizeworks/db';

import type { ServiceContext } from '../errors';

import { refreshBackorderPromises } from './backorders';
import { recomputeClassifications } from './classification';
import { generateDueCounts } from './count-schedules';
import { recomputeDemandVelocity } from './demand';
import { sweepExpiringLots } from './expiry';
import { recomputeLeadTimes } from './lead-times';
import { markSweepCompleted } from './planning-policy';
import { syncPreorderWindowStatuses } from './preorders';
import { sweepLatePurchaseOrders } from './purchase-order-alerts';
import { recomputeReorderPoints } from './reorder-planning';
import { recomputeSupplierScorecards } from './supplier-scorecard';

export interface PlanningSweepResult {
  /** Every stage that ran, in order, with what it did or why it did not. */
  stages: PlanningSweepStage[];
  ok: boolean;
  levelsPlanned: number;
  countsGenerated: number;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export interface PlanningSweepStage {
  stage:
    | 'lead_times'
    | 'demand'
    | 'classification'
    | 'reorder_points'
    | 'count_schedules'
    | 'supplier_scorecards'
    | 'late_purchase_orders'
    | 'backorder_promises'
    | 'preorder_windows'
    | 'expiring_lots';
  ok: boolean;
  /** A short, human-readable account of what the stage found. */
  summary: string;
  detail: Record<string, unknown>;
  error?: string;
  durationMs: number;
}

export interface PlanningSweepOptions {
  /** Narrow the demand and reorder stages to one location. Classification is
   *  tenant-wide by nature — a cumulative value cut across one warehouse would
   *  crown that warehouse's biggest line an A regardless of the business. */
  warehouseId?: string;
  /** Skip generating counts. The stock stages are safe to re-run at any time;
   *  count generation creates real work for real people, so a "recompute the
   *  numbers" button must be able to leave it alone. */
  skipCountGeneration?: boolean;
  /** The instant the run is FOR. Passed to count generation so its due-date
   *  arithmetic is explicit rather than clock-dependent. */
  asOf?: Date;
}

/**
 * Run the whole pass for one tenant.
 *
 * Idempotent: every stage recomputes from source rather than accumulating, so a
 * second run in the same night changes nothing except the timestamps. Count
 * generation is the one stage that CREATES something, and it is idempotent by a
 * different mechanism — a schedule whose previous count is still open is skipped,
 * and `nextRunAt` moves forward past the instant it ran for.
 */
export async function runPlanningSweep(
  ctx: ServiceContext,
  options: PlanningSweepOptions = {}
): Promise<PlanningSweepResult> {
  const startedAt = new Date();
  const stages: PlanningSweepStage[] = [];
  let levelsPlanned = 0;
  let countsGenerated = 0;

  stages.push(
    await stage('lead_times', async () => {
      const r = await recomputeLeadTimes(ctx);
      return {
        summary:
          r.observations === 0
            ? 'No deliveries to measure yet — lead times are still whatever suppliers stated.'
            : `Measured ${r.observations} deliveries across ${r.suppliersMeasured} suppliers.`,
        detail: { ...r },
      };
    })
  );

  stages.push(
    await stage('demand', async () => {
      const r = await recomputeDemandVelocity(ctx, {
        ...(options.warehouseId ? { warehouseId: options.warehouseId } : {}),
      });
      return {
        summary: `Measured ${r.levelsComputed} stock lines; ${r.withDemand} have sold something in 90 days, ${r.withSeasonality} have a year of history.`,
        detail: { ...r },
      };
    })
  );

  stages.push(
    await stage('classification', async () => {
      const r = await recomputeClassifications(ctx);
      return {
        summary: `Ranked ${r.levelsClassified} stock lines — ${r.counts.A} A, ${r.counts.B} B, ${r.counts.C} C. ${r.changed} changed class.`,
        detail: { ...r },
      };
    })
  );

  stages.push(
    await stage('reorder_points', async () => {
      const r = await recomputeReorderPoints(ctx, {
        ...(options.warehouseId ? { warehouseId: options.warehouseId } : {}),
      });
      levelsPlanned = r.levelsPlanned;
      return {
        summary: `Worked out reorder points for ${r.levelsPlanned} stock lines. ${r.autoApplied} are managed automatically; ${r.divergent} differ from the level someone set by hand.`,
        detail: { ...r },
      };
    })
  );

  if (options.skipCountGeneration) {
    stages.push({
      stage: 'count_schedules',
      ok: true,
      summary: 'Skipped — this run was asked for the numbers only.',
      detail: { skipped: true },
      durationMs: 0,
    });
  } else {
    stages.push(
      await stage('count_schedules', async () => {
        const r = await generateDueCounts(ctx, {
          ...(options.asOf ? { asOf: options.asOf } : {}),
        });
        countsGenerated = r.countsCreated;
        return {
          summary:
            r.countsCreated === 0
              ? `Nothing due out of ${r.schedulesConsidered} schedules.`
              : `Created ${r.countsCreated} counts from ${r.schedulesConsidered} schedules.`,
          detail: { ...r },
        };
      })
    );
  }

  stages.push(
    await stage('supplier_scorecards', async () => {
      const r = await recomputeSupplierScorecards(ctx);
      return {
        summary:
          r.suppliersMeasured === 0
            ? 'No suppliers on file yet.'
            : `Scored ${r.suppliersScored} of ${r.suppliersMeasured} suppliers; the rest have too little history to grade.`,
        detail: { ...r },
      };
    })
  );

  stages.push(
    await stage('late_purchase_orders', async () => {
      const r = await sweepLatePurchaseOrders(ctx);
      return {
        summary:
          r.lateOrders === 0
            ? 'Nothing on order is overdue.'
            : `${r.lateOrders} order(s) overdue; ${r.newlyFlagged} flagged tonight.`,
        detail: { ...r },
      };
    })
  );

  // ── Demand-side commitments (docs/146 Phase 9) ────────────────────────────
  //
  // Three stages rather than three CronJobs, for the reason the Phase 8 pair are
  // here: one pass over the catalogue, and one place to look when it did not run.
  //
  // Promises first, because a purchase order raised today is exactly what turns
  // "no date" into a date, and a buyer opening the queue in the morning should
  // find last night's answer rather than yesterday's.
  stages.push(
    await stage('backorder_promises', async () => {
      const r = await refreshBackorderPromises(ctx);
      return {
        summary:
          r.considered === 0
            ? 'Nobody is waiting on stock.'
            : r.stillUndated > 0
              ? `${r.newlyDated} newly dated, ${r.redated} moved — ${r.stillUndated} still have no date anybody can give.`
              : `${r.newlyDated} newly dated, ${r.redated} moved; every commitment has a date.`,
        detail: { ...r },
      };
    })
  );

  stages.push(
    await stage('preorder_windows', async () => {
      const r = await syncPreorderWindowStatuses(ctx);
      return {
        summary:
          r.reconciled === 0
            ? 'No preorder windows changed state.'
            : `${r.opened} opened, ${r.closed} closed.`,
        detail: { ...r },
      };
    })
  );

  stages.push(
    await stage('expiring_lots', async () => {
      const r = await sweepExpiringLots(ctx);
      const parts: string[] = [];
      if (r.newlyFlagged > 0) parts.push(`${r.newlyFlagged} batch(es) newly within 30 days`);
      if (r.expired > 0) parts.push(`${r.expired} already past their date`);
      // Reported, not swallowed. A dated business with undated batches has a
      // data-entry problem, and a sweep that says nothing lets it grow.
      if (r.undated > 0) parts.push(`${r.undated} carrying no date at all`);
      return {
        summary: parts.length === 0 ? 'Nothing is close to expiring.' : `${parts.join('; ')}.`,
        detail: { ...r },
      };
    })
  );

  // Stamped even on a partial run: the screens need to know when the numbers
  // were last touched, and "we tried at 4:30 and three of five stages worked" is
  // more useful than a timestamp that only appears on perfection.
  await withTenant(ctx, (tx) => markSweepCompleted(tx, ctx.tenantId));

  const finishedAt = new Date();
  return {
    stages,
    ok: stages.every((s) => s.ok),
    levelsPlanned,
    countsGenerated,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
  };
}

/** Run one stage, timing it and turning a throw into a recorded failure. */
async function stage(
  name: PlanningSweepStage['stage'],
  run: () => Promise<{ summary: string; detail: Record<string, unknown> }>
): Promise<PlanningSweepStage> {
  const started = Date.now();
  try {
    const { summary, detail } = await run();
    return { stage: name, ok: true, summary, detail, durationMs: Date.now() - started };
  } catch (err) {
    return {
      stage: name,
      ok: false,
      summary: 'This step could not finish, so its numbers are from the last successful run.',
      detail: {},
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - started,
    };
  }
}
