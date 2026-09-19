#!/usr/bin/env node
// Every CHROME core is drawn at its real size, on every console's canvas.
//
// ── THE RULE ────────────────────────────────────────────────────────────────
//
// A host core is a part of a site the platform fills in: the brand mark, the
// account link, the legal links, the social row, the cart. The studio canvas
// cannot run the live one, so it draws a stand-in, and there are two kinds:
//
//   · A CHROME core lives in a navbar or a footer column and is about as big as a
//     line of text. Its stand-in must be the ACTUAL CONTROL at its actual size.
//   · A TRANSACTION core (cart, search, product grid) legitimately fills a
//     page-sized block, and a labelled dashed skeleton is the honest preview.
//
// Draw a chrome core as a skeleton and the canvas tells a lie about its
// footprint: a 24px icon button rendered as a 120px box blows the navbar apart,
// and the author styles around a shape that will never exist.
//
// WHICH CORES ARE CHROME IS A FACT IN THE CATALOG — the `category` on each entry,
// which is also what the Add palette groups by. It is not a judgement this check
// makes, and not a list anybody keeps up to date by hand.
//
// ── WHY IT EXISTS ───────────────────────────────────────────────────────────
//
// Both consoles kept the list in a comment at the top of `host-cores.tsx`:
//
//     · CHROME cores (brand, theme toggle, account link, legal links, pager,
//       embeds) — drawn at their REAL size, inline.
//
// Six named in one console and three in the other, while the catalog had six
// under "Your site". "Social links" was in neither list. On a real footer it
// drew a 146px dashed box, labelled with a screen-reader term, in a column whose
// other card was 116px — and the tenant's own Instagram and Pinterest were
// already sitting in the canvas data root, unread.
//
// That is the shape this repo keeps finding: the thinking was done and written
// down, applied to the cores in front of somebody, and not to their neighbour.
// A comment cannot fail. This can.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The catalog every console's canvas draws from. */
const CATALOG = join(ROOT, 'wizeworks/packages/silica-catalog/src/host-nodes.ts');

/**
 * The categories whose cores must be drawn at their real size.
 *
 * "Your site" is the site chrome — brand, theme toggle, account link, legal
 * links, social links, pager. "Your media" is the map and the embed, which are
 * not small but ARE sized: the author's only question about them is how big a
 * hole they leave, so a dashed card of some other height answers the wrong one.
 *
 * Everything else — "Your shop", "Your bookings", "Your writing" — is a page-sized
 * live transaction, and a skeleton is the honest preview.
 */
const CHROME_CATEGORIES = new Set(['Your site', 'Your media']);

/** Each console's dispatch, which must name every chrome core. */
const CONSOLES = [
  { brand: 'piggles', file: 'piggles/apps/workbench/lib/studio/host-cores.tsx' },
  { brand: 'sparx', file: 'sparx/apps/workbench/surfaces/builder/studio/host-cores.tsx' },
];

// Every path asserted. A check that reads a file which has moved reports zero
// problems, in green, forever.
for (const path of [CATALOG, ...CONSOLES.map((c) => join(ROOT, c.file))]) {
  if (!existsSync(path)) {
    console.error(`check:host-cores — this file is missing: ${relative(ROOT, path)}`);
    console.error('Point this at its new home; carrying on would check nothing.');
    process.exit(1);
  }
}

const catalog = readFileSync(CATALOG, 'utf8');

/**
 * Every host core, as `{ name, label, category }`.
 *
 * `name` is the HOST_KEYS property (`siteSocialLinks`), not the string value,
 * because that is what a dispatch branch is written against.
 *
 * COMMENTS ARE STRIPPED FIRST, and that is not tidiness. Several entries carry a
 * paragraph between `key:` and `label:` explaining why they are named what they
 * are, and the first version of this reader matched on adjacency — so it saw 17
 * of 21 cores and silently dropped the map and the embed, which are two of the
 * eight it exists to police. It reported green. The count assertion below is the
 * other half of that fix: parsing fewer entries than the file has `key:` lines is
 * a broken reader, never a clean catalog ([[feedback_structural_checks_go_blind]]).
 */
function hostCores() {
  const source = catalog
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => (line.trim().startsWith('//') ? '' : line))
    .join('\n');
  const re = /key:\s*HOST_KEYS\.(\w+),\s*\n\s*label:\s*'([^']+)',\s*\n\s*category:\s*'([^']+)'/g;
  const out = [...source.matchAll(re)].map(([, name, label, category]) => ({
    name,
    label,
    category,
  }));
  // Counted independently of the shape the reader above depends on.
  const declared = [...source.matchAll(/^\s*key:\s*HOST_KEYS\.\w+,/gm)].length;
  if (out.length !== declared) {
    console.error(
      `check:host-cores — read ${String(out.length)} core(s) but the catalog declares ${String(declared)}.`
    );
    console.error('An entry orders its fields differently than this reader expects, so some');
    console.error('cores are going unchecked. Fix this reader rather than deleting the check.');
    process.exit(1);
  }
  return out;
}

const cores = hostCores();
const chrome = cores.filter((c) => CHROME_CATEGORIES.has(c.category));

// The categories are spelled in the catalog, so a rename there would silently
// empty this set and the check would pass over nothing.
if (chrome.length === 0) {
  console.error('check:host-cores — no core matched a chrome category.');
  console.error(`Looked for: ${[...CHROME_CATEGORIES].join(', ')}`);
  console.error(`The catalog spells: ${[...new Set(cores.map((c) => c.category))].join(', ')}`);
  console.error('A category was renamed. Update CHROME_CATEGORIES rather than passing blind.');
  process.exit(1);
}

const missing = [];
for (const console_ of CONSOLES) {
  const src = readFileSync(join(ROOT, console_.file), 'utf8');
  for (const core of chrome) {
    // `HOST_KEYS.siteSocialLinks` with a word boundary after it, so `siteMap`
    // cannot be satisfied by a branch that names `siteMapSomethingElse`.
    if (new RegExp(`HOST_KEYS\\.${core.name}\\b`).test(src)) continue;
    missing.push({ ...console_, core });
  }
}

if (missing.length > 0) {
  console.error(
    `\n${String(missing.length)} chrome core(s) are drawn as a page-sized skeleton on a\n` +
      'canvas, which is a lie about how much room they take on the real site.\n\n' +
      'Draw the actual control at its actual size, next to the marks already there.\n'
  );
  for (const m of missing) {
    console.error(
      `  [${m.brand}] ${m.core.label}  (HOST_KEYS.${m.core.name}, "${m.core.category}")`
    );
    console.error(`      ${m.file}`);
  }
  console.error('');
  process.exit(1);
}

console.log(
  `check:host-cores — ${String(chrome.length)} chrome core(s) of ${String(cores.length)} drawn ` +
    `at real size in ${String(CONSOLES.length)} console(s).`
);
