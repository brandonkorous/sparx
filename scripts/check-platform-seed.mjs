#!/usr/bin/env node
// check:platform-seed — platform data written as code that never reaches a
// database.
//
// THE FAILURE THIS CATCHES. Some platform content is authored as a TypeScript
// array and is meant to become rows: the builder's component catalog, the
// starter legal pages, the built-in product types. Nothing about an exported
// array makes it arrive anywhere. If no deploy stage applies it, editing the
// array changes NOTHING on any database, and every check stays green while the
// screen that reads those rows shows something else.
//
// It has happened three times in this repo:
//
//   · marketplace_themes held ZERO rows in production while 20 theme bundles sat
//     committed, and /market/themes served its empty state for a month. That is
//     the failure prisma/platform-seed.ts was written to end.
//   · BUILT_IN_PRODUCT_TYPES reached the database once, through migration
//     20270206000000, whose own comment asks the next person to "keep the two in
//     lockstep". Nobody could: a migration runs once. The icons drifted first
//     (a symbol in the array, the NAME of one in the rows) and were patched by a
//     SECOND migration; then the descriptions drifted, and eight strings sat
//     wrong on every deployed database with the fix committed in the repo.
//
// WHAT IT ASSERTS. Every entry in PLATFORM_DATA below must be imported by
// prisma/platform-seed.ts — the deploy's data stage, which runs on every push to
// main. An entry that is deliberately applied somewhere else says so, in the
// table, with the reason; that is the difference between a documented exception
// and a gap nobody has noticed yet.
//
// ADDING PLATFORM CONTENT? Add it here at the same time. The check is what turns
// "somebody should seed this" into a red push.

import { readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve the repo root from THIS FILE, never by counting `..` from the cwd:
// a check run from the wrong directory that scans nothing prints green.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SEED = 'wizeworks/packages/db/prisma/platform-seed.ts';

/**
 * Platform content authored as code.
 *
 * `source` is where the array is defined, so a rename or a tree move fails here
 * rather than quietly dropping the entry. `seededElsewhere` is the ONLY way to
 * be exempt from the seeder, and it must carry a reason a reader can check.
 */
const PLATFORM_DATA = [
  {
    name: 'PLATFORM_CATALOG',
    source: 'wizeworks/packages/builder-schemas/src/catalog',
    what: 'the global builder component library',
  },
  {
    name: 'LEGAL_TEMPLATES',
    source: 'wizeworks/packages/legal-templates/src',
    what: 'the starter legal pages every tenant is owed',
  },
  {
    name: 'BUILT_IN_PRODUCT_TYPES',
    source: 'wizeworks/packages/commerce-schemas/src/product-types/builtins',
    what: 'the starter product-type vocabulary every tenant sees',
  },
  {
    name: 'FIRST_PARTY_THEMES',
    source: 'wizeworks/packages/silica-catalog/src/first-party-themes.ts',
    what: 'the marketplace theme bundles',
    seededElsewhere:
      'api-rest publishes all four marketplace categories at BOOT, into the same rows a ' +
      'licensed collaborator upload writes (services/api-rest/src/lib/marketplace/self-register.ts, docs/85 §14). ' +
      'platform-seed.ts says so in its own header and deliberately has no marketplace step.',
  },
  {
    name: 'FIRST_PARTY_COMPONENTS',
    source: 'wizeworks/packages/silica-catalog/src/first-party-components.ts',
    what: 'the marketplace component listings',
    seededElsewhere: 'Same boot-time publisher as FIRST_PARTY_THEMES, in the same pass.',
  },
];

function requirePath(rel, note) {
  const full = join(ROOT, rel);
  try {
    statSync(full);
    return full;
  } catch {
    console.error(`✗ check:platform-seed — path is missing: ${rel}`);
    console.error(`  ${note}`);
    console.error(
      '  A check that scans nothing prints green. Fix the path, do not delete the entry.'
    );
    process.exit(1);
  }
}

const seedText = readFileSync(
  requirePath(SEED, 'This is the deploy stage the check is about.'),
  'utf8'
);

// Floor, so a file that has been emptied or replaced fails instead of passing.
if (!seedText.includes('seedPlatformData')) {
  console.error(`✗ check:platform-seed — ${SEED} no longer defines seedPlatformData.`);
  console.error('  The scan has gone blind; it has not gone clean.');
  process.exit(1);
}

const missing = [];
let checked = 0;
let exempt = 0;

for (const entry of PLATFORM_DATA) {
  requirePath(entry.source, `Where ${entry.name} is defined.`);
  if (entry.seededElsewhere) {
    exempt += 1;
    continue;
  }
  checked += 1;
  // A word-boundary match on the identifier anywhere in the seeder: the import
  // line and the use both count, and a commented-out import does not survive a
  // deploy anyway because the step that used it would not compile.
  const used = new RegExp(`\\b${entry.name}\\b`).test(seedText);
  if (!used) missing.push(entry);
}

if (missing.length > 0) {
  console.error(
    `✗ check:platform-seed — ${String(missing.length)} platform data set(s) no deploy stage applies:\n`
  );
  for (const entry of missing) {
    console.error(`  ${entry.name}  (${entry.what})`);
    console.error(`      defined: ${entry.source}`);
  }
  console.error(
    `\n  Each of these is content written as code that never becomes rows, so editing it` +
      `\n  changes nothing on any database and no check notices. Add a step to ${SEED}` +
      `\n  that applies it — idempotently, so it can run on every deploy — or record why it` +
      `\n  is applied elsewhere with \`seededElsewhere\` in scripts/check-platform-seed.mjs.`
  );
  process.exit(1);
}

console.log(
  `✓ check:platform-seed — every platform data set is applied by the deploy's data stage` +
    `\n  (${String(checked)} seeded, ${String(exempt)} applied elsewhere by declared exception)`
);
