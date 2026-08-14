// Fails if docs/150-inventory-api-reference.md no longer matches the registered
// inventory routes.
//
// An undocumented endpoint is not a documentation problem, it is an invisible
// feature: an integrator cannot call what they cannot find, and the team stops
// believing the reference the first time it is wrong. The reverse is worse — a
// documented endpoint that no longer exists sends somebody to build against a
// 404 and blame their own code.
//
// The reference is GENERATED (scripts/gen-inventory-api-reference.mjs), so the
// fix is always the same one command. This check exists because "remember to
// regenerate" is not a mechanism.
//
// Zero dependencies on purpose: the CI job runs it with bare Node, no install.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { DOC, readRoutes, render } from './gen-inventory-api-reference.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Every `METHOD /path` line inside the reference's fenced blocks. */
function documented() {
  const text = readFileSync(join(repoRoot, DOC), 'utf8');
  const set = new Set();
  for (const line of text.split(/\r?\n/)) {
    const m = /^(GET|POST|PUT|PATCH|DELETE)\s+(\/v1\/inventory\S*)\s*$/.exec(line);
    if (m) set.add(`${m[1]} ${m[2]}`);
  }
  return set;
}

let expected;
try {
  expected = render();
} catch (err) {
  console.error(`\n${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}

const registered = new Set();
for (const rows of readRoutes().values()) {
  for (const row of rows) registered.add(`${row.method} ${row.path}`);
}

const inDoc = documented();
const missing = [...registered].filter((r) => !inDoc.has(r)).sort();
const stale = [...inDoc].filter((r) => !registered.has(r)).sort();

// Byte-for-byte comparison catches prose/ordering drift too, which is what makes
// "just regenerate" a safe instruction rather than a partial one.
const current = readFileSync(join(repoRoot, DOC), 'utf8');
const identical = current === expected;

if (missing.length > 0 || stale.length > 0 || !identical) {
  console.error('\nInventory API reference is out of date:\n');
  for (const r of missing) console.error(`  + registered but undocumented: ${r}`);
  for (const r of stale) console.error(`  - documented but not registered: ${r}`);
  if (missing.length === 0 && stale.length === 0 && !identical) {
    console.error('  ! endpoint list matches, but the file differs (prose, ordering or heading).');
  }
  console.error(`\nFix: node scripts/gen-inventory-api-reference.mjs\n`);
  process.exit(1);
}

console.log(`check-inventory-api-docs: ok — ${registered.size} endpoints, all documented.`);
