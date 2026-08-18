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

import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { badRequest } from '@wizeworks/api-core/errors';
import { GATEWAY_CATALOG } from '@wizeworks/payments';

import { requireCommerceModule, toCommerceContext } from '../../../lib/commerce-context.js';
import {
  PAYMENT_GATEWAYS,
  activateGatewayIfSelected,
  getPaymentConfig,
  getSparxPayBalance,
  refreshSparxPayStatus,
  selectGateway,
  sparxPayDashboardLink,
  startSparxPayOnboarding,
} from '../../../lib/payments-onboarding.js';
import {
  GatewayCredentialError,
  captureGatewayCredentials,
  deleteGatewayCredentials,
  listGatewayCredentials,
} from '../../../lib/gateway-credentials.js';

const GatewayBody = z.object({ gatewayId: z.enum(PAYMENT_GATEWAYS) });
const OnboardBody = z.object({
  returnUrl: z.string().url(),
  refreshUrl: z.string().url(),
});
const CredentialBody = z.object({
  gatewayId: z.string().min(1),
  environment: z.enum(['sandbox', 'production']),
  fields: z.record(z.string(), z.string()),
});
const GatewayParams = z.object({ gatewayId: z.string().min(1) });

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

  // ── Bring-your-own gateways (docs/111) ─────────────────────────────────────────

  // The gateway catalog — the data-driven list the dashboard renders cards + forms from.
  app.get('/v1/commerce/payments/catalog', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    return ok(GATEWAY_CATALOG);
  });

  // The tenant's configured bring-your-own credentials, MASKED (never secrets).
  app.get('/v1/commerce/payments/credentials', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const ctx = toCommerceContext(request);
    return ok(await listGatewayCredentials(ctx.tenantId));
  });

  // Capture / replace a gateway's API keys (encrypted at rest). Activates the gateway
  // if it's the one the tenant has selected.
  app.put('/v1/commerce/payments/credentials', async (request) => {
    requireRole(request, 'admin');
    await requireCommerceModule(request);
    const body = CredentialBody.parse(request.body);
    const ctx = toCommerceContext(request);
    try {
      const masked = await captureGatewayCredentials(ctx.tenantId, body);
      await activateGatewayIfSelected(ctx.tenantId, body.gatewayId);
      return ok(masked);
    } catch (err) {
      if (err instanceof GatewayCredentialError) throw badRequest(err.message);
      throw err;
    }
  });

  app.delete('/v1/commerce/payments/credentials/:gatewayId', async (request) => {
    requireRole(request, 'admin');
    await requireCommerceModule(request);
    const { gatewayId } = GatewayParams.parse(request.params);
    const ctx = toCommerceContext(request);
    await deleteGatewayCredentials(ctx.tenantId, gatewayId);
    return ok({ gatewayId });
  });

  return Promise.resolve();
};

export default paymentsRoutes;
