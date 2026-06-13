// Platform billing — read the tenant's plan state + open the Stripe Customer
// Portal (docs/67 §5). The portal IS the management UI: add/remove modules,
// switch interval, update card, download invoices, cancel. We expose only a
// read snapshot + a portal-session opener; no custom billing mutation surface.
//
//   GET  /v1/billing          → plan snapshot (status, trial, total, items)
//   POST /v1/billing/portal   → { url } Stripe Customer Portal session (admin)

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getBillingState, createPortalSession } from '@sparx/billing';
import { ok } from '@sparx/api-core/envelope';
import { requireAuth, requireRole } from '@sparx/api-core/auth';
import { badRequest } from '@sparx/api-core/errors';

const PortalBody = z.object({ returnUrl: z.string().url() });

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

  return Promise.resolve();
};

export default billingRoutes;
