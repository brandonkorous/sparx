// Internal endpoints invoked by the Automation k8s CronJobs (k8s/cronjobs/).
//
// Auth: shared secret in `X-sparx-Internal-Cron-Token`, constant-time
// compared against env.SPARX_INTERNAL_CRON_TOKEN. Same pattern as the CRM,
// Commerce, Invoicing and Dropship internal cron surfaces — ClusterIP-only, no
// JWT.
//
// Each endpoint runs one scheduler:
//   • POST /internal/automations/runs-rollup → reconciles the daily
//     run-activity rollup (per tenant that owns ≥1 automation)
//
// Automations are a platform capability (no module gate), so the scheduler
// enumerates tenants that own at least one automation rather than a module-flag
// set. Per-tenant loops are sequential to keep DB load predictable. The
// reconcile runs nightly (docs/97 §5) and accepts an optional `?days=` to widen
// the recomputed window for a backfill.

import { timingSafeEqual } from 'node:crypto';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

import { automationSchedulers } from '@sparx/automation';

import { env } from '../../env.js';

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
  const tenants = await automationSchedulers.listAutomationActiveTenants();
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

const automationCronRoutes: FastifyPluginAsync = (app) => {
  app.post<{ Querystring: { days?: string } }>(
    '/internal/automations/runs-rollup',
    async (request) => {
      authorize(request);
      const sinceDays = parseDays(request.query.days);
      const summary = await forEachActiveTenant((tenantId) =>
        automationSchedulers.reconcileRunsRollup(
          sinceDays !== undefined ? { tenantId, sinceDays } : { tenantId }
        )
      );
      return { success: true, data: summary };
    }
  );

  return Promise.resolve();
};

function unauthorized(message: string): Error {
  const err = new Error(message);
  (err as { statusCode?: number }).statusCode = 401;
  (err as { code?: string }).code = 'UNAUTHORIZED';
  return err;
}

export default automationCronRoutes;
