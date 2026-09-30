#!/usr/bin/env node
/**
 * Fails if a date-only column is sent down the wire as a moment.
 *
 * ---------------------------------------------------------------------------
 * The problem this exists for
 * ---------------------------------------------------------------------------
 *
 * A calendar date is not a moment. "19 September" is the same day in every zone
 * on earth; `2026-09-19T00:00:00.000Z` is not.
 *
 * "Stock versus your books" records a balance against a DAY. Its table is unique
 * on (tenant_id, as_of, account_name), so the day IS the row's identity, and the
 * copy under the form promises it: "recorded per date, so last year's
 * reconciliation keeps saying what it said."
 *
 * A balance typed on 19 September, stored correctly as `2026-09-19`, came back
 * as `2026-09-19T00:00:00.000Z` and appeared on screen as Sep 18 - the reader
 * was seven hours behind UTC, and a Timestamp renders a moment where the reader
 * is. Timestamp is not at fault. It is for moments.
 *
 * The write half was wrong the other way: the picker sent
 * `new Date(picked).toISOString()`, so a shop owner in London recording a
 * balance at 00:30 filed it under yesterday, and one in Los Angeles at 6pm filed
 * it under tomorrow.
 *
 * MEASURED 2026-09-19: 32 `@db.Date` columns on the schema, 22 distinct field
 * names. Every one is a day somebody chose - an expected close date, a holiday,
 * a shift worked, a certificate's expiry, a contract's effective-from, a
 * rollup's bucket.
 *
 * ---------------------------------------------------------------------------
 * The rule
 * ---------------------------------------------------------------------------
 *
 * A field declared `@db.Date` must not be serialized with `.toISOString()`.
 * Use `calendarDate()` from `@wizeworks/inventory`, which writes `YYYY-MM-DD`,
 * and draw it with `CalendarDate` rather than `Timestamp`.
 *
 * The field list is READ FROM THE SCHEMA, not hard-coded, so a `@db.Date` column
 * added next year is covered the moment it is added.
 *
 * ---------------------------------------------------------------------------
 * The debt, and why it is pinned rather than swept
 * ---------------------------------------------------------------------------
 *
 * 17 files were already doing it when this was written. They are NOT a sweep to
 * do in one pass, for two reasons:
 *
 *   1. Changing the wire format ALONE makes things worse, not better. A console
 *      that does `new Date(value)` on a `YYYY-MM-DD` still lands on midnight UTC
 *      and still draws the day before. Each server fix has to land with its
 *      render site in the same commit.
 *      [[feedback_a_fix_leaves_its_neighbour_behind]]
 *   2. `calendarDate` lives in `@wizeworks/inventory`, and b2b, commerce, staff
 *      and finance cannot import from there. Its home is `@wizeworks/api-core`,
 *      beside `envelope.ts` and `slug.ts`, and moving it means adding a
 *      dependency to four packages, which means an install.
 *
 * So the list can only SHRINK. A file leaving it is a file fixed; nothing may
 * join it.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const SCHEMA = 'wizeworks/packages/db/prisma/schema';
const TREES = ['wizeworks/packages', 'wizeworks/services'];

const missing = [SCHEMA, ...TREES].filter((t) => !existsSync(join(ROOT, t)));
if (missing.length > 0) {
  console.error('check-calendar-dates: these paths do not exist:');
  for (const t of missing) console.error(`  ${t}`);
  console.error('\nThey moved. Update the paths, or this check scans nothing and passes.');
  process.exit(1);
}

/** Files already doing it on 2026-09-19. This list may only shrink. */
const DEBT = new Set([
  'wizeworks/packages/b2b/src/pricing-tiers.ts',
  'wizeworks/packages/commerce-schemas/src/accounting.ts',
  'wizeworks/packages/commerce/src/services/market/settlement.ts',
  'wizeworks/packages/commerce/src/services/pricing-service.ts',
  'wizeworks/packages/commerce/src/services/tax-service.ts',
  'wizeworks/packages/finance/src/accounting/providers/xero.ts',
  'wizeworks/packages/inventory/src/services/bins.ts',
  'wizeworks/packages/inventory/src/services/consignment.ts',
  'wizeworks/packages/inventory/src/services/cost-reports.ts',
  'wizeworks/packages/inventory/src/services/provenance.ts',
  'wizeworks/packages/inventory/src/services/public-api.ts',
  'wizeworks/packages/inventory/src/services/report-schedules.ts',
  'wizeworks/packages/staff/src/commission-calc.ts',
  'wizeworks/services/api-rest/src/routes/internal/operator-partners.ts',
  'wizeworks/services/api-rest/src/routes/v1/finance/profit.ts',
  'wizeworks/services/api-rest/src/routes/v1/inventory/stock.ts',
  'wizeworks/services/api-rest/src/routes/v1/scheduling/availability.ts',
]);

/** Every field name declared `@db.Date`, read from the schema itself. */
function dateOnlyFields() {
  const names = new Set();
  const dir = join(ROOT, SCHEMA);
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.prisma')) continue;
    for (const line of readFileSync(join(dir, file), 'utf8').split('\n')) {
      if (!line.includes('@db.Date')) continue;
      const match = /^\s*(\w+)\s+DateTime/.exec(line);
      if (match?.[1] !== undefined) names.add(match[1]);
    }
  }
  return [...names];
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.turbo' || name === '.next') {
      continue;
    }
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.ts$/.test(name) && !/\.test\.ts$/.test(name)) yield full;
  }
}

const fields = dateOnlyFields();
if (fields.length === 0) {
  console.error('check-calendar-dates: no @db.Date columns found. The schema moved or changed.');
  process.exit(1);
}
const pattern = new RegExp(`\\b(${fields.join('|')})\\??\\.toISOString\\(\\)`, 'g');

let scanned = 0;
const offences = [];
const paid = new Set(DEBT);

for (const tree of TREES) {
  const base = join(ROOT, tree);
  for (const file of walk(base)) {
    const rel = `${tree}/${relative(base, file).split(sep).join('/')}`;
    scanned += 1;
    const src = readFileSync(file, 'utf8');
    pattern.lastIndex = 0;
    const found = [...src.matchAll(pattern)];
    if (found.length === 0) continue;
    if (DEBT.has(rel)) {
      paid.delete(rel);
      continue;
    }
    for (const match of found) {
      offences.push({
        where: `${rel}:${src.slice(0, match.index).split('\n').length}`,
        code: match[0],
      });
    }
  }
}

console.log(
  `check-calendar-dates: ${String(scanned)} files, ${String(fields.length)} date-only field names ` +
    `from the schema, ${String(DEBT.size - paid.size)} of ${String(DEBT.size)} pinned files still owing.`
);

if (paid.size > 0) {
  console.error('\nThese are pinned as debt and no longer offend. Take them out of DEBT:\n');
  for (const p of [...paid].sort()) console.error(`  ${p}`);
  process.exit(1);
}

if (offences.length > 0) {
  console.error(`\n${String(offences.length)} date-only column(s) sent as a moment:\n`);
  for (const o of offences) console.error(`  ${o.where}\n      ${o.code}`);
  console.error(
    '\nA calendar date is the same day in every zone; a timestamp is not. Use\n' +
      'calendarDate() from @wizeworks/inventory (YYYY-MM-DD) and draw it with\n' +
      'CalendarDate, not Timestamp. Fix the render site in the SAME commit:\n' +
      'changing only the wire format leaves the console drawing the day before.\n'
  );
  process.exit(1);
}

console.log('Every date-only column travels as the day it is.');
