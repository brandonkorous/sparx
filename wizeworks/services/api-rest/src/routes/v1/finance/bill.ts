// Finance — your sparx bill (the one payment that goes OUT, to WizeWorks).
//
//   GET /v1/finance/bill  → the tenant's platform subscription: which modules
//                           make up the charge, the total, the renewal, and the
//                           card it comes off.
//
// This is deliberately its OWN endpoint rather than a reuse of GET /v1/billing:
// the finance surface needs the module breakdown AND the card on file in one
// round trip, and the card requires a Stripe read that the plain billing snapshot
// (which never calls Stripe) does not make. Managing the card/subscription is
// still POST /v1/billing/portal — Stripe's hosted portal is the only place a card
// is edited. Auth-gated only: a tenant's own bill is not a module capability.

import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@wizeworks/db';
import { getBillingState, getBillingStripe, planFor } from '@wizeworks/billing';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';

interface CardOnFile {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

/** The default card on the tenant's Stripe customer, or null. Null covers every
 *  "no card to show" case — Stripe unconfigured (dev/pre-launch), no customer
 *  yet, no default method, or a transient Stripe error — because the surface
 *  treats them identically: it points at the portal to add one. */
async function readDefaultCard(tenantId: string): Promise<CardOnFile | null> {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { stripeCustomerId: true, billingPlan: true },
    });
    if (!tenant?.stripeCustomerId) return null;
    // The customer lives in the account its PLAN names — reading it from the default
    // account would 404 for a tenant billing anywhere else.
    const stripe = getBillingStripe(planFor(tenant.billingPlan));
    if (!stripe) return null;
    const customer = await stripe.customers.retrieve(tenant.stripeCustomerId, {
      expand: ['invoice_settings.default_payment_method'],
    });
    if ((customer as { deleted?: boolean }).deleted) return null;
    const pm = (customer as { invoice_settings?: { default_payment_method?: unknown } })
      .invoice_settings?.default_payment_method;
    if (!pm || typeof pm === 'string') return null;
    const card = (
      pm as { card?: { brand?: string; last4?: string; exp_month?: number; exp_year?: number } }
    ).card;
    if (!card?.last4) return null;
    return {
      brand: card.brand ?? 'card',
      last4: card.last4,
      expMonth: card.exp_month ?? 0,
      expYear: card.exp_year ?? 0,
    };
  } catch {
    return null;
  }
}

const financeBillRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/finance/bill', async (request) => {
    const auth = requireRole(request, 'viewer');
    const [state, card] = await Promise.all([
      getBillingState(auth.tenantId),
      readDefaultCard(auth.tenantId),
    ]);
    return ok({ ...state, card });
  });

  return Promise.resolve();
};

export default financeBillRoutes;
