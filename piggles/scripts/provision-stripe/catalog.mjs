// The Piggles catalog in Stripe: products by deterministic id, prices by lookup key.

import { copyFor, TAX_CODE, TRIAL_DAYS } from './copy.mjs';
import { DRY_RUN, log, money } from './env.mjs';

/** Find-or-create a Product by its deterministic id. Copy is patched onto an existing
 *  one, so an edit above reaches Stripe on the next run. */
export async function ensureProduct(stripe, id, metadata) {
  const copy = copyFor(id);
  const body = {
    name: copy.name,
    description: copy.description,
    tax_code: TAX_CODE,
    metadata: { piggles_managed: 'true', ...metadata },
    ...(copy.unitLabel ? { unit_label: copy.unitLabel } : {}),
    ...(copy.statementDescriptor ? { statement_descriptor: copy.statementDescriptor } : {}),
  };
  try {
    await stripe.get(`/products/${id}`);
    if (!DRY_RUN) await stripe.post(`/products/${id}`, body);
    log(`  product ok ${id} (${copy.name})`);
  } catch (err) {
    if (err.code !== 'resource_missing') throw err;
    if (DRY_RUN) return log(`  product +  ${id} (${copy.name}) [dry-run]`);
    await stripe.post('/products', { id, ...body });
    log(`  product +  ${id} (${copy.name})`);
  }
}

/** True when an existing price is exactly the one the plan asks for. */
function priceMatches(price, cents, trialDays) {
  return Boolean(
    price?.active &&
    price.unit_amount === cents &&
    price.currency === 'usd' &&
    price.recurring?.interval === 'month' &&
    (price.recurring?.trial_period_days ?? null) === (trialDays ?? null)
  );
}

/** Find-or-create a Price by `lookup_key`. A changed amount mints a new price,
 *  moves the key onto it and archives the old one; subscriptions on the old price
 *  keep billing until something migrates them. */
export async function ensurePrice(stripe, product, spec) {
  const found = await stripe.get('/prices', { 'lookup_keys[0]': spec.lookupKey, limit: 1 });
  const existing = found.data?.[0];
  if (priceMatches(existing, spec.monthlyCents, spec.trialDays)) {
    log(`  price   ok ${spec.lookupKey} (${money(spec.monthlyCents)}/month)`);
    return existing.id;
  }
  if (DRY_RUN) {
    const replaces = existing ? ` (replaces ${existing.id}, which would be archived)` : '';
    log(`  price   +  ${spec.lookupKey} (${money(spec.monthlyCents)}/month)${replaces} [dry-run]`);
    return `price_dryrun_${spec.lookupKey}`;
  }
  const created = await stripe.post('/prices', {
    product,
    currency: 'usd',
    unit_amount: spec.monthlyCents,
    lookup_key: spec.lookupKey,
    transfer_lookup_key: true,
    tax_behavior: 'exclusive',
    nickname: `${copyFor(product).name} — ${money(spec.monthlyCents)}/month`,
    recurring: {
      interval: 'month',
      ...(spec.trialDays ? { trial_period_days: spec.trialDays } : {}),
    },
    metadata: { piggles_managed: 'true' },
  });
  await stripe.post(`/products/${product}`, { default_price: created.id });
  if (existing) {
    await stripe.post(`/prices/${existing.id}`, { active: false });
    log(`  price   -  ${existing.id} (${money(existing.unit_amount)}/month) archived`);
  }
  log(`  price   +  ${spec.lookupKey} (${money(spec.monthlyCents)}/month)`);
  return created.id;
}

/** What the base price includes, stamped on the product so a limit is readable
 *  off the subscription rather than off a constant that may disagree with it. */
export function baseMetadata(plan) {
  const included = Object.entries(plan.included ?? {}).map(([k, v]) => [
    `included_${k}`,
    String(v),
  ]);
  return { kind: 'base', trial_days: String(TRIAL_DAYS), ...Object.fromEntries(included) };
}

export function capacityMetadata(block) {
  return {
    kind: 'expansion',
    meter: block.key,
    block_size: String(block.blockSize),
    ...(block.blockUnit ? { block_unit: block.blockUnit } : {}),
  };
}
