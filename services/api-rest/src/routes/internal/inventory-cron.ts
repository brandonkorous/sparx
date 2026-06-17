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

  return Promise.resolve();
};

function unauthorized(message: string): Error {
  const err = new Error(message);
  (err as { statusCode?: number }).statusCode = 401;
  (err as { code?: string }).code = 'UNAUTHORIZED';
  return err;
}

export default inventoryCronRoutes;
