// Sparx Pay managed-Connect routes (docs/92 §B-G2). Thin launchers for Stripe's
// hosted flows — the dashboard "Set up Sparx Pay" / "Manage payouts" buttons call
// these and redirect to Stripe; we never render onboarding or account-management UI.
//
//   POST /v1/commerce/sparx-pay/onboard         { installationId, returnUrl, refreshUrl } → { url }
//   GET  /v1/commerce/sparx-pay/status          ?installationId= → live account status
//   POST /v1/commerce/sparx-pay/dashboard-link  { installationId } → Express dashboard URL

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';

import { requireCommerceModule, toCommerceContext } from '../../../lib/commerce-context.js';
import { dashboardLink, refreshStatus, startOnboarding } from '../../../lib/sparx-pay-connect.js';

const OnboardBody = z.object({
  installationId: z.string().uuid(),
  returnUrl: z.string().url(),
  refreshUrl: z.string().url(),
});
const InstallationQuery = z.object({ installationId: z.string().uuid() });
const DashboardBody = z.object({ installationId: z.string().uuid() });

const sparxPayRoutes: FastifyPluginAsync = async (app) => {
  // Create-or-resume the connected account and return a hosted-onboarding URL.
  app.post('/v1/commerce/sparx-pay/onboard', async (request) => {
    requireRole(request, 'admin');
    await requireCommerceModule(request);
    const body = OnboardBody.parse(request.body);
    const ctx = toCommerceContext(request);
    return ok(await startOnboarding({ tenantId: ctx.tenantId, ...body }));
  });

  // Live onboarding/charge status, synced back onto the install.
  app.get('/v1/commerce/sparx-pay/status', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const { installationId } = InstallationQuery.parse(request.query);
    const ctx = toCommerceContext(request);
    return ok(await refreshStatus(ctx.tenantId, installationId));
  });

  // Single-use link into the Stripe-hosted Express dashboard.
  app.post('/v1/commerce/sparx-pay/dashboard-link', async (request) => {
    requireRole(request, 'admin');
    await requireCommerceModule(request);
    const { installationId } = DashboardBody.parse(request.body);
    const ctx = toCommerceContext(request);
    return ok({ url: await dashboardLink(ctx.tenantId, installationId) });
  });

  return Promise.resolve();
};

export default sparxPayRoutes;
