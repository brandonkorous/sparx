// Partner Portal API (docs/114 §B.7/B.8) — the authed surface the dashboard
// Partner section consumes. Every route is scoped to the ACTIVE org (the JWT
// `tid`); the partner capability row is the gate.
//
// Authorization (docs/114 §B.7): operating the practice — overview earnings,
// referrals, commissions, payouts, tier, profile edits — is gated to the
// `PARTNER_OPS` capability set {owner, admin, partner} via `requireAnyRole` (NOT
// the coarse role hierarchy — `partner` is a lateral role). `profile` GET stays
// `viewer` because the dashboard shell reads it to learn whether the ORG is a
// partner (feeds the rail tile) for every member regardless of role. `apply` is
// owner/admin only and submits an APPLICATION for review — there is no automatic
// signup and no `partner` role to hold until staff approve and the org is a partner.
//
//   GET  /v1/partner/overview      GET/PUT /v1/partner/profile   POST /v1/partner/apply
//   GET  /v1/partner/application   POST /v1/partner/tier/apply   GET /v1/partner/referrals
//   GET  /v1/partner/commissions   GET /v1/partner/payouts

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { ok } from '@sparx/api-core/envelope';
import { requireRole, requireAnyRole, type StaffRole } from '@sparx/api-core/auth';
import { forbidden } from '@sparx/api-core/errors';

import { partnerService, toPartnerContext } from '../../../lib/partners/service.js';
import { startPayoutOnboarding } from '../../../lib/partners/payouts.js';

// The capability set allowed to operate a partner practice. `partner` is the
// delegated role a tenant can grant a teammate (docs/114 §B.7); owner/admin
// always qualify.
const PARTNER_OPS: readonly StaffRole[] = ['owner', 'admin', 'partner'];

const ConnectBody = z.object({ returnUrl: z.string().url(), refreshUrl: z.string().url() });

const partnerRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/partner/overview', async (request) => {
    requireAnyRole(request, PARTNER_OPS);
    const overview = await partnerService.overview(toPartnerContext(request));
    return ok(overview);
  });

  // `viewer` on purpose: the dashboard shell reads this for EVERY member to learn
  // whether the org is a partner (the rail tile + locked-state routing). It
  // returns the org's own public directory listing + referral code, not money.
  app.get('/v1/partner/profile', async (request) => {
    requireRole(request, 'viewer');
    const partner = await partnerService.get(toPartnerContext(request));
    return ok(partner);
  });

  app.put('/v1/partner/profile', async (request) => {
    requireAnyRole(request, PARTNER_OPS);
    const partner = await partnerService.updateProfile(toPartnerContext(request), request.body);
    return ok(partner);
  });

  // Apply to the program (owner/admin) — submits an application for staff review.
  // There is NO automatic signup at any tier; staff approval (admin app) is what
  // provisions the partner row.
  app.post('/v1/partner/apply', async (request) => {
    requireRole(request, 'admin');
    const result = await partnerService.apply(toPartnerContext(request), request.body);
    return ok(result);
  });

  // The tenant's own latest application status (owner/admin) — drives the apply vs
  // "under review" state on the join surface + the general-settings card.
  app.get('/v1/partner/application', async (request) => {
    const auth = requireRole(request, 'admin');
    const application = await partnerService.getMyApplication(auth.tenantId);
    return ok({ application });
  });

  app.post('/v1/partner/tier/apply', async (request) => {
    requireAnyRole(request, PARTNER_OPS);
    const result = await partnerService.applyTier(toPartnerContext(request), request.body);
    return ok(result);
  });

  app.get('/v1/partner/referrals', async (request) => {
    requireAnyRole(request, PARTNER_OPS);
    const ctx = toPartnerContext(request);
    const partner = await partnerService.get(ctx);
    if (!partner) throw forbidden('This account is not a partner.');
    const referrals = await partnerService.listReferrals(ctx);
    return ok({ referralCode: partner.referralCode, referrals });
  });

  app.get('/v1/partner/commissions', async (request) => {
    requireAnyRole(request, PARTNER_OPS);
    const commissions = await partnerService.listCommissions(toPartnerContext(request));
    return ok(commissions);
  });

  app.get('/v1/partner/payouts', async (request) => {
    requireAnyRole(request, PARTNER_OPS);
    const payouts = await partnerService.listPayouts(toPartnerContext(request));
    return ok(payouts);
  });

  // Start Stripe Connect payout onboarding — returns a hosted Account Link the
  // dashboard redirects to (Stripe-hosted-first, docs/114 §B.4).
  app.post('/v1/partner/payouts/connect', async (request) => {
    requireAnyRole(request, PARTNER_OPS);
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
