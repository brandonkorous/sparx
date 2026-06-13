// Idempotent Stripe provisioner for platform billing (docs/92 §C3).
//
//   STRIPE_SECRET_KEY=sk_test_… pnpm --filter @sparx/billing provision-stripe
//   STRIPE_SECRET_KEY=sk_test_… SPARX_REST_URL=https://api.sparx.works \
//     pnpm --filter @sparx/billing provision-stripe
//   …append `--dry-run` to preview without writing.
//
// Creates / updates every Stripe object platform billing needs and prints the
// env block to paste into Secret Manager. Safe to re-run: products are keyed by a
// deterministic id, prices by `lookup_key`, the meter by `event_name`, and the
// portal config + webhook by a `sparx_managed` metadata marker — a second run
// reuses what exists instead of duplicating it.
//
// Uses the Stripe SDK directly (not the MCP), so it can create the billing meter
// and webhook endpoint the MCP allowlist can't (docs/92 §8). Drives prices off
// `MODULE_MONTHLY_CENTS` — the same source of truth the app reads — so the catalog
// can never drift from what's in Stripe. Annual = 10× monthly (two months free).

import Stripe from 'stripe';

import { MODULE_MONTHLY_CENTS } from '../src/price-catalog';
import type { ModuleSlug } from '@sparx/modules';

const API_VERSION = '2024-11-20.acacia';
const DRY_RUN = process.argv.includes('--dry-run');

// Human-facing product names (the env/price keys stay machine slugs).
const MODULE_NAMES: Partial<Record<ModuleSlug, string>> = {
  builder: 'Builder',
  commerce: 'Commerce',
  cms: 'CMS',
  crm: 'CRM',
  email: 'Email',
  b2b: 'B2B / Wholesale',
  ai: 'AI / MCP',
  dropship: 'Dropship',
  invoicing: 'Invoicing',
  chat: 'Live Chat',
};

const WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.trial_will_end',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
];

// Collected for the closing env-block printout.
const envOut: Record<string, string> = {};
let webhookSecret: string | undefined;

function log(msg: string): void {
  console.log(msg);
}

function isMissing(err: unknown): boolean {
  return err instanceof Stripe.errors.StripeInvalidRequestError && err.code === 'resource_missing';
}

/** Find-or-create a Product by a deterministic id (so re-runs don't duplicate). */
async function ensureProduct(stripe: Stripe, id: string, name: string): Promise<string> {
  try {
    const existing = await stripe.products.retrieve(id);
    if (existing.name !== name && !DRY_RUN) {
      await stripe.products.update(id, { name });
    }
    log(`  product ✓ ${id} (${name})`);
    return existing.id;
  } catch (err) {
    if (!isMissing(err)) throw err;
    if (DRY_RUN) {
      log(`  product + ${id} (${name}) [dry-run]`);
      return id;
    }
    const created = await stripe.products.create({ id, name });
    log(`  product + ${id} (${name})`);
    return created.id;
  }
}

interface PriceSpec {
  lookupKey: string;
  product: string;
  unitAmount: number;
  interval: 'month' | 'year';
  metered?: { meter: string };
}

/** Find-or-create a Price by lookup_key. Prices are immutable, so if one already
 *  carries the key with the same amount/interval/currency we reuse it; otherwise we
 *  create a fresh price and move the lookup_key onto it (`transfer_lookup_key`). */
async function ensurePrice(stripe: Stripe, spec: PriceSpec): Promise<string> {
  const found = await stripe.prices.list({ lookup_keys: [spec.lookupKey], limit: 1 });
  const match = found.data[0];
  const matches =
    match &&
    match.active &&
    match.unit_amount === spec.unitAmount &&
    match.currency === 'usd' &&
    match.recurring?.interval === spec.interval &&
    (spec.metered ? match.recurring?.usage_type === 'metered' : true);
  if (matches) {
    log(`  price   ✓ ${spec.lookupKey} ($${(spec.unitAmount / 100).toFixed(2)}/${spec.interval})`);
    return match.id;
  }
  if (DRY_RUN) {
    log(
      `  price   + ${spec.lookupKey} ($${(spec.unitAmount / 100).toFixed(2)}/${spec.interval}) [dry-run]`
    );
    return `price_dryrun_${spec.lookupKey}`;
  }
  const created = await stripe.prices.create({
    product: spec.product,
    currency: 'usd',
    unit_amount: spec.unitAmount,
    lookup_key: spec.lookupKey,
    transfer_lookup_key: true,
    recurring: {
      interval: spec.interval,
      ...(spec.metered ? { usage_type: 'metered' as const, meter: spec.metered.meter } : {}),
    },
  });
  log(`  price   + ${spec.lookupKey} ($${(spec.unitAmount / 100).toFixed(2)}/${spec.interval})`);
  return created.id;
}

