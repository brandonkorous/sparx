// Platform BILLING webhook (docs/67 §6) — Stripe is the source of truth for
// subscription state. Separate endpoint + signing secret from the commerce
// payment webhook (stripe.ts) so the two can't interfere.
//
//   POST /v1/public/webhooks/stripe/billing
//
// Handled events:
//   customer.subscription.updated  → reconcile tenant status + items + module flags
//   customer.subscription.deleted  → same path; canceled status disables modules
//   customer.subscription.trial_will_end → logged (the dashboard banner reads
//                                          trialEndsAt; nothing to persist)
//   invoice.payment_failed         → subscription_status = past_due
//   invoice.payment_succeeded      → subscription_status = active
//
// Always 200 on a valid signature (even for unhandled types) so Stripe stops
// retrying; 403 on a bad signature. Reconciliation is idempotent.

import type Stripe from 'stripe';
import type { FastifyBaseLogger, FastifyPluginAsync } from 'fastify';
import { reconcileFromSubscription, setSubscriptionStatus } from '@sparx/billing';
import { constructEventWithAnySecret, parseWebhookSecrets } from '@sparx/payments';
import { ApiError } from '@sparx/api-core/errors';
import { env } from '../../../env.js';

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const stripeBillingWebhookRoutes: FastifyPluginAsync = async (app) => {
  // Raw bytes for signature verification, scoped to this encapsulated plugin.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body: Buffer, done) => {
      done(null, body);
    }
  );

  app.post('/v1/public/webhooks/stripe/billing', async (request, reply) => {
    const sig = request.headers['stripe-signature'];
    if (!sig || typeof sig !== 'string') {
      throw new ApiError('VALIDATION_ERROR', 'Missing stripe-signature header');
    }

    const rawBody = request.body as Buffer;
    // Comma-separated list, so a rolled signing secret keeps verifying during Stripe's
    // 24h overlap instead of 403-ing every billing event. See @sparx/payments'
    // webhook-secrets.ts.
    const webhookSecrets = parseWebhookSecrets(env.STRIPE_WEBHOOK_SECRET_BILLING);
    if (webhookSecrets.length === 0) {
      // Dev / pre-ops: no billing webhook secret configured. Acknowledge so
      // Stripe (or a test) doesn't retry; nothing is reconciled.
      request.log.warn(
        'STRIPE_WEBHOOK_SECRET_BILLING unset — billing webhook acknowledged without processing'
      );
      await reply.code(200).send({ received: true });
      return;
    }

    const event = constructEventWithAnySecret(rawBody.toString('utf8'), sig, webhookSecrets);
    if (!event) {
      request.log.warn('stripe billing webhook: signature verification failed');
      throw new ApiError('FORBIDDEN', 'Invalid Stripe webhook signature');
    }

    try {
      await dispatch(request.log, event);
    } catch (err) {
      // Log, don't rethrow — a 5xx makes Stripe retry; reconciliation is
      // idempotent, but we prefer to ack and let the next event self-heal.
      request.log.error(
        { err, eventId: event.id, eventType: event.type },
        'stripe billing webhook: dispatch error'
      );
    }

    await reply.code(200).send({ received: true });
  });
};

export default stripeBillingWebhookRoutes;

async function dispatch(log: FastifyBaseLogger, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    // A trial that ends with no card pauses (end_behavior: 'pause', docs/17 §6);
    // adding a card resumes it. Stripe also emits `updated` for both, but handle
    // the explicit events too so the tenant's phase reconciles promptly either way.
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.paused':
    case 'customer.subscription.resumed':
    case 'customer.subscription.deleted': {
      const tenantId = await reconcileFromSubscription(event.data.object);
      log.info(
        { eventType: event.type, tenantId, status: event.data.object.status },
        'stripe billing webhook: subscription reconciled'
      );
      break;
    }
    case 'customer.subscription.trial_will_end':
      log.info(
        { subscriptionId: event.data.object.id },
        'stripe billing webhook: trial ending soon (dashboard banner reads trialEndsAt)'
      );
      break;
    case 'invoice.payment_failed':
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object;
      const customerId =
        typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
      if (customerId) {
        await setSubscriptionStatus(
          customerId,
          event.type === 'invoice.payment_failed' ? 'past_due' : 'active'
        );
      }
      log.info(
        { eventType: event.type, customerId },
        'stripe billing webhook: invoice status synced'
      );
      break;
    }
    default:
      log.debug({ type: event.type }, 'stripe billing webhook: unhandled event type — ignored');
  }
}
