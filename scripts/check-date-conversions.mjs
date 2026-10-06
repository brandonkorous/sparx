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
 *
 * ---------------------------------------------------------------------------
 * The second problem: a time read on the wrong clock (sparx persona issue 086)
 * ---------------------------------------------------------------------------
 *
 * Renée booked a Diesel oil change for 9:00 AM on Saturday, October 3, in Salt
 * Lake City. The staff booking pane's header said 9:00 AM. Its "Move it" box
 * said 08:00 AM, because the console was open on a computer set to Pacific
 * time. `<input type="datetime-local">` holds a wall time with no zone, and the
 * only zone the browser can read it in is the computer's, so every booking box
 * in both consoles read and wrote the computer's clock while the rest of the
 * page used the business's. Move the booking from there and it lands an hour
 * out, with nothing on screen to say so.
 *
 * This check did not catch it, and could not have: rule 1 asks whether a
 * conversion can THROW, and `fromLocalInputValue` guarded its NaN, so it was a
 * perfectly safe conversion to the wrong moment. `check:calendar-dates` did not
 * either: it scans the server for `@db.Date` columns, and a booking's start is
 * a moment, not a date, in a console it does not read. Neither rule ever asked
 * WHOSE CLOCK a typed time is on. These two do:
 *
 *   2. A file that draws a datetime-local box imports `lib/wall-clock` (or the
 *      automations' `wallTimeInZone`/`isoFromWallTime`), which converts on a
 *      zone it is GIVEN and says which. Files that drew one before this rule
 *      existed are pinned in WALL_DEBT, a list that can only shrink.
 *
 *   3. Where a booking's time is typed or shown (the scheduling surfaces of
 *      both consoles and the site's booking components) the computer's-clock
 *      idioms are refused outright: the local-midnight and local-moment helpers
 *      from lib/today, `localTimezone()`, `getTimezoneOffset()`, and a day
 *      turned into a moment with a bare `new Date(`${day}T00:00`)`. A booking
 *      happens where the business is; there is no case for the reader's clock.
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

/* ── Rule 2: a time box names its clock ─────────────────────────────────── */

/** A datetime-local box, as a string literal (attribute or expression). */
const TIME_BOX = /['"]datetime-local['"]/;

/** What naming the clock looks like: the shared module, or the automations'
 *  own pair (which converts on the business zone it is handed). */
const NAMES_A_CLOCK = /from '[^']*lib\/wall-clock'|\bwallTimeInZone\b|\bisoFromWallTime\b/;

/** Where the clocks live, so they may say "datetime-local" in their prose. */
const WALL_EXEMPT = new Set(['lib/today.ts', 'lib/wall-clock.ts']);

/**
 * Files that drew a datetime-local box on the computer's clock when rule 2 was
 * written (2026-10-02). Each is a real instance of issue 086's defect outside
 * scheduling: a discount's start, a post's send time, a task's due time. This
 * list may only SHRINK. A file that stops offending must come off it.
 */
const WALL_DEBT = new Set([
  'piggles/apps/workbench/surfaces/cms/content-detail.tsx',
  'piggles/apps/workbench/surfaces/cms/schema-form.tsx',
  'piggles/apps/workbench/surfaces/commerce/discount-form-limits.tsx',
  'piggles/apps/workbench/surfaces/commerce/product-attributes.tsx',
  'piggles/apps/workbench/surfaces/crm/custom-properties-panel.tsx',
  'piggles/apps/workbench/surfaces/crm/task-detail.tsx',
  'piggles/apps/workbench/surfaces/email/broadcast-compose-delivery.tsx',
  'piggles/apps/workbench/surfaces/partner/bootcamp-detail.tsx',
  'piggles/apps/workbench/surfaces/social/composer.tsx',
  'sparx/apps/workbench/surfaces/cms/content-detail.tsx',
  'sparx/apps/workbench/surfaces/cms/schema-form.tsx',
  'sparx/apps/workbench/surfaces/commerce/discount-detail.tsx',
  'sparx/apps/workbench/surfaces/commerce/product-attributes.tsx',
  'sparx/apps/workbench/surfaces/crm/custom-properties-panel.tsx',
  'sparx/apps/workbench/surfaces/crm/task-detail.tsx',
  'sparx/apps/workbench/surfaces/email/broadcast-detail.tsx',
  'sparx/apps/workbench/surfaces/partner/bootcamp-detail.tsx',
  'sparx/apps/workbench/surfaces/social/composer.tsx',
]);

/* ── Rule 3: no computer's clock where a booking's time lives ───────────── */

/** Where a booking's time is typed or shown. Each is ASSERTED to exist. */
const BOOKING_TREES = [
  'piggles/apps/workbench/surfaces/scheduling',
  'sparx/apps/workbench/surfaces/scheduling',
  'wizeworks/apps/site/components/booking',
  'wizeworks/apps/site/components/account',
];

/** The site's booking clock is where the zone arithmetic lives, including its
 *  one deliberate fallback to the reader's midnight when a business has no zone. */
const BOOKING_EXEMPT = new Set(['wizeworks/apps/site/components/booking/booking-clock.ts']);

const COMPUTERS_CLOCK = [
  /\b(dayStartLocal|dayEndLocal|dayTimeLocal|localMomentInstant)\s*\(/,
  /\b(toLocalInputValue|fromLocalInputValue|localTimezone)\s*\(/,
  /\bgetTimezoneOffset\s*\(/,
  /new Date\(`\$\{[^}]+\}T00:00(?::00)?`\)/,
];

const missingBooking = BOOKING_TREES.filter((t) => !existsSync(join(ROOT, t)));
if (missingBooking.length > 0) {
  console.error('check-date-conversions: these booking scan roots do not exist:');
  for (const t of missingBooking) console.error(`  ${t}`);
  console.error('\nThe paths moved. Update BOOKING_TREES, or rule 3 scans nothing and passes.');
  process.exit(1);
}

let scanned = 0;
const offences = [];
const wallOffences = [];
const wallPaid = new Set(WALL_DEBT);
let boxes = 0;

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

// Rule 2 walks the same trees, without rule 1's exemption list.
for (const tree of TREES) {
  const base = join(ROOT, tree);
  for (const file of walk(base)) {
    const rel = relative(base, file).split(sep).join('/');
    if (WALL_EXEMPT.has(rel)) continue;
    const src = readFileSync(file, 'utf8');
    if (!TIME_BOX.test(src)) continue;
    boxes += 1;
    const where = `${tree}/${rel}`;
    if (NAMES_A_CLOCK.test(src)) continue;
    if (WALL_DEBT.has(where)) {
      wallPaid.delete(where);
      continue;
    }
    const at = src.search(TIME_BOX);
    wallOffences.push(`${where}:${src.slice(0, at).split('\n').length}`);
  }
}

let bookingScanned = 0;
const clockOffences = [];
for (const tree of BOOKING_TREES) {
  const base = join(ROOT, tree);
  for (const file of walk(base)) {
    const where = `${tree}/${relative(base, file).split(sep).join('/')}`;
    if (BOOKING_EXEMPT.has(where)) continue;
    bookingScanned += 1;
    const src = readFileSync(file, 'utf8');
    for (const pattern of COMPUTERS_CLOCK) {
      const found = pattern.exec(src);
      if (!found) continue;
      const line = src.slice(0, found.index).split('\n').length;
      clockOffences.push({ where: `${where}:${line}`, code: found[0] });
    }
  }
}

if (scanned === 0) {
  console.error('check-date-conversions: scanned 0 files. The globs match nothing.');
  process.exit(1);
}

if (boxes === 0 || bookingScanned === 0) {
  console.error('check-date-conversions: rule 2 or 3 found nothing to look at. The scan is blind.');
  process.exit(1);
}

let failed = false;

if (offences.length > 0) {
  failed = true;
  console.error(`check-date-conversions: ${offences.length} conversion(s) can throw.\n`);
  for (const o of offences) console.error(`  ${o.where}\n    ${o.code}\n`);
  console.error('Each one throws RangeError on a year the date box itself allows.');
  console.error('Use a helper from lib/today.ts (they return null), or guard');
  console.error('Number.isNaN(at.getTime()) before calling toISOString().\n');
}

if (wallPaid.size > 0) {
  failed = true;
  console.error('check-date-conversions: these are pinned in WALL_DEBT and no longer offend.');
  console.error('Take them off the list, so it keeps meaning something:\n');
  for (const p of [...wallPaid].sort()) console.error(`  ${p}`);
  console.error('');
}

if (wallOffences.length > 0) {
  failed = true;
  console.error(
    `check-date-conversions: ${wallOffences.length} datetime-local box(es) on this computer's clock.\n`
  );
  for (const o of wallOffences) console.error(`  ${o}`);
  console.error(
    '\nThat box has no zone, so the browser reads it on the clock of whatever computer\n' +
      'it is open on, while the business works on its own. Convert with wallValue /\n' +
      'instantFromWall from lib/wall-clock, on the zone the time belongs to, and say\n' +
      'which zone under the box (wallClockHint). See sparx persona issue 086.\n'
  );
}

if (clockOffences.length > 0) {
  failed = true;
  console.error(
    `check-date-conversions: ${clockOffences.length} use(s) of the computer's clock where a booking's time lives.\n`
  );
  for (const o of clockOffences) console.error(`  ${o.where}\n    ${o.code}`);
  console.error(
    '\nA booking happens where the business is. Read and write its times on the\n' +
      "booking's zone (lib/wall-clock in the consoles, components/booking/booking-clock\n" +
      "on the site), never on the reader's. See sparx persona issue 086.\n"
  );
}

if (failed) process.exit(1);

console.log(
  `check-date-conversions: ${scanned} files, no unguarded conversions. ` +
    `${boxes} files draw a datetime-local box, ${boxes - (WALL_DEBT.size - wallPaid.size)} on a named clock, ` +
    `${WALL_DEBT.size - wallPaid.size} pinned as debt. ${bookingScanned} booking files on the business clock.`
);
