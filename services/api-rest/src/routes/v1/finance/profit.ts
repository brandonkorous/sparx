// Did we make money (docs/148 §5) — the headline surface's data.
//
//   GET  /v1/finance/profit          → figures for a range, plus the previous
//                                      period for comparison and a daily series
//   POST /v1/finance/profit/recompute → rebuild the rollup for a range
//
// The rollup is a CACHE of a subtraction, so recompute is safe to call at will —
// it re-reads revenue, cost of goods, fees and the ledger from their owners and
// overwrites. That is also why the read route can offer a `refresh` flag: an owner
// who just entered a bill expects the profit number to move.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@sparx/db';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { profitForRange, recomputeRange, utcMidnight } from '@sparx/finance';
import { requireFinanceModule, toFinanceContext } from '../../../lib/finance-context.js';
import { resolveListScopeIds } from '../../../lib/property.js';

const RangeQuery = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  property: z.string().optional(),
  /** Recompute before reading. The Profit surface sets this on manual refresh. */
  refresh: z.coerce.boolean().optional(),
  /** Include the day-by-day series for the chart. */
  series: z.coerce.boolean().optional(),
});

const RecomputeBody = z.object({ from: z.coerce.date(), to: z.coerce.date() });

/** The same span immediately before `from`, for the "vs last period" comparison.
 *  Derived from the requested range rather than assuming a month, so comparing
 *  a fortnight compares it against the previous fortnight. */
function previousRange(from: Date, to: Date): { from: Date; to: Date } {
  const span = utcMidnight(to).getTime() - utcMidnight(from).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const prevTo = new Date(utcMidnight(from).getTime() - dayMs);
  return { from: new Date(prevTo.getTime() - span), to: prevTo };
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; route registration is sync.
const financeProfitRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/finance/profit', async (request) => {
    await requireFinanceModule(request);
    const auth = requireRole(request, 'viewer');
    const { tenantId } = toFinanceContext(request);
    const query = RangeQuery.parse(request.query);

    const propertyIds = await resolveListScopeIds(
      auth,
      query.property,
      request.headers['x-sparx-property-id']
    );
    // One site ⇒ that site's figures; a wider scope ⇒ every site summed, which is
    // what an owner of two businesses wants from the all-sites view.
    const propertyId = propertyIds?.length === 1 ? propertyIds[0] : undefined;

    if (query.refresh) await recomputeRange(tenantId, query.from, query.to);

    const prev = previousRange(query.from, query.to);
    const [current, previous] = await Promise.all([
      profitForRange(tenantId, query.from, query.to, propertyId),
      profitForRange(tenantId, prev.from, prev.to, propertyId),
    ]);

    const series = query.series
      ? await prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
          const rows = await tx.rollupFinanceDailyProfit.findMany({
            where: {
              bucket: { gte: utcMidnight(query.from), lte: utcMidnight(query.to) },
              ...(propertyId !== undefined ? { propertyId } : {}),
            },
            orderBy: { bucket: 'asc' },
          });
          // Several sites can share a bucket when the scope is all-sites, so the
          // series folds by day rather than emitting one point per (site, day).
          const byDay = new Map<
            string,
            { bucket: Date; revenueCents: number; netProfitCents: number }
          >();
          for (const row of rows) {
            const key = row.bucket.toISOString().slice(0, 10);
            const at = byDay.get(key) ?? {
              bucket: row.bucket,
              revenueCents: 0,
              netProfitCents: 0,
            };
            at.revenueCents += Number(row.revenueCents);
            at.netProfitCents += Number(row.netProfitCents);
            byDay.set(key, at);
          }
          return [...byDay.values()];
        })
      : null;

    return ok({
      range: { from: query.from, to: query.to },
      current,
      previous,
      series,
    });
  });

  app.post('/v1/finance/profit/recompute', async (request) => {
    await requireFinanceModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toFinanceContext(request);
    const { from, to } = RecomputeBody.parse(request.body);
    const rows = await recomputeRange(tenantId, from, to);
    return ok({ recomputed: rows.length });
  });
};

export default financeProfitRoutes;
