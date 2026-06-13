// Stripe webhook receiver (public — Stripe signature is the auth, no bearer
// token). Lives under /v1/public/ so the auth plugin bypasses bearer checks.
//
//   POST /v1/public/webhooks/stripe
//
// The single-account commerce webhook: one global STRIPE_WEBHOOK_SECRET. Per-tenant
// BYO-keys Stripe accounts hit the per-installation route instead
// (webhooks/providers.ts) — both share the reconciliation in
// lib/stripe-payment-reconcile.ts (payment captured/failed, charge refunded).
//
// Always returns 200 on valid signature — even for unhandled types — so
// Stripe does not retry. 403 on a bad signature.

import Stripe from 'stripe';
import type { FastifyPluginAsync } from 'fastify';
import { ApiError } from '@sparx/api-core/errors';
import { env } from '../../../env.js';
import { dispatchStripePaymentEvent } from '../../../lib/stripe-payment-reconcile.js';

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const stripeWebhookRoutes: FastifyPluginAsync = async (app) => {
  // Override the JSON content-type parser in this plugin's scope so the raw
  // bytes reach the route handler intact for Stripe signature verification.
  // Routes outside this encapsulated plugin keep the default JSON parser.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body: Buffer, done) => {
      done(null, body);
    }
  );

  app.post('/v1/public/webhooks/stripe', async (request, reply) => {
    const sig = request.headers['stripe-signature'];
    if (!sig || typeof sig !== 'string') {
      throw new ApiError('VALIDATION_ERROR', 'Missing stripe-signature header');
    }

    const rawBody = request.body as Buffer;

    const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      // Dev-only: accept without verification when secret is not configured.
      request.log.warn(
        'STRIPE_WEBHOOK_SECRET unset — processing webhook without signature verification (dev only)'
      );
      await reply.code(200).send({ received: true });
      return;
    }

    let event: Stripe.Event;
    try {
      event = Stripe.webhooks.constructEvent(rawBody.toString('utf8'), sig, webhookSecret);
    } catch (err) {
      request.log.warn({ err }, 'stripe webhook: signature verification failed');
      throw new ApiError('FORBIDDEN', 'Invalid Stripe webhook signature');
    }

    try {
      await dispatchStripePaymentEvent(request.log, event);
    } catch (err) {
      // Log but do not rethrow — Stripe would retry on any 5xx. We prefer
      // at-most-once delivery for payment events (duplicates cause double-paid
      // state); idempotency guards inside each handler protect against retries.
      request.log.error(
        { err, eventId: event.id, eventType: event.type },
        'stripe webhook: dispatch error'
      );
    }

    await reply.code(200).send({ received: true });
  });
};

export default stripeWebhookRoutes;
