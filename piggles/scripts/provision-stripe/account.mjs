// The account-level pieces: the email meter, the customer portal, the webhook.

import { METER, PORTAL, WEBHOOK_EVENTS, WEBHOOK_PATH } from './copy.mjs';
import { DRY_RUN, log } from './env.mjs';

/** Find-or-create the email-send meter, keyed on `event_name`. `status` accepts only
 *  `active` or `inactive`, and an archived meter keeps its event name reserved — so
 *  both are read rather than assuming a missing active meter means none exists. */
export async function ensureMeter(stripe) {
  const [active, inactive] = await Promise.all([
    stripe.get('/billing/meters', { limit: 100, status: 'active' }),
    stripe.get('/billing/meters', { limit: 100, status: 'inactive' }),
  ]);
  const existing = [...(active.data ?? []), ...(inactive.data ?? [])].find(
    (m) => m.event_name === METER.eventName
  );
  if (existing) return log(`  meter   ok ${METER.eventName} (${existing.id}, ${existing.status})`);
  if (DRY_RUN) return log(`  meter   +  ${METER.eventName} [dry-run]`);
  const created = await stripe.post('/billing/meters', {
    display_name: METER.displayName,
    event_name: METER.eventName,
    default_aggregation: { formula: 'sum' },
    customer_mapping: { type: 'by_id', event_payload_key: 'stripe_customer_id' },
    value_settings: { event_payload_key: 'value' },
  });
  log(`  meter   +  ${METER.eventName} (${created.id})`);
}

/** Find-or-create the portal configuration. `subscription_update` stays OFF: there
 *  is one plan, and quantity editing there would sit the base plan beside the
 *  add-ons, one click from billing a business twice (BILLING_RULES.md). */
export async function ensurePortalConfig(stripe) {
  const configs = await stripe.get('/billing_portal/configurations', { limit: 100 });
  const existing = configs.data?.find((c) => c.metadata?.piggles_managed === 'true');
  if (existing) return log(`  portal  ok configuration (${existing.id})`);
  if (DRY_RUN) return log('  portal  +  configuration [dry-run]');
  const created = await stripe.post('/billing_portal/configurations', {
    business_profile: {
      headline: PORTAL.headline,
      privacy_policy_url: PORTAL.privacyUrl,
      terms_of_service_url: PORTAL.termsUrl,
    },
    features: {
      customer_update: {
        enabled: true,
        allowed_updates: ['email', 'name', 'address', 'phone', 'tax_id'],
      },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: {
        enabled: true,
        mode: 'at_period_end',
        cancellation_reason: {
          enabled: true,
          options: [
            'too_expensive',
            'missing_features',
            'switched_service',
            'unused',
            'customer_service',
            'other',
          ],
        },
      },
      subscription_update: { enabled: false },
    },
    metadata: { piggles_managed: 'true' },
  });
  log(`  portal  +  configuration (${created.id})`);
}

/** Find-or-create the billing webhook endpoint. The signing secret is returned ONLY on
 *  creation — captured for the env printout, because it cannot be read back. */
export async function ensureWebhook(stripe, apiUrl) {
  const url = `${apiUrl.replace(/\/$/, '')}${WEBHOOK_PATH}`;
  const endpoints = await stripe.get('/webhook_endpoints', { limit: 100 });
  const existing = endpoints.data?.find((e) => e.url === url);
  if (existing) {
    if (!DRY_RUN) {
      await stripe.post(`/webhook_endpoints/${existing.id}`, { enabled_events: WEBHOOK_EVENTS });
    }
    log(`  webhook ok ${url} (${existing.id}), secret unchanged`);
    return undefined;
  }
  if (DRY_RUN) {
    log(`  webhook +  ${url} [dry-run]`);
    return undefined;
  }
  const created = await stripe.post('/webhook_endpoints', {
    url,
    description: 'Piggles platform billing',
    enabled_events: WEBHOOK_EVENTS,
    metadata: { piggles_managed: 'true' },
  });
  log(`  webhook +  ${url} (${created.id})`);
  return created.secret;
}
