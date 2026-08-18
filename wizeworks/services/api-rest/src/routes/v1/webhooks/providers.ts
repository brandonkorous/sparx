// Per-installation provider webhook ingress (docs/92 §B-G1). The single endpoint the
// integration framework's `webhookPathTemplate` points at, for every provider's
// per-tenant (bring-your-own-keys) install:
//
//   POST /v1/webhooks/providers/:slug/:installationId
//
// Public — the provider signature is the auth (no bearer) for providers that sign
// their webhooks (metadata.webhookRequiresSignature !== false, the Stripe-family
// default). A provider that doesn't sign at all (Shippo) opts out via that flag;
// trust then rides on the URL-embedded installationId instead. Resolves the
// installation with the UNSCOPED client (the established public-webhook pattern;
// the row arrives with no tenant context), resolves the install's own webhook
// signing secret from Secret Manager when required, verifies via the provider
// bundle, dedupes + persists the event (commerce_provider_webhook_events, unique
// on slug+event id), then reconciles inline — shipping tracking updates for
// shipping-kind installs. Always 200 on a valid signature (so the provider stops
// retrying); 403 on a bad one.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { prisma, withTenant } from '@wizeworks/db';
import { dispatchShippingTrackingWebhook, getSecretReader } from '@wizeworks/commerce';
import {
  getProvider,
  verifyInboundWebhook,
  WebhookVerificationError,
} from '@wizeworks/integration-framework';
import { ApiError } from '@wizeworks/api-core/errors';

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
    const rawBody = (request.body as Buffer).toString('utf8');

    // Most providers (Stripe-family) sign their webhooks and need a resolved
    // secret; a provider can opt out (metadata.webhookRequiresSignature ===
    // false) when it doesn't sign at all (Shippo) — trust then rides on the
    // URL-embedded installationId, resolved below the same way either way.
    const bundle = getProvider(slug);
    const requiresSignature = bundle?.metadata.webhookRequiresSignature !== false;

    const sig = request.headers['stripe-signature'];
    if (requiresSignature && (!sig || typeof sig !== 'string')) {
      throw new ApiError('VALIDATION_ERROR', 'Missing stripe-signature header');
    }

    // Resolve the installation with the unscoped client — a public webhook has no
    // tenant context (same pattern as the single-account stripe webhook). Gate on
    // enabled + not-uninstalled so a torn-down install rejects cleanly.
    const install = await prisma.providerInstallation.findFirst({
      where: { id: installationId, uninstalledAt: null, enabled: true },
      select: { id: true, tenantId: true, providerSlug: true, kind: true, configEncrypted: true },
    });
    if (install?.providerSlug !== slug) {
      // Unknown / mismatched install — ack so the provider stops retrying a dead URL.
      request.log.warn({ slug, installationId }, 'provider webhook: no matching installation');
      await reply.code(200).send({ received: true });
      return;
    }

    let signingSecret = '';
    if (requiresSignature) {
      const config = (install.configEncrypted as { webhookSecretRef?: string } | null) ?? {};
      if (!config.webhookSecretRef) {
        request.log.warn(
          { slug, installationId },
          'provider webhook: install has no webhookSecretRef — acknowledged without processing'
        );
        await reply.code(200).send({ received: true });
        return;
      }
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
    }

    // Verify the signature via the provider bundle (throws on a bad signature).
    // Unsigned providers get an empty signature/secret — their verifyWebhook()
    // trusts the URL-resolved installation instead.
    let verified;
    try {
      verified = verifyInboundWebhook({
        providerSlug: install.providerSlug,
        installationId: install.id,
        rawBody,
        signature: typeof sig === 'string' ? sig : '',
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
    // redelivery a no-op: a P2002 means we already recorded this event. This is the
    // integration-framework's generic provider-webhook ingress (shipping / tax /
    // dropship). Gateway PAYMENT events no longer flow here — they go through the
    // dedicated /v1/public/webhooks/{sparx-pay,stripe-direct} endpoints (docs/94 §10).
    let isDuplicate = false;
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
        isDuplicate = true;
        request.log.debug(
          { providerEventId: verified.providerEventId },
          'provider webhook: duplicate event — already recorded'
        );
      } else {
        throw err;
      }
    }

    // Inline reconciliation — no dedicated worker exists for this ingress
    // (matches the "always-200, reconcile inline" style used elsewhere, e.g.
    // stripe-billing.ts). Skip on a duplicate redelivery; already applied.
    if (!isDuplicate && install.kind === 'shipping') {
      await dispatchShippingTrackingWebhook(
        { tenantId: install.tenantId },
        { rawPayload: verified.rawPayload }
      );
    }

    await reply.code(200).send({ received: true });
  });
};

export default providerWebhookRoutes;
