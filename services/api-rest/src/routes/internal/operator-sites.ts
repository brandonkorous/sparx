// Operator site (Property) surface (docs/apps/admin — user & site management).
// Cross-tenant reads of the site roster + one site's detail, and a bounded, audited
// status WRITE (pause / archive / reactivate). Same Layer-5 shared-secret auth as
// the other operator routes; the admin app is the capability gate (`site:read` /
// `site:act`) + the wize_admin audit writer.
//
// Reads run under `withSystem` (the properties_operator_read visibility policy);
// the status write runs under `withTenant({ tenantId })` (tenant_isolation +
// WITH CHECK) and stamps the tenant's own audit_logs as an operator action.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant } from '@sparx/db';
import type {
  OperatorSiteListResult,
  OperatorSiteDetail,
  OperatorSiteStatusResult,
} from '@sparx/operator';

import { authorizeOperator, badRequest, notFound, operatorIdOf } from './operator-internal.js';
import { listAllSites, siteDetail } from '../../lib/sites/service.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SITE_STATUSES = ['active', 'paused', 'archived'] as const;
const StatusSchema = z.object({ status: z.enum(SITE_STATUSES) });

const STATUS_ACTION: Record<(typeof SITE_STATUSES)[number], string> = {
  active: 'site.reactivated',
  paused: 'site.paused',
  archived: 'site.archived',
};

function clampLimit(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n)) return 50;
  return Math.min(200, Math.max(1, n));
}
function toOffset(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const operatorSiteRoutes: FastifyPluginAsync = async (app) => {
  const opts = { logLevel: 'warn' as const, schema: { hide: true } };

  app.get<{ Querystring: { q?: string; status?: string; limit?: string; offset?: string } }>(
    '/internal/operator/sites',
    opts,
    async (request) => {
      authorizeOperator(request);
      const result: OperatorSiteListResult = await listAllSites({
        q: request.query.q,
        status: request.query.status,
        limit: clampLimit(request.query.limit),
        offset: toOffset(request.query.offset),
      });
      return result;
    }
  );

  app.get<{ Params: { id: string } }>('/internal/operator/sites/:id', opts, async (request) => {
    authorizeOperator(request);
    const { id } = request.params;
    if (!UUID_RE.test(id)) throw badRequest('Invalid site id.');
    const detail: OperatorSiteDetail | null = await siteDetail(id);
    if (!detail) throw notFound('Site not found.');
    return detail;
  });

  // Pause / archive / reactivate a site (properties.status).
  app.patch<{ Params: { id: string } }>(
    '/internal/operator/sites/:id/status',
    opts,
    async (request) => {
      authorizeOperator(request);
      const { id } = request.params;
      if (!UUID_RE.test(id)) throw badRequest('Invalid site id.');
      const parsed = StatusSchema.safeParse(request.body);
      if (!parsed.success) throw badRequest('`status` must be active | paused | archived.');
      const { status } = parsed.data;
      const operatorId = operatorIdOf(request);

      // The property carries its tenant id; the write runs under that tenant's GUC.
      const site = await siteDetail(id);
      if (!site) throw notFound('Site not found.');

      if (site.status !== status) {
        await withTenant({ tenantId: site.tenantId }, async (tx) => {
          await tx.property.update({ where: { id }, data: { status } });
          await tx.auditLog.create({
            data: {
              tenantId: site.tenantId,
              actorId: operatorId,
              actorType: 'operator',
              action: STATUS_ACTION[status],
              entityType: 'property',
              entityId: id,
              diff: { before: { status: site.status }, after: { status } },
              ipAddress: null,
              userAgent: null,
            },
          });
        });
      }

      const result: OperatorSiteStatusResult = { status };
      return result;
    }
  );
};

export default operatorSiteRoutes;
