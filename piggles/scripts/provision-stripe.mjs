// Provision the Piggles Stripe account from config/billing-plan.json.
//
//   PIGGLES_STRIPE_SECRET_KEY=sk_test_… node piggles/scripts/provision-stripe.mjs
//   …append `--dry-run` to see what would change without writing.
//
// ── ONE DEFINITION, TWO CONSUMERS ───────────────────────────────────────────
//
// This script and the running API read the SAME file. api-rest gets it as the
// BILLING_PLANS env value; this reads it off disk to drive Stripe. That is the whole
// reason the plan is JSON rather than code in either place — a price the product
// quotes and a price Stripe charges that come from two files eventually disagree,
// and the disagreement surfaces on somebody's invoice.
//
// ── PIGGLES HAS ITS OWN STRIPE ACCOUNT ──────────────────────────────────────
//
// Not a sub-account and not Connect — a separate account with its own keys, because
// the two products bill on incompatible models. Running both from one account would
// put fifteen module products in the same list as `piggles_base`, and the first
// mis-keyed price id would bill a bakery for B2B/Wholesale.
//
// Everything is idempotent: products by a deterministic id, prices by `lookup_key`,
// the meter by `event_name`, the portal config + webhook by a `piggles_managed`
// metadata marker. Safe to re-run after any edit to the plan.
//
// Zero dependencies — plain Node against Stripe's REST API, like the other scripts
// here, so it runs from the repo root with nothing installed for it.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const PLAN_PATH = join(HERE, '..', 'config', 'billing-plan.json');
const BASE_URL = 'https://api.stripe.com/v1';
const DRY_RUN = process.argv.includes('--dry-run');

// Where the Stripe key already lives for local dev. api-rest is the service that
// bills, so its `.env` is where a person has put these values already — asking them
// to export the same secret into a shell as well is friction that also writes it to
// shell history. A real environment variable still wins, so CI and a one-off
// `$env:PIGGLES_STRIPE_SECRET_KEY=…` both behave as before.
const ENV_FILE = process.env.PIGGLES_ENV_FILE ?? join(ROOT, 'wizeworks', 'services', 'api-rest', '.env');

/** Minimal dotenv: `KEY=value`, optional matching quotes, `#` comments. Never
 *  overrides a variable that is already set. */
function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(eq + 1).trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote) && value.length > 1) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(ENV_FILE);

/** SaaS, business use — so Stripe Tax can resolve a rate. */
const TAX_CODE = 'txcd_10103001';
const TRIAL_DAYS = 14;

// Customer-facing copy, keyed by the plan's product ids. It lives here rather than in
// the plan because nothing at runtime renders it — the console never shows a price or
// a plan name (BILLING_RULES.md), so this text exists only on a Stripe invoice.
const COPY = {
  piggles_base: {
    name: 'Piggles',
    description: 'Everything Piggles does, for one business. All apps included.',
    statementDescriptor: 'PIGGLES',
  },
  piggles_seat: {
    name: 'Extra team member',
    description: 'One more person on the team, beyond the 3 included.',
    unitLabel: 'team member',
  },
  piggles_location: {
    name: 'Extra location',
    description: 'One more place the business operates from, beyond the 1 included.',
    unitLabel: 'location',
  },
  piggles_site: {
    name: 'Extra site',
    description: 'One more website, beyond the 1 included.',
    unitLabel: 'site',
  },
  piggles_storage_10gb: {
    name: 'Storage, 10 GB',
    description: '10 GB more room for images, files and video, beyond the 25 GB included.',
    unitLabel: '10 GB block',
  },
  piggles_email_5k: {
    name: 'Email sends, 5,000 a month',
    description:
      '5,000 more marketing emails a month, beyond the 5,000 included. Order confirmations and password resets are never counted.',
    unitLabel: '5,000 sends',
  },
  piggles_contacts_10k: {
    name: 'Customer records, 10,000',
    description: '10,000 more customer records, beyond the 10,000 included.',
    unitLabel: '10k records',
  },
};

// Email is the one capacity meter that is a FLOW — real marginal cost per unit and
// real abuse exposure — so it is the one worth accumulating in Stripe from day one
// against a future usage price ("meter from day one, even before you bill on it").
// Storage, contacts and seats are STOCKS: a level at a moment, not events over a
// period. A Stripe meter can only sum or count, and summing a stock produces a number
// that means nothing, so those belong in our own usage table.
const METER = { eventName: 'piggles_email_send', displayName: 'Piggles email sends' };

