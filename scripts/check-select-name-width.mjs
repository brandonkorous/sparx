#!/usr/bin/env node
// A WIDTH WE CHOSE, ON A NAME THE BUSINESS TYPED.
//
// A picker that lists warehouses, suppliers, staff or services is showing words
// nobody here wrote. Capping it at `max-w-40` says those words are at most
// 160px long, which is a guess about somebody else's business - and when the
// guess is wrong the name is not shortened, it is cut: the recipe pane's
// location picker read "Fulfillment Cente" with 700 pixels going spare beside
// it. A truncated name is worse than a long one, because a shop owner reads it
// as what she called the place.
//
// ── Why this needs a guard and not just a fix ───────────────────────────────
//
// PaneToolbar sets `[&>.select]:max-w-full` on its slots, which OUTRANKS a
// `max-w-*` written on the control itself. So inside a bar the cap does
// nothing, has never done anything, and looks like it works. Somebody widened
// the calendar's picker from `max-w-40` to `max-w-56` to stop "Everyone &
// equip" being clipped, wrote a note explaining the new number, and changed no
// pixel: the clipping was in the overflow popover and was fixed there (issue
// 717). Meanwhile the same JSX pattern copied into a CARD, where no slot
// releases it, clips for real.
//
// A cap on one of these is therefore either a lie or a defect, and which one it
// is depends on where the control happens to be drawn. Neither is worth
// keeping, so: none of them. `FITS_ITS_NAME` in components/pane-toolbar.tsx is
// what to reach for instead. [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// ── Deliberately narrow ─────────────────────────────────────────────────────
//
// It only flags a `<NativeSelect>` whose options come from something that is
// NOT a module-level array in the same file. Our own lists (`STATUS_OPTIONS`,
// `RANGE_PRESETS`, `SIZES`) are words we wrote and can measure, so they may be
// capped. Anything else is data. It under-reports rather than blocking a push
// over a guess. [[feedback_structural_checks_go_blind]]

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const ROOTS = [
  join(ROOT, 'piggles', 'apps', 'workbench'),
  join(ROOT, 'sparx', 'apps', 'workbench'),
];

/**
 * A list that is OURS, read through a helper rather than declared inline.
 *
 * `timezoneOptions()` returns the IANA zones. They are not a name anybody
 * typed, and the control is an ordinary form field with a form field's width.
 * Keyed by file and accessible name so it cannot spread.
 */
const OUR_OWN_WORDS = [['surfaces/scheduling/resource-detail.tsx', 'Time zone']];

for (const path of ROOTS) {
  if (!existsSync(path)) {
    console.error(`check:select-name-width — ${path} is not there. The tree has moved.`);
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

/** Past a comment. JSX allows one BETWEEN attributes, and prose has apostrophes. */
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

/** End of a JSX open tag. `>` inside a string, a brace or an arrow is not it. */
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

/**
 * Names declared at module scope as an array literal: words we wrote.
 *
 * SCREAMING_CASE counts wherever it is declared, including in the sibling data
 * module a surface imports it from. That is this codebase's spelling for a
 * fixed list, and following the import to prove it would buy nothing: a
 * constant list of statuses or date ranges is ours by definition.
 */
function ourLists(src) {
  const names = new Set();
  for (const m of src.matchAll(/^const ([a-zA-Z_][\w]*)[^=\n]*=\s*\[/gm)) names.add(m[1]);
  return names;
}

/** `RANGE_PRESETS`, `SIZES`, `STATUS_OPTIONS` — a list we wrote, wherever it lives. */
function isOurConstant(name) {
  return /^[A-Z][A-Z0-9_]*$/.test(name);
}

const MAP_SOURCE = /([A-Za-z0-9_$.?[\]]+)\s*\.map\(/;

let checked = 0;
const failures = [];

for (const root of ROOTS) {
  for (const path of walk(root)) {
    const file = path.split('\\').join('/');
    const src = readFileSync(path, 'utf8');
    const ours = ourLists(src);
    for (const m of src.matchAll(/<NativeSelect\b/g)) {
      const end = openTagEnd(src, m.index);
      if (end === -1) continue;
      const tag = src.slice(m.index, end + 1);
      const close = src.indexOf('</NativeSelect>', end);
      if (close === -1) continue;
      const mapped = MAP_SOURCE.exec(src.slice(end, close));
      if (!mapped) continue;

      const source = mapped[1];
      // An inline literal (`[7, 30, 90].map`) and a module list are both ours.
      if (source.endsWith(']') && !/^[A-Za-z_$]/.test(source)) continue;
      const base = /^[A-Za-z0-9_$]+/.exec(source)?.[0] ?? source;
      if (ours.has(base) || isOurConstant(base)) continue;

      const label = /aria-label="([^"]+)"/.exec(tag)?.[1] ?? '';
      if (OUR_OWN_WORDS.some(([f, l]) => file.endsWith(f) && l === label)) continue;

      checked++;
      const cap = /className="[^"]*\b(max-w-[\w.[\]-]+)/.exec(tag);
      if (!cap) continue;
      failures.push({
        // Repo-relative, because both consoles have a counts-list.tsx and
        // "counts-list.tsx:172" would name two different files.
        where: `${file.slice(ROOT.split('\\').join('/').length + 1)}:${String(src.slice(0, m.index).split('\n').length)}`,
        cap: cap[1],
        label: label || `options from ${source}`,
      });
    }
  }
}

if (checked === 0) {
  console.error(
    'check:select-name-width — found no pickers listing data at all. The scan resolved nothing.'
  );
  process.exit(1);
}

if (failures.length > 0) {
  console.error(
    `\n${String(failures.length)} picker(s) put a width WE chose on a name the business typed:\n`
  );
  for (const f of failures) {
    console.error(`  ${f.where}`);
    console.error(`      "${f.label}" is capped at ${f.cap}`);
  }
  console.error(
    '\nUse FITS_ITS_NAME from components/pane-toolbar.tsx. The header of this file says why.\n'
  );
  process.exit(1);
}

console.log(
  `${String(checked)} pickers list names the business typed, and not one of them is capped at a width we chose.`
);
