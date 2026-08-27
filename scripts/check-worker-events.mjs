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
 *   3. Every event a handler routes is one the worker actually SUBSCRIBES to.
 *      Claims 1 and 2 judge each list against the catalog and never against each
 *      other, so this check could watch the drift it was written for happen
 *      again — and did. `commerce-indexer` routed all four `crm.customer.*`
 *      events in its handler and asked for none of them in `EVENTS`, so the
 *      customers collection never received a single real customer while both
 *      halves read as healthy: the cases name real events, the subscription
 *      names real events, and nothing compared them. The console answered
 *      "Nothing in your orders, customers or products matches" for a shopper in
 *      the owner's own customer list (issue 281).
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
  // Strip CR FIRST. The regex below is `//.*$`, and `.` does not match a CR, so
  // on a CRLF file `$` never matches and NO comment is ever stripped. That is not
  // cosmetic here: the catalog scan stops at the first `;`, and `types.ts` carries
  // a comment reading "toggles a module flag; consumed to seed module defaults"
  // barely 800 characters in. On a CRLF working tree this check read SIX event
  // names out of 169 and then failed 78 perfectly healthy workers. `.gitattributes`
  // says LF, so the COMMITTED file is fine and CI passed while every Windows
  // pre-push went red — the sibling `check-event-topics.mjs` hit the identical bug
  // the same day. Fix it in both or in neither.
  return src
    .replace(/\r/g, '')
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
    const before = names.size;
    for (const m of src.slice(start, end).matchAll(/'([^']+)'/g)) names.add(m[1]);
    // Measured PER CATALOG, not on the total. A floor on the sum is barely a floor
    // at all: when the CRLF bug above cut `EventType` from 169 names to 6, the 54
    // the CRM catalog still contributed carried the total past a threshold of 50
    // and the guard stayed silent while the check condemned 78 healthy workers.
    // A check that has gone blind must go RED, and it can only do that if every
    // source it reads is judged on its own.
    const parsed = names.size - before;
    if (parsed < 20) {
      fail(
        'Only ' + parsed + ' name(s) parsed from `' + cat.type + '` in ' + cat.file + '.',
        'That catalog did not read properly, so this check cannot tell a real event',
        'from a typo — every worker it judges after this point is judged on nothing.'
      );
    }
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

    // Gathered across the WHOLE package, because the two halves live in
    // different files — the subscription in `index.ts`, the routing in
    // `handler.ts` — which is precisely how they drift apart unnoticed.
    const subscribed = new Set();
    const routed = [];

    for (const file of files) {
      const text = stripLineComments(readFileSync(file, 'utf8'));
      const rel = relative(ROOT, file).split(sep).join('/');

      const list = EVENTS_LIST.exec(text);
      if (list) {
        for (const m of list[1].matchAll(/'([^']+)'/g)) {
          claims += 1;
          subscribed.add(m[1]);
          if (!known.has(m[1])) {
            problems.push({ where: rel, name: m[1], how: 'subscribed to in EVENTS' });
          }
        }
      }

      for (const m of text.matchAll(CASE_LITERAL)) {
        const literal = m[1];
        if (!EVENT_SHAPED.test(literal)) continue;
        claims += 1;
        routed.push({ name: literal, where: rel });
        if (!known.has(literal)) {
          problems.push({ where: rel, name: literal, how: 'routed by a `case`' });
        }
      }
    }

    // Claim 3. Only for names the catalog recognises — an unreal name is
    // already reported above, and saying it twice buries the first answer.
    for (const route of routed) {
      if (!known.has(route.name) || subscribed.has(route.name)) continue;
      claims += 1;
      problems.push({
        where: route.where,
        name: route.name,
        how: 'routed by a `case`',
        why: 'but this worker never subscribes to it in EVENTS',
      });
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
  console.error('\nWorker event check FAILED: ' + problems.length + ' bad claim(s).\n');
  // Two faults, reported as two different things. They used to share one
  // trailing sentence, "but no catalog declares it", which is the wrong
  // diagnosis for a name the catalog declares perfectly well and this worker
  // simply never asked for, and would send a reader off to edit the catalog.
  for (const p of problems) {
    const why = p.why ?? 'but no catalog declares it';
    console.error('  ' + p.where + '\n    ' + p.name + ' — ' + p.how + ', ' + why + '\n');
  }
  console.error('  A handler that routes an event it never receives is dead code that reads as');
  console.error('  coverage. Subscribe to it in EVENTS, delete the case, or fix the name.\n');
  process.exit(1);
}
console.log('OK: every worker subscription and handler case names a real event.');
