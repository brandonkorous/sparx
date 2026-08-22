#!/usr/bin/env node
/**
 * Fails when SHARED code puts a product's name into text a person reads.
 *
 * sparx and Piggles are two BRANDS on one platform, one database and one tenant
 * pool. `Tenant.platformBrand` records which, and it is a TENANT column rather
 * than a deployment setting precisely because the readers that need it most --
 * the `email.send` worker consuming a Pub/Sub event, an edge OG route, the
 * Stripe webhook -- have no request context to infer it from.
 *
 * So a literal product name inside `wizeworks/packages` is wrong by
 * construction: that code serves both brands, and the string can only ever be
 * right for one of them. It reaches people in three ways, worst first:
 *
 *   1. A tenant's own customers -- a starter site footer, a published policy.
 *   2. The operator             -- "sparx cannot place the call", on a screen
 *                                  whose every other word says Piggles.
 *   3. Their inbox              -- "You earned a commission on sparx".
 *
 * `@wizeworks/brand-core` already solves this: `platformBrandIdentity(brand).name`
 * returns the product's name as a person reads it, configured rather than
 * computed, because sparx is deliberately lowercase and Piggles deliberately
 * capitalised. The strings this check finds simply bypass it.
 *
 * WHAT TO DO WHEN THIS FAILS. Three right answers, and "add it to the debt
 * list" is not one of them:
 *
 *   REMOVE the name   Most prose does not need it. "This is starter wording,
 *                     not legal advice" says everything "provided by sparx"
 *                     did, and is true in both products.
 *   RESOLVE the name  When the thing genuinely IS branded -- sparx Pay has a
 *                     sibling called Piggles Pay -- take it from
 *                     platformBrandIdentity(brand).name.
 *   ALLOW it          Only when the string names a SPECIFIC product that exists
 *                     under one brand alone (sparx.market), or is not
 *                     user-facing at all (an env var, a DMARC record, an RLS
 *                     role, an iCal PRODID). Add it to ALLOWED with a reason.
 *
 * DEBT is the set that existed when this check was written. It may SHRINK and
 * never grow. A string in neither list fails the build.
 *
 * ---------------------------------------------------------------------------
 * WHERE THIS STANDS (2026-08-21)
 * ---------------------------------------------------------------------------
 *
 * 102 when the check was written, 79 after the first pass, 61 now.
 *
 * PAYMENTS IS DONE. It was the awkward one and the reason the count sat still:
 * `GATEWAY_CATALOG` was a static readonly array served over an API mirror, so
 * there was no brand in scope where the strings were written. What forced it was
 * a persona — a Piggles bakery opening the provider picker to choose who handles
 * her money, and reading "No sparx fee" seven times down one page.
 *
 * The shape that worked is the one this header predicted, and it is worth
 * copying for the rest:
 *
 *   · The data carries a `{platform}` token (`PLATFORM_TOKEN` in
 *     @wizeworks/brand-core) instead of a name.
 *   · `gatewayCatalog(brand)` and `getGatewayDescriptor(id, brand)` resolve it.
 *   · THE RAW ARRAY IS NOT EXPORTED. That is what closes the trap this header
 *     warned about — a caller cannot forget to resolve, because there is no
 *     unresolved value to reach. The one boot-time consumer that genuinely has
 *     no brand (the integration registry, built once for every brand at once)
 *     goes through `gatewayCatalogTemplate()`, named to be alarming, and the
 *     ROUTE that serves those descriptors resolves per tenant.
 *   · "sparx Pay" was a RESOLVE, not a REMOVE — Piggles Pay is its sibling. Its
 *     `id` stays `sparx_pay`: a wire value and a stored column, seen by nobody.
 *
 * What is left, heaviest first:
 *
 *   builder (~11)   MCP tool descriptions and authoring vocabulary. Read by an
 *                   agent rather than a person, but they teach it to write
 *                   "sparx" into a tenant's site. Worth doing, low risk.
 *   commerce-       Onboarding/import copy. Straight REMOVE, same as the first
 *     schemas (~8)  23 that went.
 *   db/seed         Demo content naming sparx. Harmless in prod (seed only),
 *                   but it is what a new Piggles demo tenant would read.
 *   the rest        sparx.market and its settlement mail -- ALLOWED, a real
 *                   first-party product under one brand. Do not "fix" these.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolved from this file, never by counting '..' from the cwd -- a check that
// guesses its own root is one move away from scanning nothing and printing OK.
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// Shared code only. An app under sparx/ or piggles/ serves ONE brand and may
// name it; these packages serve both and may not.
const SCAN_ROOTS = ['wizeworks/packages'];

const BRANDS = ['sparx', 'piggles'];

// Substrings that make a literal legitimately brand-named or not user-facing.
// Each one is a decision, not a convenience.
const ALLOWED_PATTERNS = [
  // sparx.market is a REAL first-party marketplace that exists under the sparx
  // brand alone; Piggles hides the surface entirely. Naming it is correct.
  'sparx.market',
  'sparx_market',
  // Infrastructure and wire formats. Never rendered to anyone.
  'SPARX_',
  'sparx_owner',
  'sparx_app',
  'X-sparx',
  'x-sparx',
  '@sparx/',
  '@wizeworks/',
  'sparx.works',
  'sparx.email',
  'sparx.>',
  'noreply@',
  'dmarc@',
  'WizeWorks//',
  // CSS class prefixes emitted into markup, not words.
  'sparx-callout',
  'sparx-embed',
  'sparx-content',
];

const DEBT_FILE = join(ROOT, 'scripts', 'platform-brand-debt.txt');

function stripComments(src) {
  let out = '';
  let state = null;
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    const n = src[i + 1] ?? '';
    if (state === null) {
      if (c === '/' && n === '/') {
        state = 'line';
        i += 1;
        continue;
      }
      if (c === '/' && n === '*') {
        state = 'block';
        i += 1;
        continue;
      }
      out += c;
    } else if (state === 'line') {
      if (c === '\n') {
        state = null;
        out += c;
      }
    } else if (c === '*' && n === '/') {
      state = null;
      i += 1;
    }
  }
  return out;
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.tsx?$/.test(entry) && !entry.endsWith('.d.ts') && !entry.includes('.test.')) {
      files.push(full);
    }
  }
  return files;
}

const LITERAL = /(['"`])([^'"`\n]{2,400}?)\1/g;

// A literal only counts when it reads like something somebody could see. A bare
// identifier or a path is not prose.
function isProse(lit) {
  if (!lit.includes(' ')) return false;
  if (/^[@./]/.test(lit) || /^https?:/.test(lit)) return false;
  return true;
}

function scan() {
  const found = [];
  let scanned = 0;
  for (const root of SCAN_ROOTS) {
    const abs = join(ROOT, root);
    // Assert the root EXISTS. A tree move that silently empties this check is
    // exactly how sibling checks came to scan nothing and report green.
    if (!existsSync(abs)) {
      console.error('\nBrand check FAILED: scan root is missing: ' + root);
      console.error('  A moved or renamed tree makes this check blind. Fix the path.\n');
      process.exit(1);
    }
    for (const file of walk(abs)) {
      scanned += 1;
      const src = stripComments(readFileSync(file, 'utf8'));
      for (const m of src.matchAll(LITERAL)) {
        const lit = m[2].trim();
        const low = lit.toLowerCase();
        if (!BRANDS.some((b) => low.includes(b))) continue;
        if (!isProse(lit)) continue;
        if (ALLOWED_PATTERNS.some((a) => lit.includes(a))) continue;
        found.push({ file: relative(ROOT, file).split(sep).join('/'), lit });
      }
    }
  }
  return { found, scanned };
}

const { found, scanned } = scan();
const unique = [...new Set(found.map((f) => f.lit))].sort();

if (process.argv.includes('--update')) {
  writeFileSync(DEBT_FILE, unique.join('\n') + '\n', 'utf8');
  console.log('Wrote ' + unique.length + ' known string(s) to ' + relative(ROOT, DEBT_FILE));
  process.exit(0);
}

const debt = existsSync(DEBT_FILE)
  ? new Set(
      readFileSync(DEBT_FILE, 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
    )
  : new Set();

const fresh = found.filter((f) => !debt.has(f.lit));
const fixed = [...debt].filter((d) => !unique.includes(d));

// The denominator, always. A count with no total is unreadable as progress and
// hides a check that has stopped looking at anything.
console.log(
  'Brand check: ' +
    scanned +
    ' shared file(s) scanned, ' +
    unique.length +
    ' brand-named string(s) found, ' +
    debt.size +
    ' known.'
);

if (fresh.length > 0) {
  console.error(
    '\nBrand check FAILED: ' + fresh.length + ' NEW brand-named string(s) in shared code.\n'
  );
  for (const f of fresh) console.error('  ' + f.file + '\n    ' + f.lit + '\n');
  console.error('  Shared packages serve BOTH brands, so a literal name is wrong in one of');
  console.error('  them at all times. Remove the name, or resolve it from');
  console.error('  platformBrandIdentity(brand).name. See the header of this script.\n');
  process.exit(1);
}

if (fixed.length > 0) {
  console.log(
    '\n' + fixed.length + ' known string(s) are gone. Run --update to bank the progress:'
  );
  for (const f of fixed.slice(0, 20)) console.log('  - ' + f);
}
console.log('OK: no new brand-named strings in shared code.');
