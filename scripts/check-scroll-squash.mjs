#!/usr/bin/env node
// A SCROLLING COLUMN THAT SQUASHES ITS OWN CONTENT.
//
// `PANE_SHELL_SCROLL` in components/pane-toolbar.tsx has carried the reason in
// its own header since issue 505:
//
//     `[&>*]:shrink-0` is the whole reason this exists, and leaving it off does
//     not look like a bug - it looks like a shorter form. PANE_SHELL is a flex
//     column, and silica's `.card` sets `overflow: hidden`, which makes
//     `min-height: auto` resolve to 0: a card is then free to shrink below its
//     own content and clip the remainder, with no scrollbar of its own to get
//     it back.
//
// That is written about the pane SHELL. Fifty-nine INNER scroll columns in the
// two consoles were the same shape without it, and one of them was doing it on
// screen: Paying for what sold held two empty states, squashed both cards by
// about 130px each, and cut both explanations off mid-sentence. The outer
// column measured as fitting, so there was no scrollbar anywhere to reach the
// rest. Issue 724. [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// ── What counts ─────────────────────────────────────────────────────────────
//
// A `<div>` whose own classes make it BOTH a flex column AND a scroller. If it
// scrolls, its children must keep their height; that is what scrolling is for.
//
// A column whose own direct child carries `flex-1` is left alone: there the
// child is deliberately filling the column, and `shrink-0` would be arguing
// with the instruction that file already gave. Four of those exist and they are
// listed below rather than detected, so adding a fifth is a decision somebody
// makes on purpose.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..').split('\\').join('/');
const ROOTS = [`${ROOT}/piggles/apps/workbench`, `${ROOT}/sparx/apps/workbench`];

/** Columns whose child is meant to fill them, by file and the line it starts on. */
const A_CHILD_FILLS_IT = [
  'piggles/apps/workbench/surfaces/crm/mailboxes-list.tsx',
  'piggles/apps/workbench/surfaces/crm/phone-systems-list.tsx',
  'sparx/apps/workbench/surfaces/crm/mailboxes-list.tsx',
  'sparx/apps/workbench/surfaces/crm/phone-systems-list.tsx',
];

for (const path of ROOTS) {
  if (!existsSync(path)) {
    console.error(`check:scroll-squash — ${path} is not there. The tree has moved.`);
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

/** Past a comment, which JSX allows BETWEEN attributes. */
function skipComment(src, i) {
  if (src[i] !== '/') return i;
  if (src[i + 1] === '/') {
    const nl = src.indexOf('\n', i);
    return nl === -1 ? src.length : nl;
  }
  if (src[i + 1] === '*') {
    const end = src.indexOf('*/', i + 2);
    return end === -1 ? src.length : end + 2;
  }
  return i;
}

/** End of a JSX open tag: quote-aware, brace-aware, comment-aware. */
function openTagEnd(src, i) {
  let depth = 0;
  let quote = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === quote && src.charCodeAt(i - 1) !== 92) quote = null;
      continue;
    }
    if (c === '/') {
      const skipped = skipComment(src, i);
      if (skipped !== i) {
        i = skipped;
        continue;
      }
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return i;
  }
  return -1;
}

let found = 0;
const failures = [];

for (const root of ROOTS) {
  for (const path of walk(root)) {
    const file = path.split('\\').join('/');
    const repoPath = file.slice(ROOT.length + 1);
    const src = readFileSync(path, 'utf8');
    for (const m of src.matchAll(/<div\b/g)) {
      const end = openTagEnd(src, m.index);
      if (end === -1) continue;
      const cls = /className="([^"]*)"/.exec(src.slice(m.index, end + 1))?.[1];
      if (cls === undefined) continue;
      if (!/\bflex-col\b/.test(cls) || !/\boverflow-(?:y-)?auto\b/.test(cls)) continue;
      found++;
      if (/\[&>\*\]:shrink-0/.test(cls)) continue;
      if (A_CHILD_FILLS_IT.includes(repoPath)) continue;
      failures.push({
        where: `${repoPath}:${String(src.slice(0, m.index).split('\n').length)}`,
      });
    }
  }
}

if (found === 0) {
  console.error(
    'check:scroll-squash — found no scrolling columns at all. The scan resolved nothing.'
  );
  process.exit(1);
}

if (failures.length > 0) {
  console.error(
    `\n${String(failures.length)} scrolling column(s) can squash their own content flat:\n`
  );
  for (const f of failures) console.error(`  ${f.where}`);
  console.error('\nAdd `[&>*]:shrink-0`. The header of this file says why.\n');
  process.exit(1);
}

console.log(
  `${String(found)} scrolling columns in the two consoles, and every one of them keeps its children their own height.`
);
