#!/usr/bin/env node
// A console reads a response header the browser is not allowed to see.
//
// THE CLASS THIS CATCHES. A cross-origin `fetch` can read exactly seven response
// headers — the CORS-safelisted set below — and nothing else unless the server
// names it in `Access-Control-Expose-Headers`. When it does not, there is no
// error and no warning: `response.headers.get('x-sparx-skipped-rows')` answers
// null, the caller's `?? '0'` turns that into zero, and a warning written to say
// "N rows were left out of this file" says nothing instead. Silence reads as
// "all of it".
//
// Three shipped that way, in both consoles, for as long as the endpoints have
// existed: the accounting export's filename, its skipped-row warning, and the
// timesheet export's uncosted-hours warning — the last of which is a payroll
// number somebody pays staff from.
//
// WHAT IT DOES. Reads the allowlist out of api-rest's `lib/exposed-headers.ts`,
// then scans the two consoles' CLIENT code for `headers.get('…')` and requires
// every non-safelisted name to be on it. Client code only: the scan roots are
// `surfaces/` and `lib/` under each workbench, which are browser modules. Next
// route handlers under `app/api/**` read REQUEST headers and are deliberately
// out of scope — including them is how a check like this ends up with false
// positives and gets switched off.
//
// Every scan root is asserted to exist, so a tree move fails loudly rather than
// scanning nothing and printing green.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The seven a browser may read with no server co-operation (Fetch spec). */
const SAFELISTED = new Set([
  'cache-control',
  'content-language',
  'content-length',
  'content-type',
  'expires',
  'last-modified',
  'pragma',
]);

const ALLOWLIST_FILE = 'wizeworks/services/api-rest/src/lib/exposed-headers.ts';

const SCAN_ROOTS = [
  'piggles/apps/workbench/surfaces',
  'piggles/apps/workbench/lib',
  'sparx/apps/workbench/surfaces',
  'sparx/apps/workbench/lib',
];

function must(rel) {
  const abs = join(REPO, rel);
  if (!existsSync(abs)) {
    throw new Error(
      `check-exposed-headers: "${rel}" does not exist. A path moved — fix this list ` +
        `rather than letting the check scan nothing and print green.`
    );
  }
  return abs;
}

/** Header names inside the `EXPOSED_RESPONSE_HEADERS` array literal. */
function readAllowlist() {
  const src = readFileSync(must(ALLOWLIST_FILE), 'utf8');
  const block = /EXPOSED_RESPONSE_HEADERS\s*=\s*\[([\s\S]*?)\]\s*as const;/.exec(src);
  if (!block) {
    throw new Error(
      `check-exposed-headers: could not find the EXPOSED_RESPONSE_HEADERS array in ${ALLOWLIST_FILE}.`
    );
  }
  // Comments first. An apostrophe in prose ("the caller's fallback") pairs with
  // the next one and swallows a real entry, which is a check that quietly stops
  // checking — the exact failure this file exists to catch.
  const body = block[1].replace(/\/\/.*/g, '');
  const names = [...body.matchAll(/'([^']+)'/g)].map((m) => m[1].toLowerCase());
  if (names.length === 0) {
    throw new Error(`check-exposed-headers: the allowlist parsed as empty, which cannot be right.`);
  }
  const malformed = names.filter((name) => !/^[a-z0-9][a-z0-9-]*$/.test(name));
  if (malformed.length > 0) {
    throw new Error(
      `check-exposed-headers: "${malformed.join('", "')}" is not a header name. ` +
        `The allowlist did not parse cleanly, so its answers cannot be trusted.`
    );
  }
  return new Set(names);
}

/** Is the CORS registration actually passing the list on? A perfect allowlist
 *  nobody hands to `@fastify/cors` is the same bug wearing a tidier hat. */
function assertCorsUsesIt() {
  const app = readFileSync(must('wizeworks/services/api-rest/src/app.ts'), 'utf8');
  if (!/exposedHeaders:\s*\[\s*\.\.\.EXPOSED_RESPONSE_HEADERS\s*\]/.test(app)) {
    throw new Error(
      'check-exposed-headers: api-rest registers CORS without ' +
        '`exposedHeaders: [...EXPOSED_RESPONSE_HEADERS]`. The allowlist reaches no browser.'
    );
  }
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue;
      yield* walk(abs);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry)) yield abs;
  }
}

const allowed = readAllowlist();
assertCorsUsesIt();

const problems = [];
let filesScanned = 0;
let readsChecked = 0;

for (const root of SCAN_ROOTS) {
  for (const file of walk(must(root))) {
    filesScanned += 1;
    const src = readFileSync(file, 'utf8');
    // `headers.get('name')` — the only shape either console uses to read one.
    for (const match of src.matchAll(/headers\s*\.\s*get\(\s*'([^']+)'\s*\)/g)) {
      const name = match[1].toLowerCase();
      readsChecked += 1;
      if (SAFELISTED.has(name) || allowed.has(name)) continue;
      const line = src.slice(0, match.index).split('\n').length;
      problems.push(
        `${relative(REPO, file).replaceAll('\\', '/')}:${line}  reads "${name}", which is neither ` +
          `CORS-safelisted nor in EXPOSED_RESPONSE_HEADERS. The browser will read null and the ` +
          `fallback beside it will look like an answer.`
      );
    }
  }
}

if (problems.length > 0) {
  console.error('\nResponse headers a browser cannot actually read:\n');
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(
    `\nAdd the header to ${ALLOWLIST_FILE}, or stop reading it.\n` +
      `${String(readsChecked)} reads across ${String(filesScanned)} client files.\n`
  );
  process.exit(1);
}

console.log(
  `check-exposed-headers: ${String(readsChecked)} header reads across ` +
    `${String(filesScanned)} client files · ${String(allowed.size)} exposed by the API`
);
