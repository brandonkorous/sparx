// BILLING_PLANS in the prod ConfigMap must equal the brand's own plan file.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
//
// A billing plan says how a tenant's bill is shaped AND which Stripe ACCOUNT it is
// raised in. The brand authors it (`<brand>/config/billing-plan.json`); api-rest
// reads it as the `BILLING_PLANS` env value, because api-rest is shared platform
// code and cannot import a brand's tree.
//
// That is two copies of one fact, and the failure mode is silent in the worst
// direction: change a price in the JSON, forget the ConfigMap, and the product
// quotes $10 while Stripe keeps charging $19. Nothing errors. Nobody notices until
// a customer reads an invoice.
//
// ── WHAT IT CHECKS ──────────────────────────────────────────────────────────
//
//   1. Every brand plan file appears in BILLING_PLANS, equal after normalisation
//      (the `$comment` block is stripped; key order is irrelevant).
//   2. BILLING_PLANS carries nothing EXTRA — a plan with no file behind it is a
//      definition nobody can review.
//   3. Each plan is well-formed the same way @wizeworks/billing validates at boot,
//      so a malformed plan fails at push rather than taking billing down on deploy.
//
// With `--secrets <env-file>` it checks the OTHER half instead: that every env var a
// plan NAMES (its Stripe key, its webhook signing secret, every price id) is present
// in the secrets the release is about to apply. The release runs it that way, because
// a plan configured against an account whose key never shipped is the exact shape of
// failure this repo keeps meeting — the deploy goes green, billing quietly no-ops,
// and the first to notice is a customer who cannot subscribe.
//
// Both scan roots are asserted to exist and both counts are printed. A check that
// silently scans nothing prints green and protects nothing.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIGMAP = join(ROOT, 'k8s', 'azure', 'infra', 'app-env-configmap.env');

const problems = [];

/** Every `<brand>/config/billing-plan.json` among the repo root's top-level dirs. */
function findPlanFiles() {
  const found = [];
  for (const entry of readdirSync(ROOT)) {
    if (entry.startsWith('.') || entry === 'node_modules') continue;
    const dir = join(ROOT, entry);
    if (!statSync(dir).isDirectory()) continue;
    const file = join(dir, 'config', 'billing-plan.json');
    if (existsSync(file)) {
      found.push({ file, label: `${entry}/config/billing-plan.json` });
    }
  }
  return found;
}

/** The `BILLING_PLANS` value out of the ConfigMap env file. Single-quoted, one line
 *  — the form dotenv and kustomize's env parser both accept. */
function readConfigMapValue() {
  if (!existsSync(CONFIGMAP)) {
    console.error(`\nx Cannot find ${CONFIGMAP}.`);
    console.error('  This check scans nothing without it, so it fails rather than passing.\n');
    process.exit(1);
  }
  const line = readFileSync(CONFIGMAP, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith('BILLING_PLANS='));
  if (!line) return null;
  const raw = line.slice('BILLING_PLANS='.length).trim();
  return raw.startsWith("'") && raw.endsWith("'") ? raw.slice(1, -1) : raw;
}

/** Drop the authoring comment and sort keys, so the comparison is about VALUES
 *  rather than formatting. */
function normalise(plan) {
  const { $comment, ...rest } = plan;
  void $comment;
  return JSON.stringify(rest, Object.keys(rest).sort());
}

/** The same shape @wizeworks/billing enforces at boot. Catching it here turns a
 *  deploy-time outage into a push-time error. */
function validate(plan, where) {
  for (const field of ['id', 'label', 'secretEnv', 'webhookSecretEnv']) {
    if (typeof plan[field] !== 'string' || plan[field].trim() === '') {
      problems.push(`${where}: missing "${field}"`);
    }
  }
  if (plan.shape !== 'per_module' && plan.shape !== 'flat') {
    problems.push(`${where}: shape is "${plan.shape}" (expected per_module or flat)`);
  }
  if (plan.shape === 'flat' && !plan.base?.priceEnv) {
    problems.push(`${where}: a flat plan needs base.priceEnv — there is nothing to charge`);
  }
  for (const block of plan.capacity ?? []) {
    if (!block.priceEnv || typeof block.monthlyCents !== 'number') {
      problems.push(`${where}: capacity block "${block.key}" needs priceEnv + monthlyCents`);
    }
  }
}

/** The variable NAMES defined in a dotenv-shaped file (values are never read). */
function envNames(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((l) => !l.trimStart().startsWith('#') && l.includes('='))
    .map((l) => l.slice(0, l.indexOf('=')).trim());
}

