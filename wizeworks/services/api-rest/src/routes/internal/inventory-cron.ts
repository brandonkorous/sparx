// Internal endpoint invoked by the inventory-valuation k8s CronJob (k8s/cronjobs/).
//
// Auth: shared secret in `X-sparx-Internal-Cron-Token`, constant-time compared
// against env.SPARX_INTERNAL_CRON_TOKEN — same pattern as the other internal
// cron surfaces (ClusterIP-only, no JWT).
//
//   POST /internal/inventory/valuation-snapshot
//     → captures today's inventory valuation (units + value at cost/retail) as a
//       point-in-time snapshot row in rollup_inventory_daily_valuation, per
//       active Inventory tenant. Idempotent (upsert on (tenant, today)), so a
//       re-run within the day just refreshes today's snapshot.
//
// Enumerate by the non-RLS `tenants.settings.modules.inventory` JSON flag (the
// proven scheduler pattern), NOT a relation to a FORCE-RLS table — a
// platform-level relation query returns zero rows in prod. The snapshot then
// runs INSIDE withTenant where RLS scopes the read + write to that tenant.

import { timingSafeEqual } from 'node:crypto';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { prisma, withTenant } from '@wizeworks/db';
import { inventoryService } from '@wizeworks/inventory';

import { env } from '../../env.js';
import { snapshotInventoryValuation, startOfUtcDay } from '../../lib/inventory-valuation.js';

const CRON_TOKEN_HEADER = 'x-sparx-internal-cron-token';

function authorize(request: FastifyRequest): void {
  const expected = env.SPARX_INTERNAL_CRON_TOKEN;
  if (!expected) throw unauthorized('Internal cron token is not configured.');
  const provided = request.headers[CRON_TOKEN_HEADER];
  if (typeof provided !== 'string' || provided.length === 0) {
    throw unauthorized('Missing X-sparx-Internal-Cron-Token header.');
  }
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw unauthorized('Invalid cron token.');
  }
}

interface TenantOutcome {
  tenantId: string;
  ok: boolean;
  units?: number;
  costCents?: number;
  error?: string;
}

interface IntegrityOutcome {
  tenantId: string;
  ok: boolean;
  levelsChecked?: number;
  driftCount?: number;
  driftValueCents?: number;
  sourcesChecked?: number;
  newlyStale?: number;
  recovered?: number;
  error?: string;
}

interface PlanningOutcome {
  tenantId: string;
  ok: boolean;
  levelsPlanned?: number;
  countsGenerated?: number;
  durationMs?: number;
  failedStages?: { stage: string; error: string }[];
  error?: string;
}

