// Gateway payment webhooks (docs/94 ADR §10). One endpoint per gateway. Each gateway
// verifies its own signature and normalizes the raw vendor event; the shared
// reconciler then resolves the tenant, dedupes, and updates orders + publishes the
// normalized Pub/Sub events. Public — the gateway signature is the auth (no bearer);
// the `/v1/public/` prefix bypasses the auth plugin.
//
//   POST /v1/public/webhooks/sparx-pay              (platform account, destination charges)
//   POST /v1/public/webhooks/stripe-direct/:tenantId (merchant's own account)
//
// Always 200 on a valid signature (even unhandled types) so Stripe stops retrying;
// 403 on a bad signature. Reconciliation is idempotent + best-effort (we prefer
// at-most-once for payment events — a 5xx would make Stripe retry).

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { gatewayRegistry, SPARX_PAY_ID, STRIPE_DIRECT_ID } from '@sparx/payments';
import type { StripeDirectGateway } from '@sparx/payments';
import { ApiError } from '@sparx/api-core/errors';

import { reconcilePaymentEvent } from '../../../lib/payment-webhook-reconcile.js';

const TenantPath = z.object({ tenantId: z.string().uuid() });

function signature(headers: Record<string, unknown>): string {
  const sig = headers['stripe-signature'];
  if (!sig || typeof sig !== 'string') {
    throw new ApiError('VALIDATION_ERROR', 'Missing stripe-signature header');
  }
  return sig;
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const paymentWebhookRoutes: FastifyPluginAsync = async (app) => {
  // Raw bytes for signature verification, scoped to this encapsulated plugin.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body: Buffer, done) => {
      done(null, body);
    }
  );

  // ── Sparx Pay — the platform account's single webhook (destination charges). The
  //    tenant rides in payment_intent.metadata.tenantId / the connected account id.
  app.post('/v1/public/webhooks/sparx-pay', async (request, reply) => {
    const sig = signature(request.headers);
    const rawBody = request.body as Buffer;

    if (!process.env.STRIPE_WEBHOOK_SECRET_SPARX_PAY?.trim()) {
      // Dev / pre-ops: no signing secret. Ack so Stripe (or a test) doesn't retry.
      request.log.warn(
        'STRIPE_WEBHOOK_SECRET_SPARX_PAY unset — sparx-pay webhook acknowledged without processing'
      );
      await reply.code(200).send({ received: true });
      return;
    }

    const gateway = gatewayRegistry.get(SPARX_PAY_ID);
    if (!gateway.verifyWebhookSignature(rawBody, sig)) {
      request.log.warn('sparx-pay webhook: signature verification failed');
      throw new ApiError('FORBIDDEN', 'Invalid Stripe webhook signature');
    }

    const parsed = await gateway.parseWebhook({ rawBody, signature: sig });
    try {
      await reconcilePaymentEvent(request.log, parsed, { gatewayId: SPARX_PAY_ID });
    } catch (err) {
      request.log.error(
        { err, externalId: parsed.externalId },
        'sparx-pay webhook: reconcile error'
      );
    }
    await reply.code(200).send({ received: true });
  });

  // ── Stripe Direct — the merchant's own account. Stripe can't tell us which tenant,
  //    so the merchant points their webhook at the tenant-scoped path; the gateway
  //    verifies against THAT tenant's own webhook secret.
  app.post('/v1/public/webhooks/stripe-direct/:tenantId', async (request, reply) => {
    const { tenantId } = TenantPath.parse(request.params);
    const sig = signature(request.headers);
    const rawBody = request.body as Buffer;

    const gateway = gatewayRegistry.get(STRIPE_DIRECT_ID) as StripeDirectGateway;
    let parsed;
    try {
      parsed = await gateway.parseWebhookForTenant(tenantId, { rawBody, signature: sig });
    } catch (err) {
      request.log.warn({ err, tenantId }, 'stripe-direct webhook: signature verification failed');
      throw new ApiError('FORBIDDEN', 'Invalid Stripe webhook signature');
    }

    try {
      await reconcilePaymentEvent(request.log, parsed, {
        gatewayId: STRIPE_DIRECT_ID,
        fallbackTenantId: tenantId,
      });
    } catch (err) {
      request.log.error(
        { err, tenantId, externalId: parsed.externalId },
        'stripe-direct webhook: reconcile error'
      );
    }
    await reply.code(200).send({ received: true });
  });
};

export default paymentWebhookRoutes;
