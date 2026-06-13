// Per-installation provider webhook ingress (docs/92 §B-G1). The single endpoint the
// integration framework's `webhookPathTemplate` points at, for every provider's
// per-tenant (bring-your-own-keys) install:
//
//   POST /v1/webhooks/providers/:slug/:installationId
//
// Public — the provider signature is the auth (no bearer). Resolves the installation
// with the UNSCOPED client (the established public-webhook pattern; the row arrives
// with no tenant context), resolves the install's own webhook signing secret from
// Secret Manager, verifies the signature via the provider bundle, dedupes + persists
// the event (commerce_provider_webhook_events, unique on slug+event id), then runs the
// shared payment reconciliation for Stripe-family providers. Always 200 on a valid
// signature (Stripe stops retrying); 403 on a bad one.

import type Stripe from 'stripe';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { prisma, withTenant } from '@sparx/db';
import { getSecretReader } from '@sparx/commerce';
import { verifyInboundWebhook, WebhookVerificationError } from '@sparx/integration-framework';
import { ApiError } from '@sparx/api-core/errors';

import { dispatchStripePaymentEvent } from '../../../lib/stripe-payment-reconcile.js';

// Provider slugs whose payment events flow through the shared Stripe reconciliation.
const STRIPE_PAYMENT_SLUGS = new Set(['stripe', 'sparx-pay']);

const PathParams = z.object({
  slug: z.string().min(1).max(63),
  installationId: z.string().uuid(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const providerWebhookRoutes: FastifyPluginAsync = async (app) => {
  // Raw bytes for signature verification, scoped to this encapsulated plugin.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body: Buffer, done) => {
      done(null, body);
    }
  );

  app.post('/v1/webhooks/providers/:slug/:installationId', async (request, reply) => {
    const { slug, installationId } = PathParams.parse(request.params);

    const sig = request.headers['stripe-signature'];
    if (!sig || typeof sig !== 'string') {
      throw new ApiError('VALIDATION_ERROR', 'Missing stripe-signature header');
    }
    const rawBody = (request.body as Buffer).toString('utf8');

    // Resolve the installation with the unscoped client — a public webhook has no
    // tenant context (same pattern as the single-account stripe webhook). Gate on
    // enabled + not-uninstalled so a torn-down install rejects cleanly.
    const install = await prisma.providerInstallation.findFirst({
      where: { id: installationId, uninstalledAt: null, enabled: true },
      select: { id: true, tenantId: true, providerSlug: true, configEncrypted: true },
    });
    if (install?.providerSlug !== slug) {
      // Unknown / mismatched install — ack so the provider stops retrying a dead URL.
      request.log.warn({ slug, installationId }, 'provider webhook: no matching installation');
      await reply.code(200).send({ received: true });
      return;
    }

    const config = (install.configEncrypted as { webhookSecretRef?: string } | null) ?? {};
    if (!config.webhookSecretRef) {
      request.log.warn(
        { slug, installationId },
        'provider webhook: install has no webhookSecretRef — acknowledged without processing'
      );
      await reply.code(200).send({ received: true });
      return;
    }

    let signingSecret: string;
    try {
      signingSecret = await getSecretReader().read(config.webhookSecretRef);
    } catch (err) {
      request.log.error(
        { err, slug, installationId },
        'provider webhook: could not resolve signing secret'
      );
      await reply.code(200).send({ received: true });
      return;
    }

    // Verify the signature via the provider bundle (throws on a bad signature).
    let verified;
    try {
      verified = verifyInboundWebhook({
        providerSlug: install.providerSlug,
        installationId: install.id,
        rawBody,
        signature: sig,
        signingSecret,
      });
    } catch (err) {
      if (err instanceof WebhookVerificationError) {
        request.log.warn({ err, slug, installationId }, 'provider webhook: signature invalid');
        throw new ApiError('FORBIDDEN', 'Invalid provider webhook signature');
      }
      throw err;
    }

    // Dedupe + persist. The unique (provider_slug, provider_event_id) makes a
    // redelivery a no-op: a P2002 means we already recorded this event.
    let novel = true;
    try {
      await withTenant({ tenantId: install.tenantId }, (tx) =>
        tx.providerWebhookEvent.create({
          data: {
            tenantId: install.tenantId,
            installationId: install.id,
            providerSlug: install.providerSlug,
            providerEventId: verified.providerEventId,
            providerEventType: verified.providerEventType,
            signatureVerifiedAt: new Date(),
            rawPayload: verified.rawPayload as object,
            status: 'received',
          },
        })
      );
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        novel = false;
        request.log.debug(
          { providerEventId: verified.providerEventId },
          'provider webhook: duplicate event — already recorded'
        );
      } else {
        throw err;
      }
    }

    // Reconcile once (idempotent handlers; the storefront paid edge stays consistent
    // with the merchant's own Stripe). Non-Stripe providers persist only for now.
    if (novel && STRIPE_PAYMENT_SLUGS.has(install.providerSlug)) {
      let status = 'processed';
      let errorReason: string | null = null;
      try {
        await dispatchStripePaymentEvent(request.log, verified.rawPayload as Stripe.Event);
      } catch (err) {
        status = 'failed';
        errorReason = err instanceof Error ? err.message.slice(0, 500) : 'unknown error';
        request.log.error(
          { err, slug, installationId, providerEventId: verified.providerEventId },
          'provider webhook: reconciliation failed'
        );
      }
      await withTenant({ tenantId: install.tenantId }, (tx) =>
        tx.providerWebhookEvent.updateMany({
          where: { providerSlug: install.providerSlug, providerEventId: verified.providerEventId },
          data: { status, processedAt: new Date(), ...(errorReason ? { errorReason } : {}) },
        })
      );
    }

    await reply.code(200).send({ received: true });
  });
};

export default providerWebhookRoutes;
