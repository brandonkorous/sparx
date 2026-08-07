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
import { appLink, appOrigin } from '@sparx/links/server';
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

/** The workbench billing page — where a tenant adds/updates a card. The address
 *  comes from the shared table (`@sparx/links`), which is what stops this file
 *  from knowing a surface key: it used to append `?open=finance.subscription`,
 *  so renaming that surface would have broken every billing email already sent.
 *  `/settings/billing` is the canonical address and resolves on its own. */
function billingSettingsUrl(): string {
  return appLink('finance.subscription') ?? appOrigin();
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
      const sub = event.data.object;
      const tenantId = await reconcileFromSubscription(sub);
      if (tenantId) {
        await publishSubscriptionChanged(log, tenantId, sub.status, monthlyRecurringCents(sub), {
          currency: sub.currency,
        });
      }
      log.info(
        { eventType: event.type, tenantId, status: sub.status },
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
      const status = event.type === 'invoice.payment_failed' ? 'past_due' : 'active';
      if (customerId) {
        await setSubscriptionStatus(customerId, status);
      }
      // Notify the tenant about their own sparx bill. The hosted invoice page is
      // Stripe's — always present on a real invoice; fall back to the dashboard
      // billing settings if a test invoice lacks it.
      const recipient = await billingRecipient(customerId);
      if (recipient) {
        const currency = invoice.currency ?? 'usd';
        const invoiceUrl = invoice.hosted_invoice_url ?? billingSettingsUrl();
        // A failed or recovered payment is a fact about the customer, not just a
        // status column — the platform CRM records it on their timeline and tags
        // the deal (docs/140 §5). Published here because this is the branch that
        // knows the invoice AND resolved the tenant.
        await publishSubscriptionChanged(log, recipient.tenantId, status, null, { currency });
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

// ── Platform subscription lifecycle (docs/140) ────────────────────────────────
// Stripe is the source of truth for whether a tenant is trialing, paying, or
// gone — so this webhook is where that transition becomes an event other parts
// of sparx can react to. The platform-crm-worker consumes it to move the
// tenant's deal on our own signup board.
//
// Deliberately NOT one of the `subscription.*` topics: those are a tenant's own
// customers' commerce subscriptions. Same word, different customer.

/** Publish `tenant.subscription.changed`. Best-effort — `publish` swallows its
 *  own failures, and Stripe must still get its 200 either way. */
async function publishSubscriptionChanged(
  log: FastifyBaseLogger,
  tenantId: string,
  status: string,
  mrrCents: number | null,
  opts: { currency?: string | null }
): Promise<void> {
  await publish(log, 'tenant.subscription.changed', tenantId, null, {
    status,
    mrrCents,
    currency: opts.currency ? opts.currency.toUpperCase() : null,
  });
}

/**
 * The subscription's total recurring revenue normalized to ONE MONTH, in cents.
 *
 * Normalizing here (rather than in the consumer) means every reader gets a
 * comparable number: an annual plan reports its monthly equivalent, so a CRM
 * board summing deal values isn't mixing yearly and monthly figures. Metered
 * items carry no unit_amount and are skipped — usage isn't recurring revenue
 * until it's billed. Returns null when nothing was computable.
 */
function monthlyRecurringCents(sub: Stripe.Subscription): number | null {
  let total = 0;
  let counted = 0;

  for (const item of sub.items.data) {
    const amount = item.price.unit_amount;
    if (amount === null || amount === undefined) continue;
    const recurring = item.price.recurring;
    if (!recurring) continue;

    const every = recurring.interval_count > 0 ? recurring.interval_count : 1;
    const perMonth =
      recurring.interval === 'month'
        ? 1 / every
        : recurring.interval === 'year'
          ? 1 / (12 * every)
          : recurring.interval === 'week'
            ? 52 / 12 / every
            : // daily
              365 / 12 / every;

    total += amount * (item.quantity ?? 1) * perMonth;
    counted++;
  }

  return counted === 0 ? null : Math.round(total);
}
