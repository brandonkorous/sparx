// Payments configuration + sparx Pay onboarding (docs/94 ADR §9, §13). The dashboard's
// Settings → Payments surface: read the active gateway + onboarding status, pick a
// gateway, and launch Stripe's hosted Connect flows. Thin launchers — we never render
// onboarding or account-management UI (Stripe-hosted-first).
//
//   GET  /v1/commerce/payments/config                  → gateway + onboarding status
//   POST /v1/commerce/payments/gateway                 { gatewayId }
//   POST /v1/commerce/payments/sparx-pay/onboard       { returnUrl, refreshUrl } → { url }
//   GET  /v1/commerce/payments/sparx-pay/status        → live account status (synced)
//   POST /v1/commerce/payments/sparx-pay/dashboard-link → Express dashboard URL
//   GET  /v1/commerce/payments/sparx-pay/balance       → connected-account balance

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';

import { requireCommerceModule, toCommerceContext } from '../../../lib/commerce-context.js';
import {
  PAYMENT_GATEWAYS,
  getPaymentConfig,
  getSparxPayBalance,
  refreshSparxPayStatus,
  selectGateway,
  sparxPayDashboardLink,
  startSparxPayOnboarding,
} from '../../../lib/payments-onboarding.js';

const GatewayBody = z.object({ gatewayId: z.enum(PAYMENT_GATEWAYS) });
const OnboardBody = z.object({
  returnUrl: z.string().url(),
  refreshUrl: z.string().url(),
});

const paymentsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/commerce/payments/config', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const ctx = toCommerceContext(request);
    return ok(await getPaymentConfig(ctx.tenantId));
  });

  app.post('/v1/commerce/payments/gateway', async (request) => {
    requireRole(request, 'admin');
    await requireCommerceModule(request);
    const { gatewayId } = GatewayBody.parse(request.body);
    const ctx = toCommerceContext(request);
    return ok(await selectGateway(ctx.tenantId, gatewayId));
  });

  // Create-or-resume the connected account and return a hosted-onboarding URL.
  app.post('/v1/commerce/payments/sparx-pay/onboard', async (request) => {
    requireRole(request, 'admin');
    await requireCommerceModule(request);
    const body = OnboardBody.parse(request.body);
    const ctx = toCommerceContext(request);
    return ok(await startSparxPayOnboarding({ tenantId: ctx.tenantId, ...body }));
  });

  // Live onboarding/charge status, synced back onto the config.
  app.get('/v1/commerce/payments/sparx-pay/status', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const ctx = toCommerceContext(request);
    return ok(await refreshSparxPayStatus(ctx.tenantId));
  });

  // Single-use link into the Stripe-hosted Express dashboard.
  app.post('/v1/commerce/payments/sparx-pay/dashboard-link', async (request) => {
    requireRole(request, 'admin');
    await requireCommerceModule(request);
    const ctx = toCommerceContext(request);
    return ok({ url: await sparxPayDashboardLink(ctx.tenantId) });
  });

  // Connected-account balance (available + pending) for the Finance Overview/Payouts.
  // Null when sparx Pay isn't onboarded or the platform key is unset (clean dev no-op).
  app.get('/v1/commerce/payments/sparx-pay/balance', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const ctx = toCommerceContext(request);
    return ok(await getSparxPayBalance(ctx.tenantId));
  });

  return Promise.resolve();
};

export default paymentsRoutes;
