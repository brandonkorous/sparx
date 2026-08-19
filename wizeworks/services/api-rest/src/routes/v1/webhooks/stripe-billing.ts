// Platform BILLING webhook (docs/67 §6) — Stripe is the source of truth for
// subscription state. Separate endpoint + signing secret from the commerce
// payment webhook (stripe.ts) so the two can't interfere.
//
//   POST /v1/public/webhooks/stripe/billing
//
// ONE URL, MORE THAN ONE STRIPE ACCOUNT. WizeWorks bills two products out of two
// separate accounts, and both point their billing endpoint here. Which account an
// event came from is not in the payload — it is whichever PLAN's signing secret
// verifies the signature, so verification and account identification are the same
// step (see `verifyAgainstAnyPlan`). Everything downstream is scoped by that plan,
// because a Stripe customer id only means something inside its own account.
//
// Handled events:
//   customer.subscription.updated  → reconcile tenant status + items + module flags
//   customer.subscription.deleted  → same path; canceled status disables modules
//   customer.subscription.trial_will_end → emails the tenant a trial-ending notice
//   invoice.payment_failed         → subscription_status = past_due + emails the tenant
//   invoice.payment_succeeded      → subscription_status = active + emails a receipt
//
// The three tenant-facing emails are PLATFORM templates (bucket B), rendered in
// the tenant's own brand and published as `email.send` to its billing contact.
//
// Always 200 on a valid signature (even for unhandled types) so Stripe stops
// retrying; 403 on a bad signature. Reconciliation is idempotent.

import type Stripe from 'stripe';
import type { FastifyBaseLogger, FastifyPluginAsync } from 'fastify';
import {
  listBillingPlans,
  reconcileFromSubscription,
  setSubscriptionStatus,
  type BillingPlan,
} from '@wizeworks/billing';
import { constructEventWithAnySecret, parseWebhookSecrets } from '@wizeworks/payments';
import { ApiError } from '@wizeworks/api-core/errors';
import { publish } from '@wizeworks/api-core/pubsub';
import { prisma } from '@wizeworks/db';
import { appLink, appOrigin } from '@wizeworks/links/server';

// ── Platform billing notifications (docs/impl transactional-email §4 P4) ─────
// The tenant's OWN bill from WizeWorks: receipt, payment-failed, trial-ending.
// These are PLATFORM → tenant emails (bucket B), not a
// tenant's customer emails — so they publish `email.send` with a coded template,
// addressed to the tenant's billing contact, not through the Builder-email path.

/** The billing contact for a Stripe customer — the Tenant row keyed by the unique
 *  `stripeCustomerId` (a non-RLS root row, safe to read without a tenant context). */
