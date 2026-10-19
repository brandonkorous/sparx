#!/usr/bin/env node
// No em dash used as a sentence break in what a console puts on screen.
//
// The house rule is old and keeps being broken in new copy: a repeat order's
// empty state read "again and again — a candle every month, a box every
// quarter — and bills them each time", a placeholder read "Optional — the courier
// may need it" (sparx persona issue 309). Comments may use them; screen text may
// not. A dash standing alone as an empty value ('—') is a different thing and is
// allowed: the rule is about a dash BETWEEN words.
//
// The sparx twin of piggles/scripts/check-em-dashes.mjs, which covers the Piggles
// console and the shared seed packages; this console had no check at all.
//
// Fails on any hit, and when it scans fewer than 100 files (a moved folder must
// not turn this into a check that reads nothing and passes).

import fs from 'node:fs';
import path from 'node:path';

const ROOTS = [
  'sparx/apps/workbench/surfaces',
  'sparx/apps/workbench/components',
  'sparx/apps/workbench/lib',
];
const SENTENCE_DASH = /[A-Za-z,)] — [A-Za-z(]/;

let files = 0;
const hits = [];

function scan(file) {
  files++;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  let inBlock = false;
  lines.forEach((line, i) => {
    const t = line.trim();
    if (inBlock) {
      if (t.includes('*/')) inBlock = false;
      return;
    }
    if (t.startsWith('/*') || t.startsWith('{/*')) {
      inBlock = !t.includes('*/');
      return;
    }
    if (t.startsWith('//') || t.startsWith('*')) return;
    const code = line.replace(/\/\/.*$/, '').replace(/\{\/\*.*?\*\/\}/g, '');
    if (SENTENCE_DASH.test(code))
      hits.push(`${file.split(path.sep).join('/')}:${i + 1}: ${t.slice(0, 120)}`);
  });
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.next') walk(p);
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name)) {
      scan(p);
    }
  }
}

for (const root of ROOTS) walk(root);

if (files < 100) {
  console.error(
    `✗ check:em-dash: scanned only ${files} files; a folder moved, so this would read nothing.`
  );
  process.exit(1);
}
if (hits.length > 0) {
  console.error(
    `✗ check:em-dash: ${hits.length} em dash${hits.length === 1 ? '' : 'es'} between words in screen text:`
  );
  for (const hit of hits) console.error(`  ${hit}`);
  console.error('  Reword it: a full stop, a comma, brackets or a colon.');
  process.exit(1);
}
console.log(`✓ check:em-dash: ${files} files, no em dash between words in screen text.`);