const WEBHOOK_PATH = '/v1/public/webhooks/stripe/billing';
// Exactly what the shared billing webhook dispatches
// (wizeworks/services/api-rest/.../webhooks/stripe-billing.ts). More than that is
// just delivery attempts nobody reads.
const WEBHOOK_EVENTS = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  'customer.subscription.trial_will_end',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
];

const PORTAL = {
  headline: 'Piggles — your billing',
  privacyUrl: 'https://meetpiggles.com/privacy',
  termsUrl: 'https://meetpiggles.com/terms',
};

const log = (msg) => console.log(msg);
const money = (cents) => `$${(cents / 100).toFixed(2)}`;
const envOut = {};
let webhookSecret;

/** Flatten a nested value into Stripe's bracket form-encoding
 *  (`metadata[kind]=base`, `features[invoice_history][enabled]=true`). */
function encode(params, prefix = '', out = new URLSearchParams()) {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item !== null && typeof item === 'object') encode(item, `${name}[${i}]`, out);
        else out.append(`${name}[${i}]`, String(item));
      });
    } else if (typeof value === 'object') {
      encode(value, name, out);
    } else {
      out.append(name, String(value));
    }
  }
  return out;
}

function makeClient(secretKey) {
  async function call(method, path, params = {}) {
    const body = encode(params).toString();
    const res = await fetch(`${BASE_URL}${path}${method === 'GET' ? `?${body}` : ''}`, {
      method,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        ...(method === 'GET' ? {} : { 'Content-Type': 'application/x-www-form-urlencoded' }),
      },
      ...(method === 'GET' ? {} : { body }),
    });
    const json = await res.json();
    if (!res.ok) {
      const err = new Error(json?.error?.message ?? `Stripe returned ${res.status}`);
      err.code = json?.error?.code;
      throw err;
    }
    return json;
  }
  return { get: (p, q) => call('GET', p, q), post: (p, b) => call('POST', p, b) };
}

function copyFor(id) {
  const copy = COPY[id];
  if (!copy) throw new Error(`No product copy for "${id}" — add it to COPY.`);
  return copy;
}

/** Find-or-create a Product by its deterministic id. Copy is patched onto an existing
 *  one, so an edit above reaches Stripe on the next run. */
