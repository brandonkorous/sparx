#!/usr/bin/env node
/**
 * Fails if a console turns a string into an instant somewhere it can throw.
 *
 * ---------------------------------------------------------------------------
 * The problem this exists for
 * ---------------------------------------------------------------------------
 *
 * `new Date(x).toISOString()` throws `RangeError: Invalid time value` when `x`
 * is not a date. That looks like a case that cannot happen, because the string
 * comes from an `<input type="date">` and a date box holds a date. It does not.
 * Chrome's year segment accepts SIX digits, so one slip on the year hands the
 * page "20266-09-01", and every engine makes an Invalid Date of that.
 *
 * Found on 2026-09-16 by a shop owner doing exactly what the screen had just
 * told her to do. Money -> Bills to pay had said "Open a cost and fill in Due
 * by", she opened one, mistyped the year, and:
 *
 *     RangeError: Invalid time value
 *       at Date.toISOString
 *       at dayStartUtc            (lib/today.ts)
 *       at dateValue              (surfaces/finance/expense-detail.tsx)
 *       at toDraft
 *       at ExpenseDetail.useMemo[draft]
 *
 * That call sat inside a render-time `useMemo`, so the throw reached the error
 * boundary: the whole editor was replaced by "This panel ran into a problem",
 * and her unsaved edit went with it. The same conversion appeared 44 more times
 * across the two consoles, most of them inside save handlers, where the same
 * typo makes the Save button do nothing at all and say nothing about why.
 *
 * ---------------------------------------------------------------------------
 * The rule
 * ---------------------------------------------------------------------------
 *
 * A conversion is allowed when the argument CANNOT be invalid:
 *
 *     new Date().toISOString()                   now
 *     new Date(Date.now() - DAY).toISOString()   arithmetic on now
 *     someDate.toISOString()                     already a Date
 *
 * Anything else — a variable, a template literal, a property — has to go
 * through `lib/today.ts`, whose helpers all return `string | null` instead of
 * throwing, or guard `Number.isNaN(at.getTime())` on the spot.
 *
 * `lib/today.ts` itself is exempt: it is where the guarding lives.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** The trees this scans. Each one is ASSERTED to exist: a check that silently
 *  scans nothing after a directory move prints a green tick over no work at
 *  all, which is worse than no check. */
const TREES = ['piggles/apps/workbench', 'sparx/apps/workbench'];

/** Where the guarding lives, so it is the one place allowed to call the raw
 *  constructor. Relative to a tree root. */
const EXEMPT = ['lib/today.ts'];

const missing = TREES.filter((t) => !existsSync(join(ROOT, t)));
if (missing.length > 0) {
  console.error('check-date-conversions: these scan roots do not exist:');
  for (const t of missing) console.error(`  ${t}`);
  console.error('\nThe paths moved. Update TREES, or this check scans nothing and passes.');
  process.exit(1);
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'dist') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.tsx?$/.test(name) && !name.endsWith('.test.ts')) yield full;
  }
}

/** `new Date(<arg>).toISOString()`, with the argument captured. */
const PATTERN = /new Date\(([^)]*)\)\s*\.toISOString\(\)/g;

/** An argument that cannot produce an Invalid Date: nothing at all, or pure
 *  numeric arithmetic, or `Date.now()` with arithmetic around it. */
function cannotBeInvalid(arg) {
  const a = arg.trim();
  if (a === '') return true;
  if (a.startsWith('Date.now')) return true;
  return /^[\d\s+*\-_.()]*$/.test(a);
}

let scanned = 0;
const offences = [];

for (const tree of TREES) {
  const base = join(ROOT, tree);
  for (const file of walk(base)) {
    const rel = relative(base, file).split(sep).join('/');
    if (EXEMPT.includes(rel)) continue;
    scanned += 1;
    const src = readFileSync(file, 'utf8');
    for (const match of src.matchAll(PATTERN)) {
      if (cannotBeInvalid(match[1])) continue;
      const line = src.slice(0, match.index).split('\n').length;
      offences.push({ where: `${tree}/${rel}:${line}`, code: match[0].slice(0, 90) });
    }
  }
}

if (scanned === 0) {
  console.error('check-date-conversions: scanned 0 files. The globs match nothing.');
  process.exit(1);
}

if (offences.length > 0) {
  console.error(`check-date-conversions: ${offences.length} conversion(s) can throw.\n`);
  for (const o of offences) console.error(`  ${o.where}\n    ${o.code}\n`);
  console.error('Each one throws RangeError on a year the date box itself allows.');
  console.error('Use a helper from lib/today.ts (they return null), or guard');
  console.error('Number.isNaN(at.getTime()) before calling toISOString().');
  process.exit(1);
}

console.log(`check-date-conversions: ${scanned} files, no unguarded conversions.`);
