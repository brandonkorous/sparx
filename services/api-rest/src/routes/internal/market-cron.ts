// Internal endpoint invoked by the market-settlement k8s CronJob (k8s/cronjobs/).
//
// Auth: shared secret in `X-sparx-Internal-Cron-Token`, constant-time compared
// against env.SPARX_INTERNAL_CRON_TOKEN — the same pattern as the channels/commerce
// cron surfaces.
//
//   • POST /internal/market/settle → for every commerce-active tenant, roll its
//     accrued sparx.market sales into a weekly settlement run, disburse via the
//     configured payout rail (or leave pending for manual ACH), and email the
//     settlement report (docs/106 §4.7).
//
// Per-tenant loops are sequential. computeSettlementRun is idempotent in effect —
// it only ever sweeps `accrued` rows, so a re-run finds nothing left to settle.

import { timingSafeEqual } from 'node:crypto';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

import { commerceSchedulers, marketService } from '@sparx/commerce';

import { env } from '../../env.js';

const CRON_TOKEN_HEADER = 'x-sparx-internal-cron-token';
const SETTLEMENT_PERIOD_DAYS = 7;

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
  error?: string;
  result?: unknown;
}

async function forEachActiveTenant<T>(
  run: (tenantId: string) => Promise<T>
): Promise<{ tenants: number; settled: number; outcomes: TenantOutcome[] }> {
  const tenants = await commerceSchedulers.listCommerceActiveTenants();
  const outcomes: TenantOutcome[] = [];
  let settled = 0;
  for (const t of tenants) {
    try {
      const result = await run(t.id);
      if (result) settled += 1;
      outcomes.push({ tenantId: t.id, ok: true, result });
    } catch (err) {
      outcomes.push({
        tenantId: t.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { tenants: tenants.length, settled, outcomes };
}

const marketCronRoutes: FastifyPluginAsync = (app) => {
  app.post('/internal/market/settle', async (request) => {
    authorize(request);
    const periodEnd = new Date();
    const periodStart = new Date(
      periodEnd.getTime() - SETTLEMENT_PERIOD_DAYS * 24 * 60 * 60 * 1000
    );
    const summary = await forEachActiveTenant((tenantId) =>
      marketService.runTenantSettlement({ tenantId }, { periodStart, periodEnd })
    );
    return { success: true, data: summary };
  });

  return Promise.resolve();
};

function unauthorized(message: string): Error {
  const err = new Error(message);
  (err as { statusCode?: number }).statusCode = 401;
  (err as { code?: string }).code = 'UNAUTHORIZED';
  return err;
}

export default marketCronRoutes;
