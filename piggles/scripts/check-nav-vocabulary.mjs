// Comb the Piggles UI for sparx's vocabulary.
//
// ── WHY THIS IS A CHECK AND NOT A ONE-OFF GREP ──────────────────────────────
//
// Piggles' surfaces are a FORK of sparx's, so every new screen arrives wearing
// sparx's words by default and keeps them until somebody notices. "Modules" sat
// in the rail on a product with no module pricing. Both leaks were caught by
// looking, which does not scale and does not survive the next screen anybody
// adds.
//
// ── IT CHECKS WHAT RENDERS, NOT WHAT IS TYPED ───────────────────────────────
//
// A raw catalog title is not what a person reads: `lib/console/vocabulary.ts`
// overrides it, and a surface in `hiddenSurfaces` is never rendered at all. A
// checker that reads the source alone reports leaks that were fixed long ago and
// misses the ones that are live, so this resolves every string the way the app
// does before testing it.
//
// ── TWO SEAMS, BOTH FAIL THE SAME WAY ───────────────────────────────────────
//
//   1. NAV — surface titles and section headings, overridden in vocabulary.ts.
//   2. IN-SCREEN COPY — `productCopy('key', 'sparx's wording')`, overridden in
//      copy.ts. The fallback IS sparx's sentence, so a new call with no override
//      renders sparx's words with nothing marking it wrong.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKBENCH = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'workbench');
const read = (p) => readFileSync(join(WORKBENCH, p), 'utf8');

/** BANNED_IN_PRODUCT_COPY from @piggles/config, plus the brand name itself —
 *  the one word that is not jargon but is still the wrong product. */
const BANNED = [
  'CMS',
  'CRM',
  'headless',
  'MDI',
  'RBAC',
  'tenant',
  'module',
  'collection',
  'price book',
  'GraphQL',
  'webhook',
  'API key',
  'sparx',
];

/**
 * `'key': 'Name',` pairs out of a Record literal.
 *
 * THROWS when the named export is not in the file it was told to read, rather
 * than returning an empty Map. Silence there does not read as "no renames" — it
 * reads as "every section still wears sparx's name", so the check reports
 * failures for renames that were made correctly and are sitting one file away.
 * That is exactly what happened when PIGGLES_SECTIONS moved to its own module:
 * `'What sparx does' → 'How Piggles is set up'` was already written, and this
 * still failed CI naming the surfaces it had renamed.
 */
function pairs(src, file, start) {
  // Anchored on the DECLARATION, not on the bare name: a plain indexOf matches
  // any identifier the name is a prefix of, so renaming PIGGLES_SECTIONS to
  // PIGGLES_SECTIONS_V2 would sail straight past a guard looking for the short
  // form — which is how the first version of this guard passed its own test.
  const from = src.search(new RegExp(`const\\s+${start}\\b`));
  if (from < 0) {
    throw new Error(
      `check:nav-vocabulary — ${start} is not in ${file}. It has moved or been ` +
        `renamed; point this at its new home. Carrying on would compare every name ` +
        `against nothing and call correct renames leaks.`
    );
  }
  const body = src.slice(from, src.indexOf('\n};', from));
  return new Map(
    [...body.matchAll(/^\s*'?([\w.&' -]+?)'?:\s*'((?:[^'\\]|\\.)*)',/gm)].map((m) => [m[1], m[2]])
  );
}

const VOCAB_FILE = 'lib/console/vocabulary.ts';
// Section headings live in their own module — vocabulary.ts is the ~220 SURFACE
// names, which is long enough on its own.
const SECTION_FILE = 'lib/console/section-names.ts';
const surfaceNames = pairs(read(VOCAB_FILE), VOCAB_FILE, 'PIGGLES_SURFACES');
const sectionNames = pairs(read(SECTION_FILE), SECTION_FILE, 'PIGGLES_SECTIONS');
const hidden = new Set(
  [...read('lib/console/product.tsx').matchAll(/^ {2}'([\w.-]+)',$/gm)].map((m) => m[1])
);

// Every surface the catalog registers, with the title and section it renders.
const rendered = [];
const dir = 'lib/surfaces/catalog';
for (const file of readdirSync(join(WORKBENCH, dir)).filter((n) => n.endsWith('.ts'))) {
  const src = read(`${dir}/${file}`);
  // Split on the object boundary so a key is paired with its own title/section.
  for (const block of src.split(/\n {2}\{\n/).slice(1)) {
    const key = /^\s*key:\s*'([^']+)'/m.exec(block)?.[1];
    if (!key || hidden.has(key)) continue;
    const title = surfaceNames.get(key) ?? /^\s*title:\s*'([^']+)'/m.exec(block)?.[1];
    const rawSection = /^\s*section:\s*'([^']+)'/m.exec(block)?.[1];
    const listed = !/^\s*listed:\s*false/m.test(block);
    if (title)
      rendered.push({ key, file, listed, kind: listed ? 'nav row' : 'pane tab', text: title });
    if (rawSection) {
      rendered.push({
        key,
        file,
        listed,
        kind: 'section',
        text: sectionNames.get(rawSection) ?? rawSection,
      });
    }
  }
}

// ── Seam 2: productCopy('key', 'sparx's wording') ──────────────────────────
//
// The fallback is what renders when copy.ts has no Piggles override for the key,
// so a fallback carrying sparx's vocabulary is a live leak the moment somebody
// adds the call without the override.
// KEYS only, and matched line-by-line: a copy entry routinely wraps its sentence
// onto the next line, and a key/value parser that needs both on one line reports
// the wrapped ones as missing — a checker that cries wolf gets switched off.
const overrides = new Set(
  [...read('lib/console/copy.ts').matchAll(/^\s*'([\w.-]+)':/gm)].map((m) => m[1])
);
const CALL =
  /productCopy(?:With)?\(\s*'([\w.-]+)'\s*,\s*(?:'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`)/g;

function walk(rel) {
  for (const entry of readdirSync(join(WORKBENCH, rel), { withFileTypes: true })) {
    const next = `${rel}/${entry.name}`;
    if (entry.isDirectory()) walk(next);
    else if (/\.tsx?$/.test(entry.name)) {
      for (const m of read(next).matchAll(CALL)) {
        const [, key, single, tpl] = m;
        if (overrides.has(key)) continue;
        rendered.push({ key, file: next, listed: true, kind: 'copy', text: single ?? tpl ?? '' });
      }
    }
  }
}
for (const root of ['surfaces', 'components']) walk(root);

const hits = [];
for (const item of rendered) {
  for (const word of BANNED) {
    if (new RegExp(String.raw`\b${word}(s|es|'s)?\b`, 'i').test(item.text))
      hits.push({ ...item, word });
  }
}

const label = `${rendered.length} rendered strings · ${hidden.size} surfaces hidden from Piggles`;
if (hits.length === 0) {
  console.log(`✓ Piggles nav vocabulary clean (${label})`);
  process.exit(0);
}

console.error(`✗ sparx vocabulary in the Piggles nav (${label})\n`);
for (const h of hits) {
  console.error(`  [${h.word}] ${h.kind.padEnd(8)} "${h.text}"  ${h.key}  (${h.file})`);
}
console.error(
  '\nName it in lib/console/vocabulary.ts, or hide the surface in lib/console/product.tsx.'
);
process.exit(1);
