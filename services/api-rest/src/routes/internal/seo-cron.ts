// Internal endpoint invoked by the Search Console k8s CronJob (k8s/cronjobs/).
//
// Auth: shared secret in `X-Sparx-Internal-Cron-Token`, constant-time compared
// against env.SPARX_INTERNAL_CRON_TOKEN — same pattern as the other internal
// cron surfaces (ClusterIP-only, no JWT).
//
//   POST /internal/seo/search-console-sync
//     → for every active Builder tenant with a CONNECTED Search Console site,
//       pulls the Search Analytics API and overwrites the organic rollup + top
//       queries (docs/97 §4). GSC data lags ~2-3 days, so a nightly run is
//       plenty; a failed sync records last_error + status='error' on that one
//       connection and never blocks the others.
//
// Why enumerate by `settings.modules.builder.enabled` (not a relation to the
// connections table): the connections table is FORCE-RLS, so a platform-level
// (no tenant context) relation query returns zero rows and the cron would no-op.
// Tenants is the non-RLS dispatch row, so the JSON-flag filter is safe; we then
// read each tenant's connections INSIDE withTenant where RLS lets them through.

import { timingSafeEqual } from 'node:crypto';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { prisma, withTenant } from '@sparx/db';

import { env } from '../../env.js';
import { syncConnection, SYNC_CONNECTION_SELECT } from '../../lib/search-console/sync.js';

const CRON_TOKEN_HEADER = 'x-sparx-internal-cron-token';

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

interface ConnectionOutcome {
  tenantId: string;
  connectionId: string;
  ok: boolean;
  days?: number;
  queries?: number;
  error?: string;
}

const seoCronRoutes: FastifyPluginAsync = (app) => {
  app.post('/internal/seo/search-console-sync', async (request) => {
    authorize(request);

    const tenants = await prisma.tenant.findMany({
      where: {
        status: 'active',
        settings: { path: ['modules', 'builder', 'enabled'], equals: true },
      },
      select: { id: true },
    });

    const outcomes: ConnectionOutcome[] = [];
    for (const t of tenants) {
      // One short read to enumerate this tenant's connected sites...
      const conns = await withTenant({ tenantId: t.id }, (tx) =>
        tx.searchConsoleConnection.findMany({
          where: { status: 'connected', siteUrl: { not: null } },
          select: SYNC_CONNECTION_SELECT,
        })
      );
      // ...then one transaction per connection to keep each sync's tx bounded.
      for (const conn of conns) {
        try {
          const result = await withTenant({ tenantId: t.id }, (tx) => syncConnection(tx, conn));
          outcomes.push({ tenantId: t.id, connectionId: conn.id, ok: true, ...result });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await withTenant({ tenantId: t.id }, (tx) =>
            tx.searchConsoleConnection.update({
              where: { id: conn.id },
              data: { status: 'error', lastError: message.slice(0, 500) },
            })
          ).catch(() => undefined);
          outcomes.push({ tenantId: t.id, connectionId: conn.id, ok: false, error: message });
        }
      }
    }

    return {
      success: true,
      data: { tenants: tenants.length, connections: outcomes.length, outcomes },
    };
  });

  return Promise.resolve();
};

function unauthorized(message: string): Error {
  const err = new Error(message);
  (err as { statusCode?: number }).statusCode = 401;
  (err as { code?: string }).code = 'UNAUTHORIZED';
  return err;
}

export default seoCronRoutes;