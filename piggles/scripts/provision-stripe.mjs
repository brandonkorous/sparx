// Provision the Piggles Stripe account from config/billing-plan.json.
//   PIGGLES_STRIPE_SECRET_KEY=sk_test_… node piggles/scripts/provision-stripe.mjs [--dry-run]
// api-rest reads the same plan file (BILLING_PLANS), so the two cannot disagree.

// Piggles has its OWN Stripe account (not Connect), because the two products bill
// on incompatible models. Every step is idempotent and safe to re-run.

import { readFileSync } from 'node:fs';

import { ensureMeter, ensurePortalConfig, ensureWebhook } from './provision-stripe/account.mjs';
import {
  baseMetadata,
  capacityMetadata,
  ensurePrice,
  ensureProduct,
} from './provision-stripe/catalog.mjs';
import { makeClient } from './provision-stripe/client.mjs';
import { TRIAL_DAYS } from './provision-stripe/copy.mjs';
import { ensureOfferCoupon } from './provision-stripe/coupon.mjs';
import { DRY_RUN, ENV_FILE, loadEnvFile, log, PLAN_PATH } from './provision-stripe/env.mjs';

loadEnvFile(ENV_FILE);

function printEnv(plan, envOut, webhookSecret) {
  log('\n─────────────────────────────────────────────────────────────');
  log('Piggles billing env (api-rest / Secret Manager):\n');
  for (const key of Object.keys(envOut).sort()) log(`${key}=${envOut[key]}`);
  if (webhookSecret) log(`${plan.webhookSecretEnv}=${webhookSecret}`);
  else log(`# ${plan.webhookSecretEnv}: copy the endpoint secret from the Dashboard.`);
  log('\n# And the plan itself, which api-rest reads to know this account exists:');
  log(`BILLING_PLANS=[<contents of piggles/config/billing-plan.json>]`);
  log('─────────────────────────────────────────────────────────────');
}

/** The key, or null after saying which of the two mistakes it is: unset, or the
 *  placeholder from the docs. Stripe answers both with one opaque error. */
function readKey(plan) {
  const key = process.env[plan.secretEnv]?.trim();
  if (!key) {
    console.error(`x ${plan.secretEnv} is required: the PIGGLES account, not the sparx one.`);
    console.error(`  Set it in the environment, or in ${ENV_FILE}.`);
    return null;
  }
  if (!/^(sk|rk)_(test|live)_[A-Za-z0-9]{16,}$/.test(key)) {
    console.error(`x ${plan.secretEnv} does not look like a Stripe secret key.`);
    console.error(`  Got: ${key.slice(0, 12)}${key.length > 12 ? '…' : ''}`);
    console.error(`  Expected sk_test_… (or sk_live_…), from the Piggles sandbox:`);
    console.error(`  Stripe Dashboard - Developers - API keys. Set it in ${ENV_FILE}.`);
    return null;
  }
  return key;
}

async function provisionCatalog(stripe, plan, envOut) {
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

  log('\nOffer:');
  await ensureOfferCoupon(stripe, plan);
}

async function main() {
  const plan = JSON.parse(readFileSync(PLAN_PATH, 'utf8'));
  const key = readKey(plan);
  if (!key) {
    process.exitCode = 1;
    return;
  }
  const apiUrl = process.env.PIGGLES_API_URL?.trim() ?? 'https://api.mypiggles.com';
  const stripe = makeClient(key);
  const mode = key.startsWith('sk_live') ? 'LIVE' : 'TEST';
  const envOut = {};

  log(`\nProvisioning Piggles billing, ${mode} mode${DRY_RUN ? ' (dry-run)' : ''}\n`);
  await provisionCatalog(stripe, plan, envOut);

  log('\nMeter, portal & webhook:');
  await ensureMeter(stripe);
  await ensurePortalConfig(stripe);
  const webhookSecret = await ensureWebhook(stripe, apiUrl);

  printEnv(plan, envOut, webhookSecret);
  log(DRY_RUN ? '\nDry-run complete. Nothing was written.\n' : '\nDone.\n');
}

main().catch((err) => {
  console.error('x Provisioning failed:', err.message ?? err);
  // exitCode, not exit(): a hard exit with fetch sockets open makes libuv print an
  // assertion failure on Windows, which reads like a crash on top of the real error.
  process.exitCode = 1;
});
