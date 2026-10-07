// Internal billing for the signup app — where a business pays the platform.
//
// The account app holds a Better Auth session, not an api-rest bearer token, so
// it cannot call /v1/billing/*. It checks the person's session and role itself,
// then asks here by tenant id with its service token (lib/internal-signup-token).
//
//   GET  /internal/tenant/billing?tenantId=…  → what the account page shows
//   POST /internal/tenant/billing/checkout    → { url } or { url: null, reason }
//   POST /internal/tenant/billing/portal      → { url } or { url: null }

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  createCheckoutSession,
  createPortalSession,
  heldDiscount,
  offerStanding,
  planFor,
} from '@wizeworks/billing';
import { prisma } from '@wizeworks/db';
import { ok } from '@wizeworks/api-core/envelope';

import { authorizeSignupApp } from '../../lib/internal-signup-token.js';

const TenantQuery = z.object({ tenantId: z.string().uuid() });
const SessionBody = z.object({
  tenantId: z.string().uuid(),
  /** Where Stripe sends the person back. The account app's own address. */
  returnUrl: z.string().url(),
});

function withMarker(returnUrl: string, status: 'success' | 'cancelled'): string {
  const u = new URL(returnUrl);
  u.searchParams.set('billing', status);
  return u.toString();
}

/** The account page's billing facts: a card on file, the discount it carries,
 *  and the offer a business without one would get today. */
async function billingSummary(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { billingPlan: true, stripeSubscriptionId: true, stripeCustomerId: true },
  });
  if (!tenant) return null;
  const plan = planFor(tenant.billingPlan);
  const subscribed = Boolean(tenant.stripeSubscriptionId);
  return {
    subscribed,
    canManage: Boolean(tenant.stripeCustomerId) && subscribed,
    baseMonthlyCents: plan.base?.monthlyCents ?? null,
    discount: await heldDiscount(plan, tenant.stripeSubscriptionId),
    offer: subscribed ? null : await offerStanding(plan),
  };
}

const tenantBillingRoutes: FastifyPluginAsync = (app) => {
  app.get('/internal/tenant/billing', async (request) => {
    authorizeSignupApp(request);
    const { tenantId } = TenantQuery.parse(request.query);
    return ok({ billing: await billingSummary(tenantId) });
  });

  app.post('/internal/tenant/billing/checkout', async (request) => {
    authorizeSignupApp(request);
    const { tenantId, returnUrl } = SessionBody.parse(request.body);
    const result = await createCheckoutSession(tenantId, {
      successUrl: withMarker(returnUrl, 'success'),
      cancelUrl: withMarker(returnUrl, 'cancelled'),
    });
    return ok(result);
  });

  app.post('/internal/tenant/billing/portal', async (request) => {
    authorizeSignupApp(request);
    const { tenantId, returnUrl } = SessionBody.parse(request.body);
    return ok({ url: await createPortalSession(tenantId, returnUrl) });
  });

  return Promise.resolve();
};

export default tenantBillingRoutes;
