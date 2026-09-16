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
import { type Prisma } from '@wizeworks/db';
import { paged } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { withRequestTenant } from '@wizeworks/api-core/db';
import { requireOrderAccess } from '../../../lib/order-context.js';
import { resolveListScope } from '../../../lib/property.js';
import { paymentListFilter } from '../../../lib/payment-filter.js';

// The OrderPayment.status vocabulary, plus 'all'. `captured` is money in the
// bank; `failed` and `refunded` are the two an owner scans for first, so both are
// first-class filters rather than buried under "everything".
//
// `refunded` is the odd one out: it is a status WORD nothing writes, so it is
// handled below as a question about the money instead. See the `where` builder.
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

/** Money, to the cent — apportioning refunds must not leak a fraction. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

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
                    { companyName: { contains: needle, mode: 'insensitive' } },
                    { email: { contains: needle, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    // `refunded` asks the MONEY, not the status word — see `paymentListFilter`
    // for why, and for the guard that holds it. The order-level part of that
    // question can include a payment whose own apportioned share is zero, on an
    // order with SEVERAL captured payments and a partial refund; the share is
    // computed below, after the query, so it cannot be filtered on. 27 of 29
    // orders here have exactly one payment and no refunded order has more than
    // one. Stated rather than hidden.
    const filter = paymentListFilter(q.status);
    const where: Prisma.OrderPaymentWhereInput = {
      ...(filter.statuses ? { status: { in: filter.statuses } } : {}),
      ...(q.method ? { processor: q.method } : {}),
      order: filter.requireOrderRefund ? { ...orderWhere, refundTotal: { gt: 0 } } : orderWhere,
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
                  select: { firstName: true, lastName: true, companyName: true, email: true },
                },
              },
            },
          },
        }),
        tx.orderPayment.count({ where }),
      ]);

      // How much of each shown payment was later refunded — so a refund reads as a
      // real amount ("−$40.00 of $120.00"), not just a status word.
      //
      // READ BY ORDER, NOT BY PAYMENT. `orderRefund.paymentId` is NULLABLE and
      // most refunds have none: the order-refund button records the charge it
      // reversed, but a refund raised by the RETURNS flow is against the order
      // and has no single payment to name. Grouping on `paymentId` therefore
      // dropped every one of those silently — 10 of 12 refunds on this platform,
      // $7,767 of $8,316. One shop's screen said a customer had $128 back when
      // $170 had gone back, and said another had nothing back when $42 had.
      //
      // The order's own `refundTotal` has always been right, because the rollup
      // that maintains it (`recomputeOrderPaymentRollup`) reads refunds BY ORDER
      // at a documented chokepoint. This is the second place that answered the
      // same question, and it answered it worse.
      const orderIds = [...new Set(rows.map((r) => r.order?.id).filter((id) => id !== undefined))];
      const refunds = orderIds.length
        ? await tx.orderRefund.findMany({
            where: { orderId: { in: orderIds }, status: { not: 'failed' } },
            select: { orderId: true, paymentId: true, amount: true },
          })
        : [];

      // A refund that names its payment belongs to that payment. One that does
      // not belongs to the ORDER, so it comes off that order's payments in the
      // order they were taken, each capped at its own amount — never inventing a
      // link, never attributing more back than came in. 27 of 29 orders here have
      // exactly one payment, where this is simply "all of it".
      const refundByPayment = new Map<string, number>();
      const unlinkedByOrder = new Map<string, number>();
      for (const r of refunds) {
        const amount = num(r.amount);
        if (r.paymentId) {
          refundByPayment.set(r.paymentId, (refundByPayment.get(r.paymentId) ?? 0) + amount);
        } else {
          unlinkedByOrder.set(r.orderId, (unlinkedByOrder.get(r.orderId) ?? 0) + amount);
        }
      }
      if (unlinkedByOrder.size > 0) {
        // Every payment on the affected orders, oldest first — including any not
        // on this page, so a payment's share does not change with pagination.
        const funding = await tx.orderPayment.findMany({
          where: { orderId: { in: [...unlinkedByOrder.keys()] }, status: 'captured' },
          select: { id: true, orderId: true, amount: true },
          orderBy: [{ capturedAt: 'asc' }, { createdAt: 'asc' }],
        });
        for (const p of funding) {
          const left = unlinkedByOrder.get(p.orderId) ?? 0;
          if (left <= 0) continue;
          const already = refundByPayment.get(p.id) ?? 0;
          const room = Math.max(0, num(p.amount) - already);
          const take = Math.min(room, left);
          if (take > 0) {
            refundByPayment.set(p.id, round2(already + take));
            unlinkedByOrder.set(p.orderId, round2(left - take));
          }
        }
      }
      return { rows, total, refundByPayment };
    });

    const items = rows.map((r) => {
      const c = r.order?.customer;
      const name = firstNonEmpty(
        [c?.firstName, c?.lastName].filter(Boolean).join(' '),
        c?.companyName,
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
