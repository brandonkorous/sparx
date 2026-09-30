#!/usr/bin/env node
// A COUNTRY TYPED AS A CODE.
//
// Every address in both consoles stores ISO 3166-1 alpha-2 ("US", "DE"),
// because that is what the schemas validate and what carriers and tax engines
// speak. `lib/geo.ts` has said this in its own header since it was written:
//
//     A shop owner should never SEE a code.
//
// It said that to two screens. Shipping zones and tax zones read it; the other
// seven address forms per console asked her to TYPE the code into a two-
// character box, and the Locations form printed the lesson underneath:
//
//     The two-letter country code: GB for the United Kingdom, US for the
//     United States, DE for Germany.
//
// That is our filing system, handed to somebody whose job is making clothes.
// And it does not even hold: the scheduling address gave no guidance at all, so
// one place is stored as "United States" while every other row in every other
// address table holds "US" — a value no shipping zone or tax zone will ever
// match. Issue 721. [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// ── What this checks ────────────────────────────────────────────────────────
//
// A field labelled "Country" must not be a text box. `CountryField` in
// components/country-field.tsx is the picker; it lists every country by name,
// hands back the code, and keeps an existing value that is not a code rather
// than dropping it silently.
//
// Deliberately narrow: it looks at fields whose LABEL is exactly "Country", so
// it under-reports rather than blocking a push over a guess.
// [[feedback_structural_checks_go_blind]]

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..').split('\\').join('/');
const ROOTS = [`${ROOT}/piggles/apps/workbench`, `${ROOT}/sparx/apps/workbench`];

for (const path of ROOTS) {
  if (!existsSync(path)) {
    console.error(`check:country-picker — ${path} is not there. The tree has moved.`);
    process.exit(1);
  }
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry !== 'node_modules' && entry !== '.next') walk(path, out);
    } else if (entry.endsWith('.tsx')) out.push(path);
  }
  return out;
}

/** Where a field labelled "Country" is declared, in either spelling. */
const LABELS = [/<FieldLabel[^>]*>Country<\/FieldLabel>/g, /label="Country"/g];

let found = 0;
let picked = 0;
const failures = [];

for (const root of ROOTS) {
  for (const path of walk(root)) {
    const file = path.split('\\').join('/');
    // The picker itself names the label it renders; it is the fix, not a breach.
    if (file.endsWith('/components/country-field.tsx')) continue;
    const src = readFileSync(path, 'utf8');
    // Already converted. Counted so the denominator is the real number of
    // places the console asks where something is, not just the leftovers.
    picked += [...src.matchAll(/<CountryField\b/g)].length;
    for (const pattern of LABELS) {
      for (const m of src.matchAll(pattern)) {
        found++;
        // The control belongs to the label: whatever is rendered before the
        // next </Field> or the end of this JSX element.
        const stop = src.indexOf('</Field>', m.index);
        const block = src.slice(m.index, stop === -1 ? m.index + 900 : stop);
        if (!/<Input\b|<TextField\b/.test(block)) continue;
        failures.push({
          where: `${file.slice(ROOT.length + 1)}:${String(src.slice(0, m.index).split('\n').length)}`,
        });
      }
    }
  }
}

if (found + picked === 0) {
  console.error(
    'check:country-picker — found no Country fields at all. The scan resolved nothing.'
  );
  process.exit(1);
}

if (failures.length > 0) {
  console.error(`\n${String(failures.length)} Country field(s) are a box to type a code into:\n`);
  for (const f of failures) console.error(`  ${f.where}`);
  console.error(
    '\nUse CountryField from components/country-field.tsx. The header of this file says why.\n'
  );
  process.exit(1);
}

console.log(
  `${String(found + picked)} Country fields in the two consoles, and every one of them is a list of country names.`
);
