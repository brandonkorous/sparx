// Fails when a surface keeps its own table of what the apps are called.
//
// There is ONE answer to "what is this part of the platform called", and it
// lives in `lib/surfaces/nav.ts`, which resolves it through the brand's app
// registry. Six surfaces kept their own, and the words drifted exactly the way a
// second copy always does. Measured 2026-09-25 — `commerce` alone:
//
//   lib/surfaces/nav.ts            Sell        (Piggles' rail, via the registry)
//   automations/automations-catalog  Selling
//   integrations/data                Selling
//   sites/site-manage-scope          Selling
//   industry/data                    Online store
//   sample-data/data                 Online store
//   builder/blueprints-words         Store
//
// So a Piggles shop owner met **four names for the Sell app on four screens**,
// with her rail saying Sell the whole time — and `email` read "Email" on four
// screens beside a rail row that says Messages, `ai` read "AI" beside
// Connections, and `finance` read "Finance" beside Money. Nothing was broken,
// nothing failed to build, and the console had five vocabularies for the same
// sixteen things. Same defect as one order reading four ways on four screens
// (issue 260), one level up. [[feedback_a_copy_edit_breaks_identity_lookups]]
//
// ── WHAT THIS LOOKS FOR, AND WHAT IT LEAVES ALONE ───────────────────────────
//
// An object literal whose KEYS are module slugs and whose values are strings.
// Three or more slugs is a vocabulary; one or two is a surface making a local
// distinction and is left alone.
//
// Two shapes look like this and are NOT it, both found while writing this:
//
//   KIND_LABEL in migration/data.ts       keyed on the kind of product you are
//                                         moving FROM — "Online stores" is what
//                                         Shopify is, not what our app is called
//   VERTICAL_LABEL in step-blueprint      keyed on a blueprint's vertical
//                                         (retail / b2b / content / services)
//
// Both share the `b2b` key with a real module table, which is why the rule is
// about how MANY module slugs a table uses rather than about any one of them.
//
// Zero dependencies on purpose: CI runs it with bare Node, no install.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

function die(lines) {
  console.error(lines.join('\n'));
  process.exit(1);
}

function repoRoot() {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  die(['✖ app names: repo root not found (no pnpm-workspace.yaml above this script)']);
}

const ROOT = repoRoot();
const CONSOLES = ['piggles', 'sparx'].map((brand) => ({
  brand,
  surfaces: join(ROOT, brand, 'apps', 'workbench', 'surfaces'),
  nav: join(ROOT, brand, 'apps', 'workbench', 'lib', 'surfaces', 'nav.ts'),
}));

/** Every module slug the workbench knows, read from the real union. */
function moduleSlugs(brand) {
  const file = join(ROOT, brand, 'apps', 'workbench', 'components', 'module-scope.tsx');
  if (!existsSync(file)) die([`✖ app names: module-scope.tsx missing at ${file}`]);
  const source = readFileSync(file, 'utf8');
  const start = source.indexOf('export const WORKBENCH_MODULES = [');
  if (start < 0) die(['✖ app names: WORKBENCH_MODULES not found — the file has been restructured']);
  const end = source.indexOf('] as const;', start);
  return [...source.slice(start, end).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

function files(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files(full, out);
    else if (/\.tsx?$/.test(full) && !full.includes('.test.')) out.push(full);
  }
  return out;
}

/** Comments are not copy, and this file's own header is full of slug names. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/**
 * Tables that are keyed on something which merely SHARES these names.
 *
 * `KIND_LABEL` in migration/data.ts is keyed on the kind of product a tenant is
 * moving FROM — "Online stores" is what Shopify IS, not what our Sell app is
 * called, and "Publishing platforms" is Squarespace rather than Content. Four of
 * its five keys happen to be module slugs, which is why it lands here rather
 * than falling out of the shape rule.
 *
 * An entry here is a claim that the table names something else. Keep it short.
 */
const NOT_APP_NAMES = ['surfaces/migration/data.ts'];

let scanned = 0;
let exempt = 0;
const offenders = [];

for (const { brand, surfaces, nav } of CONSOLES) {
  // A scan root that stopped existing is how a check goes blind and prints a
  // tick over nothing. [[feedback_structural_checks_go_blind]]
  if (!existsSync(surfaces)) die([`✖ app names: scan root missing: ${surfaces}`]);
  if (!existsSync(nav)) die([`✖ app names: the one table is missing: ${nav}`]);
  const slugs = new Set(moduleSlugs(brand));
  if (slugs.size < 15) die([`✖ app names: only ${String(slugs.size)} module slugs found for ${brand}`]);

  for (const file of files(surfaces)) {
    scanned += 1;
    const source = stripComments(readFileSync(file, 'utf8'));
    // `commerce: 'Selling'` or `commerce: { label: 'Online store'` — a slug key
    // whose value is a DISPLAY NAME.
    //
    // The capital is load-bearing. `CATEGORY_MODULE` in integrations-list maps a
    // category to the module HUE it wears (`social: 'social'`) and
    // `CATEGORY_SURFACE` maps one to a surface key (`social: 'social.connections'`);
    // both are slug-to-slug and neither is a name anybody reads. Matching on any
    // string value reported both of them, in both consoles, on this check's first
    // run — a scan that cannot tell a right answer from a wrong one is worse than
    // no scan.
    // NOT anchored to the start of a line. The first draft was, and a table
    // written on ONE line slipped straight past it — which is the shape somebody
    // reaches for precisely when they think it is too small to matter.
    const keyed = new Set();
    for (const m of source.matchAll(/\b([a-z_]+):\s*(?:'([A-Z][^']*)'|\{\s*label:\s*'([A-Z][^']*)')/g)) {
      if (slugs.has(m[1])) keyed.add(m[1]);
    }
    if (keyed.size < 3) continue;
    const rel = relative(ROOT, file).split(sep).join('/');
    if (NOT_APP_NAMES.some((suffix) => rel.endsWith(suffix))) {
      exempt += 1;
      continue;
    }
    offenders.push({ rel, slugs: [...keyed].sort().join(', ') });
  }
}

if (scanned < 400) {
  die([
    `✖ app names: only ${String(scanned)} surface files were read.`,
    '',
    '   There were well over 400 when this check was written. Either the trees',
    '   moved or the walk is broken. Fix it rather than believing the tick.',
  ]);
}

if (offenders.length > 0) {
  die([
    offenders.length === 1
      ? '✖ app names: 1 surface keeps its own names for the apps'
      : `✖ app names: ${String(offenders.length)} surfaces keep their own names for the apps`,
    '',
    ...offenders.map(
      (o) =>
        `  ${o.rel}\n` +
        `     names ${o.slugs} itself.\n` +
        `     Import moduleLabel from lib/surfaces/nav — it resolves through the\n` +
        `     brand's app registry, so the word matches the rail. A table keyed on\n` +
        `     something that merely SHARES these names (a vendor kind, a blueprint\n` +
        `     vertical) should use at most two of them.`
    ),
  ]);
}

console.log(
  `✓ app names: ${String(scanned)} surface files across both consoles, and not one of them ` +
    `keeps its own table of what the apps are called (${String(exempt)} table(s) named as ` +
    `something else).`
);