const inventoryCronRoutes: FastifyPluginAsync = (app) => {
  app.post('/internal/inventory/valuation-snapshot', async (request) => {
    authorize(request);
    const bucket = startOfUtcDay(new Date());

    const tenants = await prisma.tenant.findMany({
      where: {
        status: 'active',
        settings: { path: ['modules', 'inventory', 'enabled'], equals: true },
      },
      select: { id: true },
    });

    const outcomes: TenantOutcome[] = [];
    for (const t of tenants) {
      try {
        const v = await withTenant({ tenantId: t.id }, (tx) =>
          snapshotInventoryValuation(tx, t.id, bucket)
        );
        outcomes.push({
          tenantId: t.id,
          ok: true,
          units: v.totalUnits,
          costCents: v.totalCostCents,
        });
      } catch (err) {
        outcomes.push({
          tenantId: t.id,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { success: true, data: { tenants: tenants.length, outcomes } };
  });

  // ── Integrity sweep (docs/146 Phase 1) ─────────────────────────────────────
  //
  //   POST /internal/inventory/integrity-sweep
  //     → per active Inventory tenant: (1) reconcile the ledger against the
  //       recorded levels, (2) evaluate every source against its freshness SLO.
  //
  // The two run together because they answer the same question from opposite
  // ends — "is this number internally consistent" and "is this number recent" —
  // and an operator who is told one without the other still cannot decide whether
  // to trust it. One nightly job, one integrity result.
  //
  // Per-tenant failures are collected, never thrown: one tenant with a corrupt
  // level must not stop the sweep for everyone else, and a sweep that dies
  // halfway through leaves the tenants after it silently unchecked — which is the
  // exact failure mode this whole feature exists to eliminate.
  app.post('/internal/inventory/integrity-sweep', async (request) => {
    authorize(request);

    // Enumerate by the non-RLS `tenants.settings` JSON flag, NOT a relation to a
    // FORCE-RLS table — a platform-level relation query returns zero rows in prod.
    const tenants = await prisma.tenant.findMany({
      where: {
        status: 'active',
        settings: { path: ['modules', 'inventory', 'enabled'], equals: true },
      },
      select: { id: true },
    });

    const outcomes: IntegrityOutcome[] = [];
    for (const t of tenants) {
      const ctx = { tenantId: t.id };
      const outcome: IntegrityOutcome = { tenantId: t.id, ok: true };
      try {
        const run = await inventoryService.runReconciliation(ctx, { scope: 'full' });
        outcome.levelsChecked = run.levelsChecked;
        outcome.driftCount = run.driftCount;
        outcome.driftValueCents = run.driftValueCents;
        // `runReconciliation` records its own failure rather than throwing, so an
        // `error` status here is a real finding and must not read as success.
        if (run.status === 'error') {
          outcome.ok = false;
          outcome.error = run.error ?? 'reconciliation failed';
        }
      } catch (err) {
        outcome.ok = false;
        outcome.error = err instanceof Error ? err.message : String(err);
      }

      try {
        const sweep = await inventoryService.sweepSourceFreshness(ctx);
        outcome.sourcesChecked = sweep.sourcesChecked;
        outcome.newlyStale = sweep.newlyStale;
        outcome.recovered = sweep.recovered;
      } catch (err) {
        outcome.ok = false;
        outcome.error = [outcome.error, err instanceof Error ? err.message : String(err)]
          .filter(Boolean)
          .join('; ');
      }

      outcomes.push(outcome);
    }

    return { success: true, data: { tenants: tenants.length, outcomes } };
  });

  // ── Planning sweep (docs/146 Phase 7) ──────────────────────────────────────
  //
  //   POST /internal/inventory/planning-sweep
  //     → per active Inventory tenant, in this order: measure supplier lead
  //       times from receipts, measure demand from the ledger, re-rank ABC/XYZ,
  //       recompute reorder points, then generate the cycle counts that are due.
  //
  // Runs at 03:30 UTC — BEFORE the integrity sweep at 04:30 and the valuation
  // snapshot at 05:30. The order matters in one direction only: classification
  // reads the cost basis, so it wants to run before the day's valuation is
  // frozen, and a drift discovered at 04:30 should be reported against numbers
  // that were planned the same night rather than the night before.
  //
  // Per-tenant AND per-stage failures are collected rather than thrown. The
  // sweep itself already collects its stages; this loop collects tenants, so one
  // corrupt catalogue cannot leave every tenant after it unplanned.
  app.post('/internal/inventory/planning-sweep', async (request) => {
    authorize(request);

    const tenants = await prisma.tenant.findMany({
      where: {
        status: 'active',
        settings: { path: ['modules', 'inventory', 'enabled'], equals: true },
      },
      select: { id: true },
    });

    const outcomes: PlanningOutcome[] = [];
    for (const t of tenants) {
      try {
        const run = await inventoryService.runPlanningSweep({ tenantId: t.id });
        outcomes.push({
          tenantId: t.id,
          ok: run.ok,
          levelsPlanned: run.levelsPlanned,
          countsGenerated: run.countsGenerated,
          durationMs: run.durationMs,
          // Only the stages that FAILED. A green run reports a count, not five
          // paragraphs nobody reads.
          failedStages: run.stages
            .filter((s) => !s.ok)
            .map((s) => ({ stage: s.stage, error: s.error ?? 'unknown' })),
        });
      } catch (err) {
        outcomes.push({
          tenantId: t.id,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { success: true, data: { tenants: tenants.length, outcomes } };
  });

  //   POST /internal/inventory/report-delivery
  //     → sends every report schedule whose next run time has passed, across
  //       every tenant, then advances each one's clock.
  //
  // Hourly, because a schedule names an hour in the TENANT's timezone and there
  // is no single time of day that could serve all of them. The sweep enumerates
  // due rows itself (one indexed query platform-wide) rather than looping
  // tenants: unlike the sweeps above, most tenants have nothing due on most
  // ticks, so iterating every Inventory tenant to ask would be the expensive
  // part of the job.
  app.post('/internal/inventory/report-delivery', async (request) => {
    authorize(request);
    const result = await inventoryService.sweepDueReports();
    return { success: true, data: result };
  });

  return Promise.resolve();
};

function unauthorized(message: string): Error {
  const err = new Error(message);
  (err as { statusCode?: number }).statusCode = 401;
  (err as { code?: string }).code = 'UNAUTHORIZED';
  return err;
}

export default inventoryCronRoutes;
