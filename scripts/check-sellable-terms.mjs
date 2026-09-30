#!/usr/bin/env node
/**
 * Fails if stock arithmetic withholds the SOFT cushion and not the HARD one.
 *
 * ---------------------------------------------------------------------------
 * The problem this exists for
 * ---------------------------------------------------------------------------
 *
 * How much of a thing is actually free has four terms:
 *
 *     on_hand - allocated - safety_buffer - unsellable_on_hand
 *
 * `safety_buffer` is a POLICY cushion: units deliberately withheld from sale.
 * `unsellable_on_hand` is a PHYSICAL fact: units on a quarantine shelf, a
 * damaged shelf, or awaiting repair. They are counted in on-hand because they
 * really are in the building, and nothing may be taken off them by anybody.
 *
 * `low-stock.ts` has carried the one definition since it was written, and its
 * header says every read path routes through it. It said READ path. On
 * 2026-09-19 the WRITE GUARDS still had three terms:
 *
 *   - reservations.ts, the FOR UPDATE lock that decides whether a shopper may
 *     take a unit into a basket;
 *   - reservations.ts again, picking which warehouse to ship from — so an order
 *     could be routed to a warehouse whose only stock was quarantined;
 *   - assembly-orders.ts, the guard on committing parts to a build.
 *
 * Every surface that DISPLAYED availability had four terms and every guard that
 * ENFORCED it had three, which is the dangerous way round: the screen shows the
 * strict number and the software acts on the loose one.
 *
 * Found by a shop owner planning a run against one brass buckle. The recipe pane
 * said "you could make 0" because its own arithmetic was right; she pressed Hold
 * the parts and the platform reserved the damaged one anyway.
 *
 * ---------------------------------------------------------------------------
 * The rule
 * ---------------------------------------------------------------------------
 *
 * A SUBTRACTION CHAIN that takes `safetyBuffer` / `safety_buffer` out must also
 * take `unsellableOnHand` / `unsellable_on_hand` out.
 *
 * Deliberately NOT "must mention it somewhere in the file". The guard that
 * started this SELECTED the column two lines above and then left it out of the
 * arithmetic, so a file-level or nearby-lines rule reads green over the exact
 * bug it is for. The chain itself is the only honest unit.
 *
 * Also deliberately NOT a rule about `on_hand - allocated`. That two-term figure
 * is the documented public `available`, which integrators read and which stops
 * before the buffer on purpose. Subtracting NEITHER cushion is a different
 * (documented) question; subtracting the soft one and not the hard one is not a
 * position anybody holds, it is an omission.
 *
 * A unary negation (`value: -data.safetyBuffer`, a row in a breakdown list) is
 * not a chain and is skipped.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** The trees this scans. Each one is ASSERTED to exist: a check that silently
 *  scans nothing after a directory move prints a green tick over no work at
 *  all, which is worse than no check. */
const TREES = [
  'wizeworks/packages',
  'wizeworks/services',
  'piggles/apps/workbench',
  'sparx/apps/workbench',
];

const missing = TREES.filter((t) => !existsSync(join(ROOT, t)));
if (missing.length > 0) {
  console.error('check-sellable-terms: these scan roots do not exist:');
  for (const t of missing) console.error(`  ${t}`);
  console.error('\nThe paths moved. Update TREES, or this check scans nothing and passes.');
  process.exit(1);
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'dist' || name === '.turbo') {
      continue;
    }
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) yield full;
  }
}

/** Comments are prose about the arithmetic, not the arithmetic. Two stale ones
 *  quoted the definition three terms long while the code beneath them used all
 *  four; they are worth fixing and are not this check's business. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, '');
}

const SOFT = /(?:safetyBuffer|safety_buffer)/;
const HARD = /(?:unsellableOnHand|unsellable_on_hand)/;

/** Characters that can appear inside one arithmetic chain. A comma, colon,
 *  brace, semicolon, backtick or any other operator ends it. */
const CHAIN_CHAR = /[A-Za-z0-9_$.?()[\]\s-]/;

/** Widen from a `safetyBuffer` hit to the whole chain it sits in. */
function chainAround(src, index) {
  let start = index;
  while (start > 0 && CHAIN_CHAR.test(src[start - 1])) start -= 1;
  let end = index;
  while (end < src.length && CHAIN_CHAR.test(src[end])) end += 1;
  return src.slice(start, end);
}

let scanned = 0;
const offences = [];

for (const tree of TREES) {
  const base = join(ROOT, tree);
  for (const file of walk(base)) {
    const rel = relative(base, file).split(sep).join('/');
    scanned += 1;
    const raw = readFileSync(file, 'utf8');
    if (!SOFT.test(raw)) continue;
    const src = stripComments(raw);
    for (const match of src.matchAll(new RegExp(SOFT.source, 'g'))) {
      const chain = chainAround(src, match.index);
      const flat = chain.replace(/\s+/g, ' ').trim();
      // Not a subtraction chain at all, or a unary negation with no left operand.
      if (!flat.includes('-') || flat.startsWith('-')) continue;
      // The minus must come BEFORE the soft term: `buffer - x` withholds nothing.
      const at = flat.search(SOFT);
      if (!flat.slice(0, at).includes('-')) continue;
      if (HARD.test(flat)) continue;
      const line = src.slice(0, match.index).split('\n').length;
      offences.push({ where: `${tree}/${rel}:${line}`, code: flat.slice(0, 110) });
    }
  }
}

if (scanned === 0) {
  console.error('check-sellable-terms: scanned 0 files. The globs match nothing.');
  process.exit(1);
}

if (offences.length > 0) {
  console.error(
    `check-sellable-terms: ${offences.length} chain(s) withhold the buffer and not the quarantine shelf.\n`
  );
  for (const o of offences) console.error(`  ${o.where}\n    ${o.code}\n`);
  console.error('Each one lets something be sold, shipped or built out of stock that is');
  console.error('damaged, in quarantine, or awaiting repair.');
  console.error('Use sellableUnits() / SELLABLE_SQL from @wizeworks/inventory low-stock.ts,');
  console.error('or add the fourth term to the chain.');
  process.exit(1);
}

console.log(
  `check-sellable-terms: ${scanned} files, every buffer chain also withholds the quarantine shelf.`
);