async function billingRecipient(
  customerId: string | null | undefined,
  planId: string
): Promise<{ tenantId: string; email: string; name: string; brand: string } | null> {
  if (!customerId) return null;
  // findFirst scoped by plan, not findUnique on the customer alone: the id is only
  // unique within its own Stripe account, so a cross-account lookup could resolve
  // somebody else's tenant. Narrowing fails closed.
  const tenant = await prisma.tenant.findFirst({
    where: { stripeCustomerId: customerId, billingPlan: planId },
    // `platformBrand` rides this read. A Stripe webhook has no session and no
    // hostname — the `tenants` row is the non-RLS dispatch row precisely so a
    // webhook can resolve the tenant before any context is set, and the brand is
    // resolvable from exactly the same place for exactly the same reason.
    select: { id: true, email: true, name: true, platformBrand: true },
  });
  if (!tenant?.email) return null;
  return {
    tenantId: tenant.id,
    email: tenant.email,
    name: tenant.name,
    brand: tenant.platformBrand,
  };
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

/** The billing page — where a tenant adds/updates a card. The address comes from
 *  the shared table (`@wizeworks/links`), which is what stops this file from knowing
 *  a surface key: it used to append `?open=finance.subscription`, so renaming
 *  that surface would have broken every billing email already sent.
 *
 *  Takes the tenant's brand because the console it opens differs per product.
 *  Note that `finance.subscription` is a HIDDEN surface in the Piggles console —
 *  platform billing lives on getpiggles.com there (piggles/CLAUDE.md RULE #2) —
 *  so once Piggles bills through Stripe, this address needs a Piggles-side
 *  answer rather than a Piggles-origin version of a sparx address. Tracked as
 *  follow-up in piggles/docs/migration. */
function billingSettingsUrl(brand: string): string {
  return appLink('finance.subscription', undefined, { brand }) ?? appOrigin(brand);
}

const asString = (v: string | { id: string } | null | undefined): string | undefined =>
  typeof v === 'string' ? v : (v?.id ?? undefined);

/** Which subscription-update email (if any) a Stripe subscription event warrants.
 *  `updated` fires for many reasons, so it only emails when the PLAN itself changed
 *  (`previous_attributes.items` present) — never on every reconcile; and `created`
 *  only once the subscription is actually live (active/trialing), not `incomplete`. */
function subscriptionUpdateKind(
  eventType: string,
  sub: Stripe.Subscription,
  previousAttributes: Record<string, unknown> | undefined
): 'started' | 'canceled' | 'plan-changed' | 'paused' | 'resumed' | null {
  switch (eventType) {
    case 'customer.subscription.created':
      return sub.status === 'active' || sub.status === 'trialing' ? 'started' : null;
    case 'customer.subscription.deleted':
      return 'canceled';
    case 'customer.subscription.paused':
      return 'paused';
    case 'customer.subscription.resumed':
      return 'resumed';
    case 'customer.subscription.updated':
      return previousAttributes && 'items' in previousAttributes ? 'plan-changed' : null;
    default:
      return null;
  }
}

/** The human-facing plan labels for a subscription-update email, all best-effort:
 *  the price nickname, the normalized monthly amount, the renewal date, and (for a
 *  trial) the trial end. Any that can't be resolved are omitted and the template
 *  renders without them. */
function planSummary(sub: Stripe.Subscription): {
  planLabel?: string;
  amountLabel?: string;
  renewsOnLabel?: string;
  trialEndLabel?: string;
} {
  const currency = sub.currency ?? 'usd';
  const planLabel = sub.items?.data?.[0]?.price?.nickname ?? undefined;
  const mrr = monthlyRecurringCents(sub);
  const amountLabel = mrr != null ? `${money(mrr, currency)} / month` : undefined;
  // `current_period_end` isn't on every pinned Stripe type version — read defensively.
  const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;
  const renewsOnLabel = periodEnd ? dateLabel(periodEnd) : undefined;
  const trialEndLabel = sub.trial_end ? dateLabel(sub.trial_end) : undefined;
  return { planLabel, amountLabel, renewsOnLabel, trialEndLabel };
}

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
    const verified = verifyAgainstAnyPlan(rawBody.toString('utf8'), sig);

    if (verified === 'unconfigured') {
      // Dev / pre-ops: no plan has a billing webhook secret configured. Acknowledge
      // so Stripe (or a test) doesn't retry; nothing is reconciled.
      request.log.warn(
        'no billing webhook secret configured for any plan — acknowledged without processing'
      );
      await reply.code(200).send({ received: true });
      return;
    }
    if (!verified) {
      request.log.warn('stripe billing webhook: signature verification failed');
      throw new ApiError('FORBIDDEN', 'Invalid Stripe webhook signature');
    }

    const { event, plan } = verified;
    try {
      await dispatch(request.log, event, plan);
    } catch (err) {
      // Log, don't rethrow — a 5xx makes Stripe retry; reconciliation is
      // idempotent, but we prefer to ack and let the next event self-heal.
      request.log.error(
        { err, eventId: event.id, eventType: event.type, plan: plan.id },
        'stripe billing webhook: dispatch error'
      );
    }

    await reply.code(200).send({ received: true });
  });
};

