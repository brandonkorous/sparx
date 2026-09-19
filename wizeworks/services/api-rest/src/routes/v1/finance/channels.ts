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
//
// `owed` completes the arithmetic, and is the reason it exists. Gross, refunds
// and net were returned without it, and they do not reconcile: one real shop
// read $2,140.50 sold, $212.00 refunded and $325.00 received, and the $1,603.50
// between them — seven orders nobody had paid for, three quarters of the
// channel — was in none of the numbers. A reader who subtracts refunds from
// sales and does not get the received figure is left to guess at the biggest
// number on the screen.
//
//     gross − refunds − owed = net
//
// Clamped per order rather than on the total: an overpaid order would otherwise
// cancel out another order's debt, and "someone paid us twice" is not the same
// fact as "someone has paid".

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { withRequestTenant } from '@wizeworks/api-core/db';
import { requireOrderAccess } from '../../../lib/order-context.js';
import { resolveListScope } from '../../../lib/property.js';
import { foldChannels } from './channels-fold.js';

const RangeQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  property: z.string().min(1).max(63).optional(),
});

const DEFAULT_WINDOW_MS = 90 * 86_400_000;

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

    const { rows, totals } = foldChannels(orders);

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
