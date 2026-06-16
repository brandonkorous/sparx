// Internal endpoint invoked by the site-analytics k8s CronJob (k8s/cronjobs/).
//
// Auth: shared secret in `X-Sparx-Internal-Cron-Token`, constant-time compared
// against env.SPARX_INTERNAL_CRON_TOKEN — same pattern as the other internal
// cron surfaces (ClusterIP-only, no JWT).
//
//   POST /internal/site/analytics-rollup?days=
//     → reconciles `rollup_site_daily` from the raw site_analytics_events for a
//       trailing window, per tenant that has captured ≥1 event. Idempotent
//       (delete-window-then-insert); the read endpoint live-overlays the open
//       day so this only needs to run nightly (docs/97 §5). `?days=` widens the
//       recomputed window for a backfill.

import { timingSafeEqual } from 'node:crypto';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { prisma, withTenant } from '@sparx/db';

import { env } from '../../env.js';
import { addUtcDays, reconcileSiteDaily, startOfUtcDay } from '../../lib/site-analytics-reports.js';

const CRON_TOKEN_HEADER = 'x-sparx-internal-cron-token';
// Default trailing window recomputed each night — a couple of days covers any
// late-arriving events without rescanning all history.
const DEFAULT_WINDOW_DAYS = 3;

function authorize(request: FastifyRequest): void {
  const expected = env.SPARX_INTERNAL_CRON_TOKEN;
  if (!expected) throw unauthorized('Internal cron token is not configured.');
  const provided = request.headers[CRON_TOKEN_HEADER];
  if (typeof provided !== 'string' || provided.length === 0) {
    throw unauthorized('Missing X-Sparx-Internal-Cron-Token header.');
  }
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw unauthorized('Invalid cron token.');
  }
}

function parseDays(raw: unknown): number {
  if (typeof raw !== 'string') return DEFAULT_WINDOW_DAYS;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_WINDOW_DAYS;
}

interface TenantOutcome {
  tenantId: string;
  ok: boolean;
  error?: string;
  rows?: number;
}

const siteAnalyticsCronRoutes: FastifyPluginAsync = (app) => {
  app.post<{ Querystring: { days?: string } }>(
    '/internal/site/analytics-rollup',
    async (request) => {
      authorize(request);
      const days = parseDays(request.query.days);
      const toExclusive = addUtcDays(startOfUtcDay(new Date()), 1);
      const windowStart = addUtcDays(toExclusive, -(days + 1));

      // Active tenants that have captured ≥1 site-analytics event — a tenant with
      // none would reconcile an empty window for nothing.
      const tenants = await prisma.tenant.findMany({
        where: { status: 'active', siteAnalyticsEvents: { some: {} } },
        select: { id: true },
      });

      const outcomes: TenantOutcome[] = [];
      for (const t of tenants) {
        try {
          const result = await withTenant({ tenantId: t.id }, (tx) =>
            reconcileSiteDaily(tx, t.id, windowStart, toExclusive)
          );
          outcomes.push({ tenantId: t.id, ok: true, rows: result.rows });
        } catch (err) {
          outcomes.push({
            tenantId: t.id,
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      return { success: true, data: { tenants: tenants.length, outcomes } };
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

export default siteAnalyticsCronRoutes;
