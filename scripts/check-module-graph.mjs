#!/usr/bin/env node
// The module price rules, held level with the server.
//
// What a tenant is BILLED for comes from the graph in @wizeworks/modules:
// REQUIRES (B2B needs Commerce, both billed) and BUNDLED_FREE (Invoicing,
// Inventory and Finance ride along at $0 with Commerce or B2B). The sparx
// workbench's setup screen prices the same modules in the browser, and the server
// graph imports the database client, so the console keeps a COPY in
// sparx/apps/workbench/lib/onboarding/modules.ts.
//
// A copy drifts silently: Finance went free on the server and stayed $29 in the
// copy, so setup quoted a monthly charge the bill would never make, and every
// check stayed green because both files were individually fine (sparx persona
// issue 006). This compares the two and fails on any difference.
//
//   node scripts/check-module-graph.mjs

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = join(ROOT, 'wizeworks/packages/modules/src/index.ts');
const COPIES = [join(ROOT, 'sparx/apps/workbench/lib/onboarding/modules.ts')];

for (const p of [SERVER, ...COPIES]) {
  if (!existsSync(p)) {
    console.error(`check:module-graph: ${p} does not exist. A file moved; fix this script.`);
    process.exit(1);
  }
}

/** Parse `const NAME… = { key: ['a', 'b'], … }` into { key: ['a','b'] } (sorted). */
function readMap(src, name, file) {
  const at = src.search(new RegExp(`const ${name}\\b`));
  if (at < 0) {
    console.error(`check:module-graph: no \`${name}\` in ${file}.`);
    process.exit(1);
  }
  const open = src.indexOf('{', src.indexOf('=', at));
  const close = src.indexOf('};', open);
  const body = src.slice(open + 1, close).replace(/\/\/.*$/gm, '');
  const map = {};
  for (const m of body.matchAll(/([a-z0-9_]+)\s*:\s*\[([^\]]*)\]/g)) {
    map[m[1]] = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort();
  }
  if (Object.keys(map).length === 0) {
    console.error(`check:module-graph: read 0 entries from \`${name}\` in ${file}; the parser is blind.`);
    process.exit(1);
  }
  return map;
}

const fmt = (m) => JSON.stringify(Object.fromEntries(Object.entries(m).sort()));
const serverSrc = readFileSync(SERVER, 'utf8');
let bad = 0;
let compared = 0;
for (const name of ['BUNDLED_FREE', 'REQUIRES']) {
  const truth = readMap(serverSrc, name, SERVER);
  for (const copy of COPIES) {
    const mine = readMap(readFileSync(copy, 'utf8'), name, copy);
    compared += Object.keys(truth).length;
    if (fmt(truth) !== fmt(mine)) {
      bad++;
      console.error(
        `check:module-graph: ${name} differs.\n  server  ${fmt(truth)}\n  console ${fmt(mine)}\n  (${copy})`
      );
    }
  }
}
if (bad) process.exit(1);
console.log(`check:module-graph: ${compared} rules across ${COPIES.length} console copy match the server.`);
