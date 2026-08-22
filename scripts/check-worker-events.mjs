#!/usr/bin/env node
/**
 * A worker may not claim to route an event that nobody can publish.
 *
 * ─── THE FAILURE THIS EXISTS FOR ────────────────────────────────────────────
 *
 * `@wizeworks/commerce-indexer` — the worker that puts orders, products and
 * customers into search — routed `order.created` and `order.payment.recorded`.
 * Neither is an event. The catalog's names are `order.placed` and `order.paid`,
 * and CLAUDE.md says in as many words that there is no `order.created`.
 *
 * A `case` for an event nobody publishes is dead code that reads exactly like
 * coverage. So the four surviving cases were all LATER lifecycle events, and an
 * order entered the search index for the first time only once it was cancelled,
 * fulfilled, delivered or refunded. The one moment an order most needs to be
 * findable — just placed, with the customer on the phone about it — was the one
 * moment it was not there. Searching a real order number in the console answered
 * "Nothing matches that" while the activity bar in the same window reported the
 * checkout that created it.
 *
 * `check:events` could not see it: that compares the EventType union against
 * provisioned topics. Both directions of THAT are healthy while a handler routes
 * a name from neither list.
 *
 * ─── WHAT IS CHECKED ────────────────────────────────────────────────────────
 *
 * Two claims, per worker package:
 *
 *   1. Every name in its exported `EVENTS` subscription list is a real event.
 *      A subscription to a name nobody publishes is a consumer that never runs.
 *   2. Every `case '<something>.<something>':` in its handler is a real event.
 *      This is the half that bit — the subscription list and the handler drifted
 *      apart, and neither one on its own looked wrong.
 *
 * "Real" means present in one of the same catalogs `check:events` reads, so the
 * two checks can never disagree about what an event is.
 *
 * A handler `case` for something that is not an event name at all (a status
 * string, an entity type) is ignored — only dotted, lower-case, event-shaped
 * literals are judged, which is what an event name looks like and what a status
 * does not.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** The same catalogs check:events reads. If a third is added, add it to BOTH. */
const CATALOGS = [
  { file: 'wizeworks/packages/events/src/types.ts', type: 'EventType' },
  { file: 'wizeworks/packages/crm/src/events.ts', type: 'CrmTopic' },
];

const SCAN_ROOTS = ['wizeworks/packages', 'wizeworks/services'];

/** Event-shaped: dotted, lower-case, no spaces. `order.placed`, yes; `paid`, no. */
const EVENT_SHAPED = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

function fail(...lines) {
  console.error('\nWorker event check FAILED:');
  for (const l of lines) console.error('  ' + l);
  console.error('');
  process.exit(1);
}

function stripLineComments(src) {
  return src
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n');
}

function knownEvents() {
  const names = new Set();
  for (const cat of CATALOGS) {
    const abs = join(ROOT, cat.file);
    if (!existsSync(abs)) {
      fail(cat.file + ' does not exist — this check cannot tell a real event from a typo.');
    }
    const src = stripLineComments(readFileSync(abs, 'utf8'));
    const start = src.indexOf('export type ' + cat.type);
    if (start === -1) fail(cat.file + ' no longer declares `export type ' + cat.type + '`.');
    const end = src.indexOf(';', start);
    for (const m of src.slice(start, end).matchAll(/'([^']+)'/g)) names.add(m[1]);
  }
  if (names.size < 50) {
    fail('Only ' + names.size + ' event name(s) parsed — the catalogs did not read properly.');
  }
  return names;
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.turbo') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.tsx?$/.test(entry) && !entry.includes('.test.')) files.push(full);
  }
  return files;
}

const EVENTS_LIST = /export const EVENTS\s*(?::[^=]+)?=\s*\[([\s\S]*?)\]/;
const CASE_LITERAL = /case\s+'([^']+)'\s*:/g;

const known = knownEvents();
const problems = [];
let workers = 0;
let claims = 0;

for (const root of SCAN_ROOTS) {
  const abs = join(ROOT, root);
  if (!existsSync(abs)) {
    fail('scan root is missing: ' + root, 'A moved tree makes this check blind. Fix the path.');
  }
  for (const name of readdirSync(abs)) {
    const dir = join(abs, name);
    if (!statSync(dir).isDirectory()) continue;
    const src = join(dir, 'src');
    if (!existsSync(src)) continue;

    // A worker is a package that declares a subscription list.
    const files = walk(src);
    const hasEvents = files.some((f) => EVENTS_LIST.test(readFileSync(f, 'utf8')));
    if (!hasEvents) continue;
    workers += 1;

    for (const file of files) {
      const text = stripLineComments(readFileSync(file, 'utf8'));
      const rel = relative(ROOT, file).split(sep).join('/');

      const list = EVENTS_LIST.exec(text);
      if (list) {
        for (const m of list[1].matchAll(/'([^']+)'/g)) {
          claims += 1;
          if (!known.has(m[1])) {
            problems.push({ where: rel, name: m[1], how: 'subscribed to in EVENTS' });
          }
        }
      }

      for (const m of text.matchAll(CASE_LITERAL)) {
        const literal = m[1];
        if (!EVENT_SHAPED.test(literal)) continue;
        claims += 1;
        if (!known.has(literal)) {
          problems.push({ where: rel, name: literal, how: 'routed by a `case`' });
        }
      }
    }
  }
}

// A count of zero is not a pass. Every sibling check in this repo that went
// blind did it by scanning nothing and printing OK, and this one found zero
// workers on its very first run (the EVENTS regex did not allow for the space
// before `=`). If the shape of a worker changes, this must go red, not quiet.
if (workers === 0 || claims === 0) {
  fail(
    'found ' + workers + ' worker(s) and ' + claims + ' event claim(s).',
    'That is not a pass — it means this check is no longer looking at anything.',
    'Update the patterns to match how workers declare their events now.'
  );
}

console.log(
  'Worker event check: ' +
    workers +
    ' worker(s), ' +
    claims +
    ' event claim(s) checked against ' +
    known.size +
    ' declared event(s).'
);

if (problems.length > 0) {
  console.error(
    '\nWorker event check FAILED: ' + problems.length + ' claim(s) name no real event.\n'
  );
  for (const p of problems) {
    console.error(
      '  ' + p.where + '\n    ' + p.name + ' — ' + p.how + ', but no catalog declares it\n'
    );
  }
  console.error('  A handler that routes an event nobody publishes is dead code that reads as');
  console.error('  coverage. Check the name against wizeworks/packages/events/src/types.ts.\n');
  process.exit(1);
}
console.log('OK: every worker subscription and handler case names a real event.');
