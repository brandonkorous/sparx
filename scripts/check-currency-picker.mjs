#!/usr/bin/env node
// A CURRENCY FIELD THAT ASKS A SHOP OWNER TO KNOW THE CODE.
//
// The wire format everywhere is ISO 4217 ("USD", "GBP"), because that is what
// the schemas validate and what payment and tax providers speak. She should
// never have to TYPE one, and she should never be shown a bare code in a list
// either. `lib/currency.ts` is the one place that turns a code into a name.
//
// MEASURED 2026-09-19: nine Currency fields in each console, doing four
// different things.
//
//     Gift cards          a list of NAMES           "US dollars"
//     Selling settings    a list of BOTH            "US Dollar (USD)"
//     Special prices      a list of CODES           "USD"
//     Bookings            a list of CODES           "USD"
//     How stock is valued an empty BOX, 3 letters
//     A supplier          an empty BOX, 3 letters
//     A deal              an empty BOX, 3 letters
//     A thing you track   an empty BOX, 3 letters
//     A course            an empty BOX, 3 letters
//
// So "US Dollar" was already written down twice, in two spellings, and five
// screens still asked her to know that dollars are USD. Issue 730.
// [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// The box was not merely untidy. The schema behind these fields checks three
// letters and nothing else, so "ZZZ" saves, syncs and prints on an invoice
// forever, and `money-format.ts` exists because "123" used to take a whole pane
// out. A list of names has no such state.
//
// ── What this looks for ─────────────────────────────────────────────────────
//
// A field whose LABEL or aria-label is about currency, and whose control is not
// <CurrencyField>. That is the only shape allowed, because it is the only one
// that reaches `lib/currency.ts`.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..').split('\\').join('/');
const ROOTS = [`${ROOT}/piggles/apps/workbench`, `${ROOT}/sparx/apps/workbench`];

for (const path of ROOTS) {
  if (!existsSync(path)) {
    console.error(`check:currency-picker — ${path} is not there. The tree has moved.`);
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

/** A label that is asking which currency something is in. */
const ASKS = /(?:<FieldLabel[^>]*>|aria-label=")([^<"]*\bcurrenc(?:y|ies)\b[^<"]*)/i;

let found = 0;
const failures = [];

for (const root of ROOTS) {
  for (const path of walk(root)) {
    const file = path.split('\\').join('/');
    // The component IS the answer; it names itself.
    if (file.endsWith('/components/currency-field.tsx')) continue;
    const src = readFileSync(path, 'utf8');

    for (const m of src.matchAll(/<CurrencyField\b/g)) {
      void m;
      found++;
    }

    // A Field whose label asks about currency, drawn by something else.
    for (const m of src.matchAll(/<Field\b[\s\S]{0,1400}?<\/Field>/g)) {
      const block = m[0];
      const label = ASKS.exec(block);
      if (!label) continue;
      // A label can mention currency while the control is about something
      // else — "Buying in another currency is converted…" is a description,
      // not a picker. Only a control BOUND to a currency value counts.
      if (!/\bcurrency\b/i.test(block.replace(ASKS, ''))) continue;
      found++;
      failures.push({
        where: `${file.slice(ROOT.length + 1)}:${String(src.slice(0, m.index).split('\n').length)}`,
        label: label[1].replace(/\s+/g, ' ').trim(),
      });
    }
  }
}

if (found === 0) {
  console.error(
    'check:currency-picker — found no currency fields at all. The scan resolved nothing.'
  );
  process.exit(1);
}

if (failures.length > 0) {
  console.error(`\n${String(failures.length)} currency field(s) are not a list of names:\n`);
  for (const f of failures) {
    console.error(`  ${f.where}`);
    console.error(`      labelled "${f.label}"`);
  }
  console.error('\nUse <CurrencyField>. The header of this file says why.\n');
  process.exit(1);
}

console.log(
  `${String(found)} Currency fields in the two consoles, and every one of them is a list of currency names.`
);
