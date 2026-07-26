// Platform BILLING webhook (docs/67 §6) — Stripe is the source of truth for
// subscription state. Separate endpoint + signing secret from the commerce
// payment webhook (stripe.ts) so the two can't interfere.
//
//   POST /v1/public/webhooks/stripe/billing
//
// Handled events:
//   customer.subscription.updated  → reconcile tenant status + items + module flags
//   customer.subscription.deleted  → same path; canceled status disables modules
//   customer.subscription.trial_will_end → emails the tenant a trial-ending notice
//   invoice.payment_failed         → subscription_status = past_due + emails the tenant
//   invoice.payment_succeeded      → subscription_status = active + emails a receipt
//
// The three tenant-facing emails are sparx-branded platform templates (bucket B),
// published as `email.send` to the tenant's billing contact (docs/impl transactional-email §4 P4).
//
// Always 200 on a valid signature (even for unhandled types) so Stripe stops
// retrying; 403 on a bad signature. Reconciliation is idempotent.

import type Stripe from 'stripe';
import type { FastifyBaseLogger, FastifyPluginAsync } from 'fastify';
import { reconcileFromSubscription, setSubscriptionStatus } from '@sparx/billing';
import { constructEventWithAnySecret, parseWebhookSecrets } from '@sparx/payments';
import { ApiError } from '@sparx/api-core/errors';
import { publish } from '@sparx/api-core/pubsub';
import { prisma } from '@sparx/db';
import { env } from '../../../env.js';

// ── sparx-billing notifications (docs/impl transactional-email §4 P4) ─────────
// The tenant's OWN sparx bill: receipt, payment-failed, trial-ending. These are
// PLATFORM → tenant emails (sparx-branded React templates, bucket B), not a
// tenant's customer emails — so they publish `email.send` with a coded template,
// addressed to the tenant's billing contact, not through the Builder-email path.

/** The billing contact for a Stripe customer — the Tenant row keyed by the unique
 *  `stripeCustomerId` (a non-RLS root row, safe to read without a tenant context). */
async function billingRecipient(
  customerId: string | null | undefined
): Promise<{ tenantId: string; email: string; name: string } | null> {
  if (!customerId) return null;
  const tenant = await prisma.tenant.findUnique({
    where: { stripeCustomerId: customerId },
    select: { id: true, email: true, name: true },
  });
  if (!tenant?.email) return null;
  return { tenantId: tenant.id, email: tenant.email, name: tenant.name };
}

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: (currency || 'usd').toUpperCase(),
  }).format(cents / 100);
}

/** A unix-seconds timestamp → "Aug 5, 2026". */
function dateLabel(unixSeconds: number): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(unixSeconds * 1000));
}

/** The workbench billing page — where a tenant adds/updates a card. `/settings/billing`
 *  is a friendly redirect route that translates to the `finance.subscription` pane
 *  (apps/workbench/app/settings/billing), the same emitters-use-a-readable-path
 *  convention as the domain-renewal email's `/settings/domains`. The base defaults to
 *  the app host (matching services/domain-worker), NOT the marketing site. */
function billingSettingsUrl(): string {
  const base = env.SPARX_DASHBOARD_URL ?? 'https://app.sparx.works';
  return `${base.replace(/\/$/, '')}/settings/billing`;
}

const asString = (v: string | { id: string } | null | undefined): string | undefined =>
  typeof v === 'string' ? v : (v?.id ?? undefined);

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
    case 'customer.subscription.trial_will_end': {
      const sub = event.data.object;
      const recipient = await billingRecipient(asString(sub.customer));
      if (recipient && sub.trial_end) {
        await publish(log, 'email.send', recipient.tenantId, null, {
          template: 'billing-trial-ending',
          to: recipient.email,
          props: {
            accountName: recipient.name,
            trialEndLabel: dateLabel(sub.trial_end),
            manageUrl: billingSettingsUrl(),
          },
        });
      }
      log.info(
        { subscriptionId: sub.id, notified: Boolean(recipient) },
        'stripe billing webhook: trial ending soon'
      );
      break;
    }
    case 'invoice.payment_failed':
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object;
      const customerId = asString(invoice.customer);
      if (customerId) {
        await setSubscriptionStatus(
          customerId,
          event.type === 'invoice.payment_failed' ? 'past_due' : 'active'
        );
      }
      // Notify the tenant about their own sparx bill. The hosted invoice page is
      // Stripe's — always present on a real invoice; fall back to the dashboard
      // billing settings if a test invoice lacks it.
      const recipient = await billingRecipient(customerId);
      if (recipient) {
        const currency = invoice.currency ?? 'usd';
        const invoiceUrl = invoice.hosted_invoice_url ?? billingSettingsUrl();
        if (event.type === 'invoice.payment_succeeded') {
          await publish(log, 'email.send', recipient.tenantId, null, {
            template: 'billing-receipt',
            to: recipient.email,
            props: {
              accountName: recipient.name,
              amountLabel: money(invoice.amount_paid ?? 0, currency),
              periodLabel:
                invoice.period_start && invoice.period_end
                  ? `${dateLabel(invoice.period_start)} – ${dateLabel(invoice.period_end)}`
                  : undefined,
              invoiceUrl,
            },
          });
        } else {
          await publish(log, 'email.send', recipient.tenantId, null, {
            template: 'billing-payment-failed',
            to: recipient.email,
            props: {
              accountName: recipient.name,
              amountLabel: money(invoice.amount_due ?? 0, currency),
              updateUrl: invoiceUrl,
            },
          });
        }
      }
      log.info(
        { eventType: event.type, customerId, notified: Boolean(recipient) },
        'stripe billing webhook: invoice status synced'
      );
      break;
    }
    default:
      log.debug({ type: event.type }, 'stripe billing webhook: unhandled event type — ignored');
  }
}
