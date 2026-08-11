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
import { prisma, withTenant } from '@sparx/db';
import { inventoryService } from '@sparx/inventory';

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

  return Promise.resolve();
};

function unauthorized(message: string): Error {
  const err = new Error(message);
  (err as { statusCode?: number }).statusCode = 401;
  (err as { code?: string }).code = 'UNAUTHORIZED';
  return err;
}

export default inventoryCronRoutes;
