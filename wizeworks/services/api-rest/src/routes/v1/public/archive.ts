// A site's published writing by month, for the archive block.
//
//   GET /v1/public/content/archive  ?tenant=<slug>[&property=][&year=2026]
//
// The years with something published, and one year's pieces month by month (the newest
// year when none is asked for). Published-only and site-scoped, like every public read.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant } from '@wizeworks/db';
import { ok } from '@wizeworks/api-core/envelope';

import { archiveMonths, archiveYears } from '../../../lib/archive.js';
import { publishedOnSite, siteKindsTx } from '../../../lib/author-roster.js';
import { resolvePublicPropertyId } from '../../../lib/property.js';
import { requireTenantIdBySlug } from '../../../lib/tenant-slug.js';

const Query = z.object({
  tenant: z.string().min(1).max(63),
  property: z.string().min(1).max(63).optional(),
  year: z.coerce.number().int().min(1900).max(3000).optional(),
});

/** A ceiling on how much one year reads, far past any journal's output. */
const YEAR_CAP = 2000;

const archiveRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/public/content/archive', async (request) => {
    const q = Query.parse(request.query);
    const tenantId = await requireTenantIdBySlug(q.tenant);
    const propertyId = await resolvePublicPropertyId(tenantId, q.property);
    const result = await withTenant({ tenantId }, async (tx) => {
      const [kinds, business] = await Promise.all([
        siteKindsTx(tx, propertyId),
        tx.tenantBusiness.findUnique({ where: { tenantId }, select: { timezone: true } }),
      ]);
      const timeZone = business?.timezone ?? 'UTC';
      const live = publishedOnSite(propertyId, kinds);
      const dates = await tx.contentEntry.findMany({
        where: live,
        select: { publishedAt: true },
      });
      const years = archiveYears(
        dates.flatMap((d) => (d.publishedAt ? [d.publishedAt] : [])),
        timeZone
      );
      const year = q.year ?? years[0]?.year ?? null;
      if (year === null) return { years, year: null, months: [] };
      // A day either side, so a piece out late on 31 December or early on 1 January
      // on the business's clock is read; `archiveMonths` places it exactly.
      const rows = await tx.contentEntry.findMany({
        where: {
          ...live,
          publishedAt: {
            gte: new Date(Date.UTC(year, 0, 1) - 86_400_000),
            lt: new Date(Date.UTC(year + 1, 0, 1) + 86_400_000),
          },
        },
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        take: YEAR_CAP,
        select: { typeKey: true, slug: true, body: true, publishedAt: true },
      });
      return { years, year, months: archiveMonths(rows, kinds, timeZone, year) };
    });
    return ok(result);
  });

  return Promise.resolve();
};

export default archiveRoutes;
