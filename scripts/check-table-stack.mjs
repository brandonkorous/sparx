#!/usr/bin/env node
// Every console table goes through the console's own Table, which stacks its rows
// in a narrow pane (sparx persona issue 274).
//
// A list that ran past its pane hid the state and the row's own button behind the
// right edge on a phone, or in a pane beside two others: about 150 lists in the two
// consoles. silicaui's `table-stack` folds each row into a block below a 36rem
// pane, and `components/table.tsx` in each console turns it on by default. So:
//
//   1. No screen imports silicaui's `Table` directly; it imports the console's.
//   2. A table that keeps its grid (`stack={false}`) says why, in a comment on one
//      of the three lines above it.
//
// Run: node scripts/check-table-stack.mjs

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const CONSOLES = ['sparx/apps/workbench', 'piggles/apps/workbench'];
const SCAN = ['surfaces', 'components'];
const WRAPPER = 'components/table.tsx';

const SILICA_IMPORT = /import\s*\{([^}]*)\}\s*from\s*'@wizeworks\/silicaui-react';/g;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (entry.endsWith('.tsx') && !entry.includes('.test.')) out.push(p);
  }
  return out;
}

let files = 0;
let tables = 0;
const problems = [];
for (const console_ of CONSOLES) {
  if (!existsSync(join(ROOT, console_, WRAPPER))) {
    problems.push(`${console_}/${WRAPPER} is missing: the console has no stacking Table.`);
  }
  for (const sub of SCAN) {
    const dir = join(ROOT, console_, sub);
    if (!existsSync(dir)) {
      console.error(`check:table-stack: ${console_}/${sub} is missing, so this check would see nothing.`);
      process.exit(1);
    }
    for (const file of walk(dir)) {
      files++;
      const rel = relative(ROOT, file).split(sep).join('/');
      if (rel === `${console_}/${WRAPPER}`) continue;
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(SILICA_IMPORT)) {
        const names = match[1].split(',').map((name) => name.trim());
        if (names.includes('Table')) {
          problems.push(`${rel}: imports silicaui's Table; import the console's from ${WRAPPER}.`);
        }
      }
      const lines = source.split('\n');
      lines.forEach((line, index) => {
        if (/<Table\b/.test(line)) tables++;
        if (!/stack=\{false\}/.test(line)) return;
        const above = lines.slice(Math.max(0, index - 3), index).join('\n');
        if (!/\/\/|\/\*|\{\/\*/.test(above)) {
          problems.push(`${rel}:${index + 1}: stack={false} with no comment saying why.`);
        }
      });
    }
  }
}

if (files < 100 || tables < 100) {
  console.error(
    `check:table-stack: scanned ${files} files and ${tables} tables, too few to trust. Did the folders move?`
  );
  process.exit(1);
}

if (problems.length) {
  console.error(`check:table-stack: ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`check:table-stack: ${tables} tables in ${files} files, every one through the console's Table.`);
