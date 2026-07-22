// Finance — the payments ledger.
//
//   GET /v1/finance/payments  → every payment recorded against an order, newest
//                               first, including the ones that FAILED or were
//                               REFUNDED. This is the money-in flagship: a flat,
//                               searchable feed of what customers actually paid.
//
// Reads the shared OrderPayment ledger (26-crm-order-payments) joined to its
// order + customer. Gated on order access (Commerce OR B2B OR CRM) rather than a
// standalone `finance` module — finance is a lens over money the selling modules
// already produced, not a separately-billed capability. Site-scoped like every
// other list: absent `?property` means the active site (x-sparx-property-id).

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { type Prisma } from '@sparx/db';
import { paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { withRequestTenant } from '@sparx/api-core/db';
import { requireOrderAccess } from '../../../lib/order-context.js';
import { resolveListScope } from '../../../lib/property.js';

// The OrderPayment.status vocabulary, plus 'all'. `captured` is money in the
// bank; `failed` and `refunded` are the two an owner scans for first, so both are
// first-class filters rather than buried under "everything".
const STATUS_VALUES = [
  'all',
  'captured',
  'authorized',
  'pending',
  'failed',
  'voided',
  'refunded',
] as const;

const ListQuery = z.object({
  q: z.string().max(255).optional(),
  status: z.enum(STATUS_VALUES).optional(),
  // The processor bucket — stripe | paypal | manual | check | wire | net_terms.
  method: z.string().max(63).optional(),
  property: z.string().min(1).max(63).optional(),
  sort_by: z.enum(['createdAt', 'amount']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

function num(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** The first of several candidates that is a non-empty string, else null. A
 *  customer may have a blank name but a company, or neither but an email. */
function firstNonEmpty(...values: (string | null | undefined)[]): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

const financePaymentRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/finance/payments', async (request) => {
    const auth = requireRole(request, 'viewer');
    await requireOrderAccess(request);
    const q = ListQuery.parse(request.query);
    const scope = await resolveListScope(auth, q.property, request.headers['x-sparx-property-id']);

    const take = q.take ?? 50;
    const skip = q.skip ?? 0;
    const needle = q.q?.trim();

    // The order gate: only payments whose order is in scope. A null-origin
    // (legacy/import) order has no site, so it appears only in the all-sites view.
    const orderWhere: Prisma.OrderWhereInput = {
      ...(scope ? { propertyId: scope } : {}),
      ...(needle
        ? {
            OR: [
              { orderNumber: { contains: needle, mode: 'insensitive' } },
              {
                customer: {
                  OR: [
                    { firstName: { contains: needle, mode: 'insensitive' } },
                    { lastName: { contains: needle, mode: 'insensitive' } },
                    { company: { contains: needle, mode: 'insensitive' } },
                    { email: { contains: needle, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const where: Prisma.OrderPaymentWhereInput = {
      ...(q.status && q.status !== 'all' ? { status: q.status } : {}),
      ...(q.method ? { processor: q.method } : {}),
      order: orderWhere,
    };

    const orderBy: Prisma.OrderPaymentOrderByWithRelationInput =
      q.sort_by === 'amount' ? { amount: q.order ?? 'desc' } : { createdAt: q.order ?? 'desc' };

    const { rows, total, refundByPayment } = await withRequestTenant(request, async (tx) => {
      const [rows, total] = await Promise.all([
        tx.orderPayment.findMany({
          where,
          orderBy,
          take,
          skip,
          select: {
            id: true,
            processor: true,
            processorRef: true,
            amount: true,
            currency: true,
            status: true,
            failureReason: true,
            capturedAt: true,
            createdAt: true,
            order: {
              select: {
                id: true,
                orderNumber: true,
                channel: true,
                source: true,
                customer: {
                  select: { firstName: true, lastName: true, company: true, email: true },
                },
              },
            },
          },
        }),
        tx.orderPayment.count({ where }),
      ]);

      // How much of each shown payment was later refunded — so a refund reads as a
      // real amount ("−$40.00 of $120.00"), not just a status word.
      const ids = rows.map((r) => r.id);
      const refundGroups = ids.length
        ? await tx.orderRefund.groupBy({
            by: ['paymentId'],
            where: { paymentId: { in: ids }, status: { not: 'failed' } },
            _sum: { amount: true },
          })
        : [];
      const refundByPayment = new Map<string, number>();
      for (const g of refundGroups) {
        if (g.paymentId) refundByPayment.set(g.paymentId, num(g._sum.amount));
      }
      return { rows, total, refundByPayment };
    });

    const items = rows.map((r) => {
      const c = r.order?.customer;
      const name = firstNonEmpty(
        [c?.firstName, c?.lastName].filter(Boolean).join(' '),
        c?.company,
        c?.email
      );
      return {
        id: r.id,
        orderId: r.order?.id ?? null,
        orderNumber: r.order?.orderNumber ?? null,
        customerName: name,
        customerEmail: c?.email ?? null,
        processor: r.processor,
        processorRef: r.processorRef,
        amount: num(r.amount),
        refundedAmount: refundByPayment.get(r.id) ?? 0,
        currency: r.currency,
        status: r.status,
        failureReason: r.failureReason,
        channel: r.order?.channel ?? null,
        source: r.order?.source ?? null,
        capturedAt: r.capturedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      };
    });

    return paged(items, { total, per_page: take });
  });

  return Promise.resolve();
};

export default financePaymentRoutes;