async function ensureProduct(stripe, id, metadata) {
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

/** Find-or-create a Price by `lookup_key`. Prices are immutable, so a changed amount
 *  mints a new price and MOVES the lookup key onto it — existing subscriptions stay on
 *  the old price until something migrates them, which is the correct default for a
 *  price change rather than a surprise re-rate.
 *
 *  The superseded price is then ARCHIVED. Deactivating a price stops it being used for
 *  anything NEW; subscriptions already on it keep billing untouched, so this is safe
 *  and it is what keeps the account readable — without it every price change leaves
 *  another live price behind and the list stops saying what Piggles charges. */
async function ensurePrice(stripe, product, spec) {
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

/** Find-or-create the email-send meter, keyed on `event_name`. `status` accepts only
 *  `active` or `inactive`, and an archived meter keeps its event name reserved — so
 *  both are read rather than assuming a missing active meter means none exists. */
async function ensureMeter(stripe) {
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

/** Find-or-create the customer-portal configuration. Without one,
 *  `/v1/billing_portal/sessions` errors.
 *
 *  `subscription_update` is deliberately DISABLED. There is ONE plan, so there is
 *  nothing to switch to; enabling it to expose quantity editing would put the base
 *  plan in the same list as the add-ons, leaving a customer one click from a
 *  subscription that bills Piggles twice. Adding and removing capacity is a narrow
 *  account-service endpoint instead, which is what "one tap, in place, at the moment
 *  of friction" requires anyway (BILLING_RULES.md). */
async function ensurePortalConfig(stripe) {
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
async function ensureWebhook(stripe, apiUrl) {
  const url = `${apiUrl.replace(/\/$/, '')}${WEBHOOK_PATH}`;
  const endpoints = await stripe.get('/webhook_endpoints', { limit: 100 });
  const existing = endpoints.data?.find((e) => e.url === url);
  if (existing) {
    if (!DRY_RUN) {
      await stripe.post(`/webhook_endpoints/${existing.id}`, { enabled_events: WEBHOOK_EVENTS });
    }
    return log(`  webhook ok ${url} (${existing.id}) — secret unchanged`);
  }
  if (DRY_RUN) return log(`  webhook +  ${url} [dry-run]`);
  const created = await stripe.post('/webhook_endpoints', {
    url,
    description: 'Piggles platform billing',
    enabled_events: WEBHOOK_EVENTS,
    metadata: { piggles_managed: 'true' },
  });
  webhookSecret = created.secret;
  log(`  webhook +  ${url} (${created.id})`);
}

/** What the base price includes, stamped on the product so an entitlement limit is
 *  readable off the subscription rather than off a constant that may disagree with
 *  what the customer was sold. */
function baseMetadata(plan) {
  const included = Object.entries(plan.included ?? {}).map(([k, v]) => [
    `included_${k}`,
    String(v),
  ]);
  return { kind: 'base', trial_days: String(TRIAL_DAYS), ...Object.fromEntries(included) };
}

function capacityMetadata(block) {
  return {
    kind: 'expansion',
    meter: block.key,
    block_size: String(block.blockSize),
    ...(block.blockUnit ? { block_unit: block.blockUnit } : {}),
  };
}

function printEnv(plan) {
  log('\n─────────────────────────────────────────────────────────────');
  log('Piggles billing env (api-rest / Secret Manager):\n');
  for (const key of Object.keys(envOut).sort()) log(`${key}=${envOut[key]}`);
  if (webhookSecret) log(`${plan.webhookSecretEnv}=${webhookSecret}`);
  else log(`# ${plan.webhookSecretEnv} — copy the endpoint secret from the Dashboard.`);
  log('\n# And the plan itself, which api-rest reads to know this account exists:');
  log(`BILLING_PLANS=[<contents of piggles/config/billing-plan.json>]`);
  log('─────────────────────────────────────────────────────────────');
}

async function main() {
  const plan = JSON.parse(readFileSync(PLAN_PATH, 'utf8'));
  const key = process.env[plan.secretEnv]?.trim();
  if (!key) {
    console.error(`x ${plan.secretEnv} is required — the PIGGLES account, not the sparx one.`);
    console.error(`  Set it in the environment, or in ${ENV_FILE}.`);
    process.exitCode = 1;
    return;
  }
  // "Unset" and "set to the placeholder from the docs" are different mistakes with
  // different fixes, and Stripe answers both with the same opaque "Invalid API Key".
  // Say which one it is, since only one of them means "go and copy the real key".
  if (!/^(sk|rk)_(test|live)_[A-Za-z0-9]{16,}$/.test(key)) {
    console.error(`x ${plan.secretEnv} does not look like a Stripe secret key.`);
    console.error(`  Got: ${key.slice(0, 12)}${key.length > 12 ? '…' : ''}`);
    console.error(`  Expected sk_test_… (or sk_live_…), from the Piggles sandbox:`);
    console.error(`  Stripe Dashboard - Developers - API keys. Set it in ${ENV_FILE}.`);
    process.exitCode = 1;
    return;
  }
  const apiUrl = process.env.PIGGLES_API_URL?.trim() ?? 'https://api.mypiggles.com';
  const stripe = makeClient(key);
  const mode = key.startsWith('sk_live') ? 'LIVE' : 'TEST';

  log(`\nProvisioning Piggles billing — ${mode} mode${DRY_RUN ? ' (dry-run)' : ''}\n`);

  log('Plan:');
  await ensureProduct(stripe, plan.base.product, baseMetadata(plan));
  envOut[plan.base.priceEnv] = await ensurePrice(stripe, plan.base.product, {
    ...plan.base,
    trialDays: TRIAL_DAYS,
  });

  log('\nCapacity:');
  for (const block of plan.capacity ?? []) {
    await ensureProduct(stripe, block.product, capacityMetadata(block));
    envOut[block.priceEnv] = await ensurePrice(stripe, block.product, block);
  }

  log('\nMeter, portal & webhook:');
  await ensureMeter(stripe);
  await ensurePortalConfig(stripe);
  await ensureWebhook(stripe, apiUrl);

  printEnv(plan);
  log(DRY_RUN ? '\nDry-run complete — nothing was written.\n' : '\nDone.\n');
}

main().catch((err) => {
  console.error('x Provisioning failed:', err.message ?? err);
  // exitCode rather than exit(): a hard exit while fetch sockets are still open
  // makes libuv print an assertion failure on Windows, which reads like a crash on
  // top of whatever actually went wrong.
  process.exitCode = 1;
});
