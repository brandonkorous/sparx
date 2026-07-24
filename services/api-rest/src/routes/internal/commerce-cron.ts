// Internal endpoints invoked by the Commerce k8s CronJobs (k8s/cronjobs/).
//
// Auth: shared secret in `X-sparx-Internal-Cron-Token`, constant-time
// compared against env.SPARX_INTERNAL_CRON_TOKEN. Same pattern as CRM's
// internal cron surface.
//
// Each endpoint runs one scheduler:
//   • POST /internal/commerce/reservation-reaper       → releases expired cart reservations
//   • POST /internal/commerce/revenue-rollup           → reconciles the daily-revenue rollup
//   • POST /internal/commerce/payment-reconcile-sweep  → heals orders stranded "Not paid"
//     by the client-confirm race (BUG-002): a card OrderPayment left `pending` whose
//     gateway intent already `succeeded`. Idempotent; a real-time capture (Part A) +
//     webhook cover the common cases, so this only ever catches the rare straggler.
//
// Per-tenant loops are sequential to keep DB load predictable. Commerce
// reaper runs every minute on a tight loop because the impact of a stuck
// reservation (held stock that a real shopper can't buy) gets worse the
// longer it sits. The revenue-rollup reconcile runs nightly (docs/97 §5) and
// accepts an optional `?days=` to widen the recomputed window for a backfill.

import { timingSafeEqual } from 'node:crypto';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

import { commerceSchedulers } from '@sparx/commerce';

import { env } from '../../env.js';
import { sweepStrandedCheckoutPayments } from '../../lib/payment-webhook-reconcile.js';

const CRON_TOKEN_HEADER = 'x-sparx-internal-cron-token';

function authorize(request: FastifyRequest): void {
  const expected = env.SPARX_INTERNAL_CRON_TOKEN;
  if (!expected) {
    throw unauthorized('Internal cron token is not configured.');
  }
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
): Promise<{ tenants: number; outcomes: TenantOutcome[] }> {
  const tenants = await commerceSchedulers.listCommerceActiveTenants();
  const outcomes: TenantOutcome[] = [];
  for (const t of tenants) {
    try {
      const result = await run(t.id);
      outcomes.push({ tenantId: t.id, ok: true, result });
    } catch (err) {
      outcomes.push({
        tenantId: t.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { tenants: tenants.length, outcomes };
}

/** Parse `?days=` into a positive integer window override, or undefined to use
 *  the scheduler default. Garbage / non-positive values fall through to the
 *  default rather than erroring a cron run. */
function parseDays(raw: unknown): number | undefined {
  if (typeof raw !== 'string') return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

const commerceCronRoutes: FastifyPluginAsync = (app) => {
  app.post('/internal/commerce/reservation-reaper', async (request) => {
    authorize(request);
    const summary = await forEachActiveTenant((tenantId) =>
      commerceSchedulers.reapExpiredReservations({ tenantId })
    );
    return { success: true, data: summary };
  });

  app.post<{ Querystring: { days?: string } }>(
    '/internal/commerce/revenue-rollup',
    async (request) => {
      authorize(request);
      const sinceDays = parseDays(request.query.days);
      const summary = await forEachActiveTenant((tenantId) =>
        commerceSchedulers.reconcileRevenueRollup(
          sinceDays !== undefined ? { tenantId, sinceDays } : { tenantId }
        )
      );
      return { success: true, data: summary };
    }
  );

  app.post('/internal/commerce/payment-reconcile-sweep', async (request) => {
    authorize(request);
    const summary = await forEachActiveTenant((tenantId) =>
      sweepStrandedCheckoutPayments(request.log, tenantId)
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

export default commerceCronRoutes;