/** Every env var name the configured plans depend on. */
function requiredEnvNames(plans) {
  const names = new Set();
  for (const plan of plans) {
    if (plan?.secretEnv) names.add(plan.secretEnv);
    if (plan?.webhookSecretEnv) names.add(plan.webhookSecretEnv);
    if (plan?.base?.priceEnv) names.add(plan.base.priceEnv);
    for (const block of plan?.capacity ?? []) if (block?.priceEnv) names.add(block.priceEnv);
  }
  return [...names];
}

/** `--secrets <file>`: assert the release's assembled secrets carry every variable
 *  the configured plans name. Reads the plans from the ConfigMap, so it checks what
 *  will actually deploy rather than what happens to be on disk in a brand's tree. */
function checkSecrets(envFile) {
  if (!existsSync(envFile)) {
    console.error(`\nx Cannot find the secrets file ${envFile} — refusing to pass blind.\n`);
    process.exit(1);
  }
  const raw = readConfigMapValue();
  if (!raw) {
    console.log('✓ billing secrets: no plans configured, nothing to require');
    return;
  }
  // Satisfied from EITHER source. The Stripe key and the signing secret belong in
  // the vault, but a price id is not a secret and is a defensible ConfigMap value —
  // requiring the secrets file alone would fail a release that is correctly wired.
  const present = new Set([...envNames(envFile), ...envNames(CONFIGMAP)]);
  const required = requiredEnvNames(JSON.parse(raw));
  const missing = required.filter((name) => !present.has(name));
  if (missing.length > 0) {
    console.error(`\nx billing secrets — ${missing.length} of ${required.length} missing:\n`);
    for (const name of missing) console.error(`  · ${name}`);
    console.error(
      '\n  BILLING_PLANS names these, so a tenant on that plan cannot be billed' +
        '\n  without them. Add them to SPARX_APP_SECRETS_ENV — the provisioner' +
        '\n  prints the whole block: pnpm provision:piggles-stripe\n'
    );
    process.exit(1);
  }
  console.log(`✓ billing secrets: all ${required.length} plan-named variable(s) present`);
}

function main() {
  const planFiles = findPlanFiles();
  const raw = readConfigMapValue();

  if (planFiles.length === 0 && !raw) {
    console.log('✓ billing plans: none defined, none configured (single-brand deployment)');
    return;
  }

  let configured = [];
  if (raw) {
    try {
      configured = JSON.parse(raw);
    } catch (err) {
      problems.push(`BILLING_PLANS in the ConfigMap is not valid JSON: ${err.message}`);
    }
    if (!Array.isArray(configured)) {
      problems.push('BILLING_PLANS must be a JSON ARRAY of plans, even for a single plan');
      configured = [];
    }
  }

  const authored = new Map();
  for (const { file, label } of planFiles) {
    let plan;
    try {
      plan = JSON.parse(readFileSync(file, 'utf8'));
    } catch (err) {
      problems.push(`${label} is not valid JSON: ${err.message}`);
      continue;
    }
    validate(plan, label);
    authored.set(plan.id, { label, plan });
  }

  const byId = new Map(configured.map((p) => [p?.id, p]));

  for (const [id, { label, plan }] of authored) {
    const live = byId.get(id);
    if (!live) {
      problems.push(
        `plan "${id}" is authored in ${label} but absent from BILLING_PLANS — ` +
          'api-rest would throw for every tenant on it'
      );
      continue;
    }
    if (normalise(plan) !== normalise(live)) {
      problems.push(
        `plan "${id}" DIFFERS between ${label} and BILLING_PLANS — ` +
          'the price quoted and the price charged have drifted'
      );
    }
  }

  for (const plan of configured) {
    if (plan?.id && !authored.has(plan.id)) {
      problems.push(`BILLING_PLANS carries plan "${plan.id}" with no file behind it`);
    }
  }

  if (problems.length > 0) {
    console.error(`\nx billing plans — ${problems.length} problem(s):\n`);
    for (const p of problems) console.error(`  · ${p}`);
    console.error('\n  Regenerate the ConfigMap line with:');
    console.error('    node scripts/check-billing-plans.mjs --print\n');
    process.exit(1);
  }

  console.log(
    `✓ billing plans: ${authored.size} authored, ${configured.length} configured, in agreement`
  );
}

// `--print` emits the exact ConfigMap line, so fixing drift is a paste rather than
// hand-minifying JSON.
const secretsFlag = process.argv.indexOf('--secrets');
if (secretsFlag !== -1) {
  checkSecrets(process.argv[secretsFlag + 1] ?? '');
} else if (process.argv.includes('--print')) {
  const plans = findPlanFiles().map(({ file }) => {
    const { $comment, ...rest } = JSON.parse(readFileSync(file, 'utf8'));
    void $comment;
    return rest;
  });
  console.log(`BILLING_PLANS='${JSON.stringify(plans)}'`);
} else {
  main();
}
