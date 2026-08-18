// Find-or-create for every object the Piggles catalog needs.
//
// Everything here is keyed on something deterministic — a product id we choose, a
// price `lookup_key`, a meter `event_name`, a `piggles_managed` metadata marker —
// so a second run reuses what exists instead of creating a second copy. That is
// the property that lets this be re-run after any catalog edit.

import { TAX_CODE } from './catalog.mjs';

const money = (cents) => `$${(cents / 100).toFixed(2)}`;

/** Find-or-create a Product by the id we chose. Names and metadata are patched
 *  onto an existing one, so a copy edit here reaches Stripe on the next run. */
export async function ensureProduct(ctx, spec) {
  const body = {
    name: spec.name,
    description: spec.description,
    tax_code: TAX_CODE,
    metadata: { piggles_managed: 'true', ...spec.metadata },
    ...(spec.unitLabel ? { unit_label: spec.unitLabel } : {}),
    ...(spec.statementDescriptor ? { statement_descriptor: spec.statementDescriptor } : {}),
  };
  try {
    await ctx.stripe.get(`/products/${spec.product}`);
    if (!ctx.dryRun) await ctx.stripe.post(`/products/${spec.product}`, body);
    ctx.log(`  product ✓ ${spec.product} (${spec.name})`);
  } catch (err) {
    if (err.code !== 'resource_missing') throw err;
    if (ctx.dryRun) return ctx.log(`  product + ${spec.product} (${spec.name}) [dry-run]`);
    await ctx.stripe.post('/products', { id: spec.product, ...body });
    ctx.log(`  product + ${spec.product} (${spec.name})`);
  }
}

/** True when an existing price is byte-for-byte the one the catalog asks for.
 *  Prices are immutable, so anything else means minting a new one. */
function priceMatches(price, spec) {
  return (
    price?.active &&
    price.unit_amount === spec.cents &&
    price.currency === 'usd' &&
    price.recurring?.interval === 'month' &&
    (price.recurring?.trial_period_days ?? null) === (spec.trialDays ?? null)
  );
}

/** Find-or-create a Price by `lookup_key`. When the amount changes, a fresh price
 *  is created and the lookup key MOVES to it (`transfer_lookup_key`) — existing
 *  subscriptions stay on the old price until something migrates them, which is the
 *  correct default for a price change. */
export async function ensurePrice(ctx, product, spec) {
  const found = await ctx.stripe.get('/prices', { 'lookup_keys[0]': spec.lookupKey, limit: 1 });
  const existing = found.data?.[0];
  if (priceMatches(existing, spec)) {
    ctx.log(`  price   ✓ ${spec.lookupKey} (${money(spec.cents)}/month)`);
    return existing.id;
  }
  if (ctx.dryRun) {
    ctx.log(`  price   + ${spec.lookupKey} (${money(spec.cents)}/month) [dry-run]`);
    return `price_dryrun_${spec.lookupKey}`;
  }
  const created = await ctx.stripe.post('/prices', {
    product,
    currency: 'usd',
    unit_amount: spec.cents,
    lookup_key: spec.lookupKey,
    transfer_lookup_key: true,
    tax_behavior: 'exclusive',
    nickname: spec.nickname,
    recurring: { interval: 'month', ...(spec.trialDays ? { trial_period_days: spec.trialDays } : {}) },
    metadata: { piggles_managed: 'true' },
  });
  await ctx.stripe.post(`/products/${product}`, { default_price: created.id });
  ctx.log(`  price   + ${spec.lookupKey} (${money(spec.cents)}/month)`);
  return created.id;
}

/** Find-or-create the email-send meter, keyed on `event_name`. An archived meter
 *  keeps its event name reserved, so a name collision is reported rather than
 *  worked around — reactivating the wrong meter silently changes what is counted. */
export async function ensureMeter(ctx, spec) {
  // `status` accepts `active` or `inactive` — there is no `all`, so both are read.
  const [active, inactive] = await Promise.all([
    ctx.stripe.get('/billing/meters', { limit: 100, status: 'active' }),
    ctx.stripe.get('/billing/meters', { limit: 100, status: 'inactive' }),
  ]);
  const existing = [...(active.data ?? []), ...(inactive.data ?? [])].find(
    (m) => m.event_name === spec.eventName
  );
  if (existing) {
    ctx.log(`  meter   ✓ ${spec.eventName} (${existing.id}, ${existing.status})`);
    return existing.id;
  }
  if (ctx.dryRun) {
    ctx.log(`  meter   + ${spec.eventName} [dry-run]`);
    return 'mtr_dryrun';
  }
  const created = await ctx.stripe.post('/billing/meters', {
    display_name: spec.displayName,
    event_name: spec.eventName,
    default_aggregation: { formula: 'sum' },
    customer_mapping: { type: 'by_id', event_payload_key: 'stripe_customer_id' },
    value_settings: { event_payload_key: 'value' },
  });
  ctx.log(`  meter   + ${spec.eventName} (${created.id})`);
  return created.id;
}

/** Find-or-create the customer-portal configuration, marked `piggles_managed`.
 *  Without one, `/v1/billing_portal/sessions` errors. See catalog.mjs for why
 *  `subscription_update` stays off. */
export async function ensurePortalConfig(ctx, spec) {
  const configs = await ctx.stripe.get('/billing_portal/configurations', { limit: 100 });
  const existing = configs.data?.find((c) => c.metadata?.piggles_managed === 'true');
  if (existing) {
    ctx.log(`  portal  ✓ configuration (${existing.id})`);
    return existing.id;
  }
  if (ctx.dryRun) {
    ctx.log('  portal  + configuration [dry-run]');
    return 'bpc_dryrun';
  }
  const created = await ctx.stripe.post('/billing_portal/configurations', {
    business_profile: {
      headline: spec.headline,
      privacy_policy_url: spec.privacyUrl,
      terms_of_service_url: spec.termsUrl,
    },
    features: {
      customer_update: { enabled: true, allowed_updates: ['email', 'name', 'address', 'phone', 'tax_id'] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: {
        enabled: true,
        mode: 'at_period_end',
        cancellation_reason: {
          enabled: true,
          options: ['too_expensive', 'missing_features', 'switched_service', 'unused', 'customer_service', 'other'],
        },
      },
      subscription_update: { enabled: false },
    },
    metadata: { piggles_managed: 'true' },
  });
  ctx.log(`  portal  + configuration (${created.id})`);
  return created.id;
}

/** Find-or-create the billing webhook endpoint, keyed on its URL. The signing
 *  secret is returned ONLY on creation — captured so the env block can print it,
 *  because there is no way to read it back afterwards. */
export async function ensureWebhook(ctx, url, events) {
  const endpoints = await ctx.stripe.get('/webhook_endpoints', { limit: 100 });
  const existing = endpoints.data?.find((e) => e.url === url);
  if (existing) {
    if (!ctx.dryRun) await ctx.stripe.post(`/webhook_endpoints/${existing.id}`, { enabled_events: events });
    ctx.log(`  webhook ✓ ${url} (${existing.id}) — secret unchanged, read it from the Dashboard`);
    return undefined;
  }
  if (ctx.dryRun) {
    ctx.log(`  webhook + ${url} [dry-run]`);
    return undefined;
  }
  const created = await ctx.stripe.post('/webhook_endpoints', {
    url,
    description: 'Piggles platform billing',
    enabled_events: events,
    metadata: { piggles_managed: 'true' },
  });
  ctx.log(`  webhook + ${url} (${created.id})`);
  return created.secret;
}
