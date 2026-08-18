// Finance — takings by channel (where the money comes from).
//
//   GET /v1/finance/channels[?from=&to=&property=]  → takings split by where the
//                                                     sale happened
//
// Aggregates orders (24-crm-orders) over a date range into one row per channel:
// the site's own storefront, the B2B portal, a marketplace (each marketplace slug
// kept distinct), in-person/admin, and imported sales. "Takings" is money
// actually received (amountPaid), with gross (order total) and refunds alongside
// so a channel that sells a lot but refunds a lot reads honestly. Gated on order
// access, site-scoped, defaults to the last 90 days.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { type Prisma } from '@wizeworks/db';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { withRequestTenant } from '@wizeworks/api-core/db';
import { requireOrderAccess } from '../../../lib/order-context.js';
import { resolveListScope } from '../../../lib/property.js';

const RangeQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  property: z.string().min(1).max(63).optional(),
});

const DEFAULT_WINDOW_MS = 90 * 86_400_000;

function num(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** The bucket a sale is counted under. A marketplace order keeps its specific
 *  marketplace (source) so "Etsy" and "Amazon" don't collapse into one row; every
 *  other channel is its own bucket. */
function channelKey(channel: string | null, source: string | null): string {
  if (channel === 'marketplace') return source ?? 'marketplace';
  return channel ?? 'other';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const financeChannelRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/finance/channels', async (request) => {
    const auth = requireRole(request, 'viewer');
    await requireOrderAccess(request);
    const q = RangeQuery.parse(request.query);
    const scope = await resolveListScope(auth, q.property, request.headers['x-sparx-property-id']);

    const to = q.to ? new Date(q.to) : new Date();
    const from = q.from ? new Date(q.from) : new Date(to.getTime() - DEFAULT_WINDOW_MS);

    const orders = await withRequestTenant(request, (tx) =>
      tx.order.findMany({
        where: {
          placedAt: { gte: from, lte: to },
          // Cancelled orders never took money — excluding them keeps "takings"
          // honest. Refunded orders stay in (their refund shows in its column).
          status: { not: 'cancelled' },
          ...(scope ? { propertyId: scope } : {}),
        },
        select: {
          channel: true,
          source: true,
          total: true,
          amountPaid: true,
          refundTotal: true,
        },
      })
    );

    const buckets = new Map<
      string,
      {
        key: string;
        channel: string | null;
        source: string | null;
        orders: number;
        gross: number;
        net: number;
        refunds: number;
      }
    >();

    for (const o of orders) {
      const key = channelKey(o.channel, o.source);
      const b = buckets.get(key) ?? {
        key,
        channel: o.channel,
        source: o.source,
        orders: 0,
        gross: 0,
        net: 0,
        refunds: 0,
      };
      b.orders += 1;
      b.gross = round2(b.gross + num(o.total));
      b.net = round2(b.net + num(o.amountPaid));
      b.refunds = round2(b.refunds + num(o.refundTotal));
      buckets.set(key, b);
    }

    const rows = [...buckets.values()].sort((a, b) => b.net - a.net);
    const totals = rows.reduce(
      (acc, r) => ({
        orders: acc.orders + r.orders,
        gross: round2(acc.gross + r.gross),
        net: round2(acc.net + r.net),
        refunds: round2(acc.refunds + r.refunds),
      }),
      { orders: 0, gross: 0, net: 0, refunds: 0 }
    );

    return ok({
      from: from.toISOString(),
      to: to.toISOString(),
      currency: 'USD',
      channels: rows,
      totals,
    });
  });

  return Promise.resolve();
};

export default financeChannelRoutes;
