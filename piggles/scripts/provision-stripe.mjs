// Provision the Piggles Stripe account — idempotent, and the only place the
// Piggles catalog is written down.
//
//   STRIPE_SECRET_KEY=sk_test_… node piggles/scripts/provision-stripe.mjs
//   STRIPE_SECRET_KEY=sk_test_… PIGGLES_API_URL=https://api.mypiggles.com \
//     node piggles/scripts/provision-stripe.mjs
//   …append `--dry-run` to see what would change without writing.
//
// ── PIGGLES HAS ITS OWN STRIPE ACCOUNT ──────────────────────────────────────
//
// Not a sub-account of sparx's and not a Connect account — a separate account with
// its own keys, because the two products bill on incompatible models. sparx sells
// modules and its catalog is generated from the module roster; Piggles sells one
// flat plan and must never grow tiers. Running both out of one account would put
// fifteen module products in the same list as `piggles_base`, and the first
// mis-keyed price id would bill a bakery for B2B/Wholesale.
//
// The consequence to remember: `STRIPE_SECRET_KEY` is singular in
// wizeworks/packages/billing. A process configured with sparx's key cannot create a
// Piggles customer, and vice versa — the account is chosen by which key the process
// holds, not by the tenant's `platformBrand`.
//
// ── WHAT THE MCP CANNOT DO ──────────────────────────────────────────────────
//
// Products, prices and webhook endpoints can be created through the Stripe MCP;
// billing meters and portal configurations cannot. This script covers all of it, so
// there is one command that takes an empty account to a complete one rather than a
// procedure split across two tools.

import { makeClient } from './stripe/api.mjs';
import { ensureMeter, ensurePortalConfig, ensurePrice, ensureProduct, ensureWebhook } from './stripe/ensure.mjs';
import { BASE, EXPANSIONS, INCLUDED, METER, PORTAL, TRIAL_DAYS, WEBHOOK_EVENTS, WEBHOOK_PATH } from './stripe/catalog.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const envOut = {};

/** The base product's metadata: what $49 includes, readable off the subscription
 *  rather than off a constant in a service that may disagree with it. */
function baseMetadata() {
  const included = Object.fromEntries(
    Object.entries(INCLUDED).map(([key, value]) => [`included_${key}`, String(value)])
  );
  return { kind: 'base', trial_days: String(TRIAL_DAYS), ...included };
}

/** An expansion's metadata: which meter it expands, and by how much. `meter`
 *  matches a key of `METERS` in @piggles/config. */
function expansionMetadata(item) {
  return {
    kind: 'expansion',
    meter: item.meter,
    meter_kind: item.meterKind,
    block_size: String(item.blockSize),
    ...(item.blockUnit ? { block_unit: item.blockUnit } : {}),
  };
}

async function provisionPlan(ctx) {
  ctx.log('Plan:');
  await ensureProduct(ctx, { ...BASE, metadata: baseMetadata() });
  const priceId = await ensurePrice(ctx, BASE.product, { ...BASE.price, trialDays: TRIAL_DAYS });
  envOut.PIGGLES_STRIPE_PRICE_BASE_MONTHLY = priceId;
}

async function provisionExpansions(ctx) {
  ctx.log('\nCapacity:');
  for (const item of EXPANSIONS) {
    await ensureProduct(ctx, { ...item, metadata: expansionMetadata(item) });
    const priceId = await ensurePrice(ctx, item.product, item.price);
    envOut[`PIGGLES_STRIPE_PRICE_${item.meter.toUpperCase()}`] = priceId;
  }
}

function printEnv(webhookSecret) {
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('Piggles billing env (Secret Manager / piggles-app-env):\n');
  for (const key of Object.keys(envOut).sort()) console.log(`${key}=${envOut[key]}`);
  if (webhookSecret) {
    console.log(`\n# Append to the EXISTING comma-separated value — do not replace it.`);
    console.log(`STRIPE_WEBHOOK_SECRET_BILLING=${webhookSecret}`);
  } else {
    console.log('# STRIPE_WEBHOOK_SECRET_BILLING — append the endpoint secret from the Dashboard.');
  }
  console.log('─────────────────────────────────────────────────────────────');
}

async function main() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    console.error('✖ STRIPE_SECRET_KEY is required — use the PIGGLES account, not sparx\'s.');
    process.exit(1);
  }
  const apiUrl = process.env.PIGGLES_API_URL?.trim() ?? 'https://api.mypiggles.com';
  const ctx = { stripe: makeClient(key), dryRun: DRY_RUN, log: (m) => console.log(m) };

  console.log(
    `\nProvisioning Piggles billing — ${key.startsWith('sk_live') ? 'LIVE' : 'TEST'} mode${DRY_RUN ? ' (dry-run)' : ''}\n`
  );

  await provisionPlan(ctx);
  await provisionExpansions(ctx);

  ctx.log('\nMeter, portal & webhook:');
  await ensureMeter(ctx, METER);
  await ensurePortalConfig(ctx, PORTAL);
  const secret = await ensureWebhook(ctx, `${apiUrl.replace(/\/$/, '')}${WEBHOOK_PATH}`, WEBHOOK_EVENTS);

  printEnv(secret);
  console.log(DRY_RUN ? '\nDry-run complete — nothing was written.\n' : '\nDone.\n');
}

main().catch((err) => {
  console.error('✖ Provisioning failed:', err.message ?? err);
  process.exit(1);
});
