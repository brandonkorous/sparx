#!/usr/bin/env node
/**
 * Fails if a SEEDED SAVED VIEW points at a screen that does not exist.
 *
 * ---------------------------------------------------------------------------
 * The problem this exists for
 * ---------------------------------------------------------------------------
 *
 * Every tenant is seeded with a starter set of saved views — "Overdue",
 * "Abandoned carts", "Pending moderation" — by `saved-view-presets.ts`. Each one
 * carries a `target`, and `target` is a SCREEN's pathname: a list registers
 * itself with `views={{ target: '/some/path', … }}` and the Views menu on that
 * list shows the rows stored under exactly that string.
 *
 * The preset lives in `services/api-rest`. The pane lives in an app. They are
 * two string literals in two packages that never import each other, and nothing
 * makes them agree. When they disagree the row is still created, still counted,
 * still occupies the database — and no screen will ever ask for it.
 *
 * That is not hypothetical. Measured on 2026-09-15, EIGHT of seventeen seeded
 * targets reached nothing at all:
 *
 *     /invoicing/documents    the API route, not the screen (the screen is
 *                             /invoicing/invoices) — so the "Overdue" view, the
 *                             one a receivables list exists for, sat in the
 *                             database while the menu said "No saved views yet"
 *     /crm/customers          a real screen, but the CRM lists use their OWN
 *     /crm/orders             saved views (crm_saved_views, keyed by objectKey),
 *     /crm/deals              so these rows are seeded into the wrong system
 *     /crm/b2b                not a route
 *     /crm/quotes             not a route
 *     /b2b/quotes             not a route
 *     /b2b/appointments       not a route
 *
 * Nothing was broken enough to fail: no error, no empty state, no log line. The
 * feature simply did not happen, on every tenant, for as long as it had shipped.
 *
 * ---------------------------------------------------------------------------
 * The rule
 * ---------------------------------------------------------------------------
 *
 * Every `target` in SAVED_VIEW_PRESETS must be registered by at least one pane,
 * in at least one console. A preset for a screen only one brand has is fine;
 * a preset for a screen NEITHER has is the defect.
 *
 * Pure Node, no dependencies. Same family as check:events / check:routes /
 * check:console-parity.
 */

import fs from 'node:fs';
import path from 'node:path';

/** Resolve the repo root by its marker, never by counting `..` up from here. */
function repoRoot() {
  let dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  for (let i = 0; i < 10; i += 1) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  throw new Error(
    'check:saved-view-targets — could not find pnpm-workspace.yaml above this script'
  );
}

const ROOT = repoRoot();

const PRESETS_FILE = 'wizeworks/services/api-rest/src/lib/saved-view-presets.ts';
const CONSOLES = ['piggles/apps/workbench/surfaces', 'sparx/apps/workbench/surfaces'];

/** Every scan root must EXIST. A check that silently scans nothing prints a
 *  green tick over an empty set, which is worse than no check at all. */
function mustExist(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    console.error(`check:saved-view-targets — missing scan root: ${rel}`);
    console.error('  The tree moved. Fix this path rather than letting the check scan nothing.');
    process.exit(1);
  }
  return abs;
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (/\.tsx?$/.test(entry.name)) yield p;
  }
}

// ── What the platform SEEDS ─────────────────────────────────────────────────
//
// Read as text rather than imported: this script is plain Node and the presets
// file is TypeScript in another package. The shape is a literal list, so the
// `target:` strings are unambiguous.
const presetsText = fs.readFileSync(mustExist(PRESETS_FILE), 'utf8');
const seeded = new Map(); // target -> [names]
for (const m of presetsText.matchAll(/\{\s*target:\s*'([^']+)'\s*,\s*name:\s*'([^']+)'/g)) {
  const [, target, name] = m;
  if (!seeded.has(target)) seeded.set(target, []);
  seeded.get(target).push(name);
}

if (seeded.size === 0) {
  console.error('check:saved-view-targets — parsed ZERO presets out of ' + PRESETS_FILE);
  console.error('  Either the catalog is empty or its shape changed. Both need a human.');
  process.exit(1);
}

// ── What the consoles REGISTER ──────────────────────────────────────────────
const registered = new Map(); // target -> [files]
for (const rel of CONSOLES) {
  const root = mustExist(rel);
  for (const file of walk(root)) {
    const text = fs.readFileSync(file, 'utf8');
    if (!text.includes('views={{')) continue;
    // `views={{ target: '…'` — the target may sit a few lines down, past a
    // comment, so take a generous window and then match precisely.
    for (const block of text.split('views={{').slice(1)) {
      const m = /^[\s\S]{0,600}?target:\s*'([^']+)'/.exec(block);
      if (!m) continue;
      const target = m[1];
      if (!registered.has(target)) registered.set(target, []);
      registered.get(target).push(path.relative(ROOT, file).replace(/\\/g, '/'));
    }
  }
}

if (registered.size === 0) {
  console.error('check:saved-view-targets — found ZERO `views={{ target: … }}` registrations.');
  console.error('  The consoles cannot really have none. The pattern changed; fix this check.');
  process.exit(1);
}

// ── Compare ─────────────────────────────────────────────────────────────────
const orphans = [...seeded.entries()].filter(([target]) => !registered.has(target));

console.log(
  `check:saved-view-targets — ${String(seeded.size)} seeded target(s), ` +
    `${String(registered.size)} registered by a pane.`
);

if (orphans.length > 0) {
  console.error('\nSeeded saved views pointing at a screen that does not exist:\n');
  for (const [target, names] of orphans) {
    console.error(`  ${target}`);
    console.error(`      seeds: ${names.join(', ')}`);
    console.error('      No pane registers this target, so these rows are created on every');
    console.error('      tenant and no Views menu will ever show them.');
    console.error('');
  }
  console.error('  A `target` is a SCREEN pathname, not an API route and not a guess.');
  console.error('  Either point it at the path a list registers, or drop the preset.');
  console.error(`  Presets: ${PRESETS_FILE}\n`);
  process.exit(1);
}

for (const [target, names] of [...seeded].sort()) {
  console.log(`  OK  ${target}  (${names.length}) → ${registered.get(target).length} pane(s)`);
}
