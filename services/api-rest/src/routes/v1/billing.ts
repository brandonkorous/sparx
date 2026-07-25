// Platform billing — read the tenant's plan state, open the Stripe Customer Portal,
// or open a Checkout Session to set up billing (docs/67 §5). The portal is the
// MANAGE surface (update card, switch plan, download invoices, cancel) once a
// subscription exists; Checkout is the SET-UP surface that births the subscription
// and where the tenant redeems a discount code. We expose a read snapshot + the two
// hosted-session openers; no custom billing mutation surface.
//
//   GET  /v1/billing          → plan snapshot (status, trial, total, items)
//   POST /v1/billing/portal   → { url } Stripe Customer Portal session (admin)
//   POST /v1/billing/checkout → { url } Stripe Checkout Session, promo box on (admin)

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getBillingState, createPortalSession, createCheckoutSession } from '@sparx/billing';
import { ok } from '@sparx/api-core/envelope';
import { requireAuth, requireRole } from '@sparx/api-core/auth';
import { badRequest } from '@sparx/api-core/errors';

const PortalBody = z.object({ returnUrl: z.string().url() });

/** Where Stripe sends the tenant back after Checkout: the workbench root, deep-
 *  linked to the subscription surface (`?open=finance.subscription`) with a status
 *  marker the surface reads to show a confirmation + refresh the bill. The dock
 *  strips only `open` on boot, so `billing` survives for the surface. */
function checkoutReturnUrl(returnUrl: string, status: 'success' | 'cancelled'): string {
  try {
    const u = new URL(returnUrl);
    u.searchParams.set('open', 'finance.subscription');
    u.searchParams.set('billing', status);
    return u.toString();
  } catch {
    const sep = returnUrl.includes('?') ? '&' : '?';
    return `${returnUrl}${sep}open=finance.subscription&billing=${status}`;
  }
}

const CHECKOUT_MESSAGES: Record<'unconfigured' | 'no_paid_modules' | 'already_active', string> = {
  unconfigured: 'Billing is not set up yet — this environment has no payment provider configured.',
  no_paid_modules:
    'Turn on a paid feature first — there’s nothing to bill for until at least one paid module is active.',
  already_active:
    'You already have a subscription. Use “Manage billing & card” to update your card or plan.',
};

const billingRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/billing', async (request) => {
    const auth = requireAuth(request);
    return ok(await getBillingState(auth.tenantId));
  });

  app.post('/v1/billing/portal', async (request) => {
    const auth = requireRole(request, 'admin');
    const { returnUrl } = PortalBody.parse(request.body);
    const url = await createPortalSession(auth.tenantId, returnUrl);
    if (!url) {
      throw badRequest(
        'Billing is not set up yet — a Stripe customer is created the first time you activate a paid module while billing is configured.'
      );
    }
    return ok({ url });
  });

  app.post('/v1/billing/checkout', async (request) => {
    const auth = requireRole(request, 'admin');
    const { returnUrl } = PortalBody.parse(request.body);
    const result = await createCheckoutSession(auth.tenantId, {
      successUrl: checkoutReturnUrl(returnUrl, 'success'),
      cancelUrl: checkoutReturnUrl(returnUrl, 'cancelled'),
    });
    if (result.url === null) throw badRequest(CHECKOUT_MESSAGES[result.reason]);
    return ok({ url: result.url });
  });

  return Promise.resolve();
};

export default billingRoutes;
