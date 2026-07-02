// Partner Portal API (docs/114 §B.7/B.8) — the authed surface the dashboard
// Partner section consumes. Every route is scoped to the ACTIVE org (the JWT
// `tid`); the partner capability row is the gate. Reads need `viewer`; the
// partner relationship writes need `admin` (commissions/payouts are money).
//
//   GET  /v1/partner/overview      GET/PUT /v1/partner/profile   POST /v1/partner/join
//   POST /v1/partner/tier/apply    GET /v1/partner/referrals
//   GET  /v1/partner/commissions   GET /v1/partner/payouts

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { forbidden } from '@sparx/api-core/errors';

import { partnerService, toPartnerContext } from '../../../lib/partners/service.js';
import { startPayoutOnboarding } from '../../../lib/partners/payouts.js';

const ConnectBody = z.object({ returnUrl: z.string().url(), refreshUrl: z.string().url() });

const partnerRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/partner/overview', async (request) => {
    requireRole(request, 'viewer');
    const overview = await partnerService.overview(toPartnerContext(request));
    return ok(overview);
  });

  app.get('/v1/partner/profile', async (request) => {
    requireRole(request, 'viewer');
    const partner = await partnerService.get(toPartnerContext(request));
    return ok(partner);
  });

  app.put('/v1/partner/profile', async (request) => {
    requireRole(request, 'admin');
    const partner = await partnerService.updateProfile(toPartnerContext(request), request.body);
    return ok(partner);
  });

  app.post('/v1/partner/join', async (request) => {
    requireRole(request, 'admin');
    const partner = await partnerService.join(toPartnerContext(request), request.body);
    return ok(partner);
  });

  app.post('/v1/partner/tier/apply', async (request) => {
    requireRole(request, 'admin');
    const result = await partnerService.applyTier(toPartnerContext(request), request.body);
    return ok(result);
  });

  app.get('/v1/partner/referrals', async (request) => {
    requireRole(request, 'viewer');
    const ctx = toPartnerContext(request);
    const partner = await partnerService.get(ctx);
    if (!partner) throw forbidden('This account is not a partner.');
    const referrals = await partnerService.listReferrals(ctx);
    return ok({ referralCode: partner.referralCode, referrals });
  });

  app.get('/v1/partner/commissions', async (request) => {
    requireRole(request, 'admin');
    const commissions = await partnerService.listCommissions(toPartnerContext(request));
    return ok(commissions);
  });

  app.get('/v1/partner/payouts', async (request) => {
    requireRole(request, 'admin');
    const payouts = await partnerService.listPayouts(toPartnerContext(request));
    return ok(payouts);
  });

  // Start Stripe Connect payout onboarding — returns a hosted Account Link the
  // dashboard redirects to (Stripe-hosted-first, docs/114 §B.4).
  app.post('/v1/partner/payouts/connect', async (request) => {
    requireRole(request, 'admin');
    const ctx = toPartnerContext(request);
    const partner = await partnerService.get(ctx);
    if (!partner) throw forbidden('This account is not a partner.');
    const body = ConnectBody.parse(request.body);
    const result = await startPayoutOnboarding({
      partnerTenantId: ctx.tenantId,
      returnUrl: body.returnUrl,
      refreshUrl: body.refreshUrl,
    });
    return ok(result);
  });

  return Promise.resolve();
};

export default partnerRoutes;