export default stripeBillingWebhookRoutes;

/** Which billing PLAN sent this event — determined by whose signing secret verifies
 *  it, because the payload carries no account identity of its own.
 *
 *  Each plan's secret env var is a comma-separated LIST, so a rolled secret keeps
 *  verifying through Stripe's 24h overlap instead of 403-ing every billing event.
 *
 *  Returns `'unconfigured'` (acknowledge, process nothing) when NO plan has a secret,
 *  `null` when secrets exist but none verify (a real 403), or the event plus the plan
 *  that owns it. */
function verifyAgainstAnyPlan(
  rawBody: string,
  signature: string
): { event: Stripe.Event; plan: BillingPlan } | 'unconfigured' | null {
  let anyConfigured = false;
  for (const plan of listBillingPlans()) {
    const secrets = parseWebhookSecrets(process.env[plan.webhookSecretEnv]);
    if (secrets.length === 0) continue;
    anyConfigured = true;
    const event = constructEventWithAnySecret(rawBody, signature, secrets);
    if (event) return { event, plan };
  }
  return anyConfigured ? null : 'unconfigured';
}

async function dispatch(
  log: FastifyBaseLogger,
  event: Stripe.Event,
  plan: BillingPlan
): Promise<void> {
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
      const tenantId = await reconcileFromSubscription(sub, plan.id);
      if (tenantId) {
        await publishSubscriptionChanged(log, tenantId, sub.status, monthlyRecurringCents(sub), {
          currency: sub.currency,
        });
      }
      // Notify the tenant about the state change — one `subscription-update` email
      // per meaningful transition (started/canceled/plan-changed/paused/resumed).
      const kind = subscriptionUpdateKind(
        event.type,
        sub,
        (event.data as { previous_attributes?: Record<string, unknown> }).previous_attributes
      );
      if (kind) {
        const recipient = await billingRecipient(asString(sub.customer), plan.id);
        if (recipient) {
          const ps = planSummary(sub);
          await publish(log, 'email.send', recipient.tenantId, null, {
            template: 'subscription-update',
            to: recipient.email,
            props: {
              kind,
              accountName: recipient.name,
              ...(ps.planLabel ? { planLabel: ps.planLabel } : {}),
              ...(ps.amountLabel ? { amountLabel: ps.amountLabel } : {}),
              ...(ps.renewsOnLabel ? { renewsOnLabel: ps.renewsOnLabel } : {}),
              ...(kind === 'started' && ps.trialEndLabel
                ? { trialEndLabel: ps.trialEndLabel }
                : {}),
              ...(kind === 'canceled' && ps.renewsOnLabel
                ? { effectiveLabel: ps.renewsOnLabel }
                : {}),
              manageUrl: billingSettingsUrl(recipient.brand),
            },
          });
        }
      }
      log.info(
        { eventType: event.type, tenantId, status: sub.status, notified: Boolean(kind) },
        'stripe billing webhook: subscription reconciled'
      );
      break;
    }
    case 'customer.subscription.trial_will_end': {
      const sub = event.data.object;
      const recipient = await billingRecipient(asString(sub.customer), plan.id);
      if (recipient && sub.trial_end) {
        await publish(log, 'email.send', recipient.tenantId, null, {
          template: 'billing-trial-ending',
          to: recipient.email,
          props: {
            accountName: recipient.name,
            trialEndLabel: dateLabel(sub.trial_end),
            manageUrl: billingSettingsUrl(recipient.brand),
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
        await setSubscriptionStatus(customerId, status, plan.id);
      }
      // Notify the tenant about their own bill. The hosted invoice page is
      // Stripe's — always present on a real invoice; fall back to the dashboard
      // billing settings if a test invoice lacks it.
      const recipient = await billingRecipient(customerId, plan.id);
      if (recipient) {
        const currency = invoice.currency ?? 'usd';
        const invoiceUrl = invoice.hosted_invoice_url ?? billingSettingsUrl(recipient.brand);
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
