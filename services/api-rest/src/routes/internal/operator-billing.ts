// Operator billing-ops endpoints (docs/apps/admin/build-plan.md §5 Slice 4). The
// cross-tenant billing surface — failed-payment queue, coupons, the Stripe event
// log, per-tenant charges, refunds, and enterprise invoices — all through the
// existing `@sparx/billing` substrate (the platform Stripe account), never a
// parallel engine. Same Layer-5 shared-secret auth as the other operator routes;
// the admin app is the capability gate (billing:read / billing:act) + audit writer.
//
// Reads degrade to empty when platform Stripe is unconfigured; writes surface a
// clear BILLING_NOT_CONFIGURED error rather than pretending to move money.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@sparx/db';
import {
  listPlatformStripeEvents,
  listTenantCharges,
  listPlatformCoupons,
  createPlatformCoupon,
  deletePlatformCoupon,
  refundCharge,
  createEnterpriseInvoice,
  getBillingState,
} from '@sparx/billing';
import type { OperatorTenantBillingView } from '@sparx/operator';

import { authorizeOperator, badRequest, notFound } from './operator-internal.js';
import { TENANT_LIST_SELECT, toTenantListItem } from './operator.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RefundSchema = z.object({
  chargeId: z.string().min(1),
  amountCents: z.number().int().positive().optional(),
  reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']).optional(),
});

const CouponSchema = z
  .object({
    name: z.string().min(1).max(200),
    percentOff: z.number().positive().max(100).optional(),
    amountOffCents: z.number().int().positive().optional(),
    currency: z.string().length(3).optional(),
    duration: z.enum(['forever', 'once', 'repeating']),
    durationInMonths: z.number().int().positive().max(60).optional(),
  })
  .refine((d) => d.percentOff !== undefined || d.amountOffCents !== undefined, {
    message: 'Provide percentOff or amountOffCents.',
  });

const InvoiceSchema = z.object({
  tenantId: z.string().uuid(),
  lines: z
    .array(z.object({ description: z.string().min(1).max(500), amountCents: z.number().int() }))
    .min(1),
  daysUntilDue: z.number().int().positive().max(365).optional(),
  memo: z.string().max(2000).optional(),
  autoFinalize: z.boolean(),
});

function parseLimit(raw: string | undefined, fallback: number, max: number): number {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(1, n));
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const operatorBillingRoutes: FastifyPluginAsync = async (app) => {
  const opts = { logLevel: 'warn' as const, schema: { hide: true } };

  // Failed-payment queue — tenants whose platform subscription is past_due/unpaid.
  app.get('/internal/operator/billing/failed-payments', opts, async (request) => {
    authorizeOperator(request);
    const rows = await prisma.tenant.findMany({
      where: { subscriptionStatus: { in: ['past_due', 'unpaid'] } },
      orderBy: { currentPeriodEnd: 'asc' },
      select: TENANT_LIST_SELECT,
    });
    return rows.map(toTenantListItem);
  });

  // Platform Stripe event log (webhook viewer) — reads Stripe's feed directly.
  app.get<{ Querystring: { limit?: string } }>(
    '/internal/operator/billing/events',
    opts,
    async (request) => {
      authorizeOperator(request);
      return listPlatformStripeEvents(parseLimit(request.query.limit, 25, 100));
    }
  );

  // Coupons — list / create / delete.
  app.get('/internal/operator/billing/coupons', opts, async (request) => {
    authorizeOperator(request);
    return listPlatformCoupons();
  });

  app.post('/internal/operator/billing/coupons', opts, async (request) => {
    authorizeOperator(request);
    const parsed = CouponSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? 'Invalid coupon.');
    return createPlatformCoupon(parsed.data);
  });

  app.delete<{ Params: { id: string } }>(
    '/internal/operator/billing/coupons/:id',
    opts,
    async (request, reply) => {
      authorizeOperator(request);
      if (!request.params.id) throw badRequest('Missing coupon id.');
      await deletePlatformCoupon(request.params.id);
      return reply.code(204).send();
    }
  );

  // Refund a platform charge.
  app.post('/internal/operator/billing/refund', opts, async (request) => {
    authorizeOperator(request);
    const parsed = RefundSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? 'Invalid refund.');
    return refundCharge(parsed.data);
  });

  // Author (optionally finalize) an enterprise invoice for a tenant.
  app.post('/internal/operator/billing/invoice', opts, async (request) => {
    authorizeOperator(request);
    const parsed = InvoiceSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? 'Invalid invoice.');
    const tenant = await prisma.tenant.findUnique({
      where: { id: parsed.data.tenantId },
      select: { stripeCustomerId: true },
    });
    if (!tenant) throw notFound('Tenant not found.');
    if (!tenant.stripeCustomerId) {
      throw badRequest('Tenant has no platform Stripe customer yet — no billing relationship.');
    }
    return createEnterpriseInvoice({
      customerId: tenant.stripeCustomerId,
      lines: parsed.data.lines,
      daysUntilDue: parsed.data.daysUntilDue,
      memo: parsed.data.memo,
      autoFinalize: parsed.data.autoFinalize,
    });
  });

  // A tenant's platform-billing view: subscription snapshot + recent charges.
  app.get<{ Params: { id: string } }>(
    '/internal/operator/tenants/:id/billing',
    opts,
    async (request) => {
      authorizeOperator(request);
      const { id } = request.params;
      if (!UUID_RE.test(id)) throw badRequest('Invalid tenant id.');
      const tenant = await prisma.tenant.findUnique({
        where: { id },
        select: { name: true, stripeCustomerId: true },
      });
      if (!tenant) throw notFound('Tenant not found.');
      const [billing, charges] = await Promise.all([
        getBillingState(id),
        tenant.stripeCustomerId ? listTenantCharges(tenant.stripeCustomerId) : Promise.resolve([]),
      ]);
      const view: OperatorTenantBillingView = {
        tenantId: id,
        name: tenant.name,
        hasStripeCustomer: Boolean(tenant.stripeCustomerId),
        billing,
        charges,
      };
      return view;
    }
  );
};

export default operatorBillingRoutes;