/** Find-or-create the `transaction_fee` Billing Meter (docs/92 §3). */
async function ensureMeter(stripe: Stripe): Promise<string> {
  const meters = await stripe.billing.meters.list({ status: 'active', limit: 100 });
  const existing = meters.data.find((m) => m.event_name === 'transaction_fee');
  if (existing) {
    log(`  meter   ✓ transaction_fee (${existing.id})`);
    return existing.id;
  }
  if (DRY_RUN) {
    log('  meter   + transaction_fee [dry-run]');
    return 'mtr_dryrun_transaction_fee';
  }
  const created = await stripe.billing.meters.create({
    display_name: 'Transaction Fees',
    event_name: 'transaction_fee',
    default_aggregation: { formula: 'sum' },
    customer_mapping: { type: 'by_id', event_payload_key: 'stripe_customer_id' },
    value_settings: { event_payload_key: 'value' },
  });
  log(`  meter   + transaction_fee (${created.id})`);
  return created.id;
}

/** Find-or-create the customer-portal configuration (docs/92 §6, §C4). Marked with
 *  `sparx_managed` so re-runs find it. Without one, `/v1/billing/portal` errors.
 *  `subscription_update` is enabled over the module products (both intervals) so a
 *  tenant can switch monthly↔annual and swap modules self-serve in the portal — the
 *  "choose plan" capability, done the Stripe-native way (no custom billing UI). The
 *  transaction-fee + managed-hosting prices are deliberately excluded so a tenant
 *  can't self-remove the fee rail or self-add enterprise hosting. */
async function ensurePortalConfig(
  stripe: Stripe,
  moduleProducts: { product: string; prices: string[] }[]
): Promise<string> {
  const configs = await stripe.billingPortal.configurations.list({ limit: 100 });
  const existing = configs.data.find((c) => c.metadata?.sparx_managed === 'true');
  if (existing) {
    log(`  portal  ✓ configuration (${existing.id})`);
    return existing.id;
  }
  if (DRY_RUN) {
    log('  portal  + configuration [dry-run]');
    return 'bpc_dryrun';
  }
  const created = await stripe.billingPortal.configurations.create({
    business_profile: { headline: 'Sparx — manage your subscription' },
    features: {
      customer_update: { enabled: true, allowed_updates: ['email', 'address', 'tax_id'] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: 'at_period_end' },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ['price'],
        proration_behavior: 'create_prorations',
        products: moduleProducts,
      },
    },
    metadata: { sparx_managed: 'true' },
  });
  log(`  portal  + configuration (${created.id})`);
  return created.id;
}

/** Find-or-create the billing webhook endpoint. The signing secret is only
 *  returned on creation — captured for the env printout. */
async function ensureWebhook(stripe: Stripe, apiUrl: string): Promise<void> {
  const url = `${apiUrl.replace(/\/$/, '')}/v1/public/webhooks/stripe/billing`;
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  const existing = endpoints.data.find((e) => e.url === url);
  if (existing) {
    log(`  webhook ✓ ${url} (${existing.id}) — secret unchanged (set already?)`);
    return;
  }
  if (DRY_RUN) {
    log(`  webhook + ${url} [dry-run]`);
    return;
  }
  const created = await stripe.webhookEndpoints.create({
    url,
    enabled_events: WEBHOOK_EVENTS,
    description: 'Sparx platform billing',
    metadata: { sparx_managed: 'true' },
  });
  webhookSecret = created.secret;
  log(`  webhook + ${url} (${created.id})`);
}

