// Internal endpoint invoked by the platform-usage k8s CronJob (k8s/cronjobs/).
//
// Auth: shared secret in `X-sparx-Internal-Cron-Token`, constant-time compared
// against env.SPARX_INTERNAL_CRON_TOKEN. Same pattern as the CRM, Commerce,
// Automation, Invoicing and Dropship internal cron surfaces — ClusterIP-only,
// no JWT.
//
//   • POST /internal/platform/usage-rollup → snapshots what every tenant is
//     consuming (storage, contacts, seats, sites, locations, and the day's
//     email sends) into `rollup_tenant_daily_usage`.
//
// ── WHY IT ENUMERATES EVERY TENANT, WITH NO MODULE GATE ─────────────────────
//
// Capacity is a PLATFORM concern, not a module's. A tenant with no modules
// enabled still occupies storage and still has seats, and is exactly the kind of
// account whose cost-to-serve is worth knowing. Gating this on a module flag
// would silently exclude the cheapest and the most abandoned accounts — the two
// ends of the distribution a pricing decision most needs to see.
//
// ── `?date=` IS FOR RE-RUNNING A DAY, NOT FOR BACKFILLING ONE ───────────────
//
// It re-measures against TODAY'S data and files the result under the date given.
// That is correct for repairing a night the job did not run (the stocks have
// barely moved), and WRONG for inventing history that was never captured —
// point-in-time measures cannot be reconstructed after the fact. The flow
// (`email_sends`) is genuinely historical and will be right for any past date;
// the stocks will not be. Use it to repair, never to fabricate.

import { timingSafeEqual } from 'node:crypto';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

import { snapshotAllTenants } from '@wizeworks/usage';

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

/** `YYYY-MM-DD` only. Anything else is ignored rather than guessed at — a
 *  misparsed date files a whole night's measurements under the wrong day, and
 *  the wrong day is worse than today. */
function parseDate(raw: string | undefined): Date | undefined {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

const usageCronRoutes: FastifyPluginAsync = (app) => {
  app.post<{ Querystring: { date?: string } }>(
    '/internal/platform/usage-rollup',
    async (request) => {
      authorize(request);
      const day = parseDate(request.query.date);

      const summary = await snapshotAllTenants(day ?? new Date(), (msg, meta) => {
        // One tenant failing is expected and survivable; the run continues and
        // reports it. Logged at warn so a persistent failure is visible without
        // paging on a single flaky tenant.
        request.log.warn(meta ?? {}, msg);
      });

      // `failed` is returned rather than swallowed so the CronJob's own logs
      // show a partial night. A run that measured 900 of 1000 tenants is a
      // success by exit code and a problem by content, and only the body says so.
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

export default usageCronRoutes;