async function main(): Promise<void> {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    console.error('✖ STRIPE_SECRET_KEY is required (use a sandbox key first).');
    process.exit(1);
  }
  const apiUrl = process.env.SPARX_REST_URL?.trim();
  const stripe = new Stripe(key, { apiVersion: API_VERSION as Stripe.LatestApiVersion });
  const mode = key.startsWith('sk_live') ? 'LIVE' : 'TEST';

  log(`\nProvisioning Stripe platform billing — ${mode} mode${DRY_RUN ? ' (dry-run)' : ''}\n`);

  // 1) Module products + monthly/annual prices.
  log('Modules:');
  const moduleProducts: { product: string; prices: string[] }[] = [];
  for (const [slug, monthly] of Object.entries(MODULE_MONTHLY_CENTS) as [ModuleSlug, number][]) {
    const name = MODULE_NAMES[slug] ?? slug;
    const product = await ensureProduct(stripe, `sparx_${slug}`, `Sparx ${name}`);
    const monthlyId = await ensurePrice(stripe, {
      lookupKey: `sparx_${slug}_monthly`,
      product,
      unitAmount: monthly,
      interval: 'month',
    });
    const annualId = await ensurePrice(stripe, {
      lookupKey: `sparx_${slug}_annual`,
      product,
      unitAmount: monthly * 10, // two months free
      interval: 'year',
    });
    envOut[`STRIPE_PRICE_${slug.toUpperCase()}_MONTHLY`] = monthlyId;
    envOut[`STRIPE_PRICE_${slug.toUpperCase()}_ANNUAL`] = annualId;
    moduleProducts.push({ product, prices: [monthlyId, annualId] });
  }

  // 2) Transaction-fee meter + $0.01 metered price (docs/92 §3).
  log('\nTransaction fee:');
  const meter = await ensureMeter(stripe);
  const feeProduct = await ensureProduct(stripe, 'sparx_transaction_fee', 'Sparx Transaction Fees');
  const feePrice = await ensurePrice(stripe, {
    lookupKey: 'sparx_transaction_fee',
    product: feeProduct,
    unitAmount: 1, // $0.01/unit; we meter the fee in cents
    interval: 'month',
    metered: { meter },
  });
  envOut.STRIPE_PRICE_TRANSACTION_FEE = feePrice;

  // 3) Managed hosting (enterprise, Phase 8).
  log('\nManaged hosting:');
  const hostingProduct = await ensureProduct(
    stripe,
    'sparx_managed_hosting',
    'Sparx Managed Hosting'
  );
  const hostingPrice = await ensurePrice(stripe, {
    lookupKey: 'sparx_managed_hosting_monthly',
    product: hostingProduct,
    unitAmount: 75_000,
    interval: 'month',
  });
  envOut.STRIPE_PRICE_MANAGED_HOSTING_MONTHLY = hostingPrice;

  // 4) Portal config + webhook.
  log('\nPortal & webhook:');
  await ensurePortalConfig(stripe, moduleProducts);
  if (apiUrl) {
    await ensureWebhook(stripe, apiUrl);
  } else {
    log('  webhook ⤬ skipped — set SPARX_REST_URL to provision (e.g. https://api.sparx.works)');
  }

  // 5) Env block.
  log('\n─────────────────────────────────────────────────────────────');
  log('Secret Manager values (paste into the billing env):\n');
  for (const k of Object.keys(envOut).sort()) log(`${k}=${envOut[k]}`);
  if (webhookSecret) log(`STRIPE_WEBHOOK_SECRET_BILLING=${webhookSecret}`);
  else log('# STRIPE_WEBHOOK_SECRET_BILLING=<copy from the Stripe Dashboard webhook>');
  log('─────────────────────────────────────────────────────────────');
  log(
    DRY_RUN
      ? '\nDry-run complete — nothing was written.\n'
      : '\nDone. Set the values above in Secret Manager, then roll api-rest.\n'
  );
}

main().catch((err: unknown) => {
  console.error('✖ Provisioning failed:', err);
  process.exit(1);
});
