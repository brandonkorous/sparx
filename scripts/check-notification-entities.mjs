// Fails if a notification a rule writes cannot lead anywhere.
//
// A notification row carries `entity_type` + `entity_id` and NOTHING else about
// where it goes: the consumer looks the type up in `@wizeworks/links`' entity table
// and builds the address from that. So two mistakes make a notification a dead
// end, and neither one is visible from the seed that made it:
//
//   • an `entityType` that is not a key in that table. The lookup is an exact,
//     case-sensitive `Map.get`, and the seeds were written with PRISMA MODEL
//     names — 'Order', 'Subscription', 'ProductVariant' — against a table keyed
//     'order', 'subscription'. Every one of them resolved to undefined.
//   • an `entityType` whose route takes an id, with no `entityId` alongside it.
//     `destinationFor` returns null rather than open a detail surface with no
//     record, so the row announces something and then makes you go find it.
//
// Both shipped. Both are silent: a dead-end notification looks exactly like a
// working one until somebody clicks it, and nothing in a type system, a lint
// rule or a unit test connects a string in a seed to a key in another package.
//
// WHY A SCRIPT. Same reason as check-surface-routes: the two sides are pure data
// in two packages that have no dependency on each other, and adding one just to
// assert a string set would be a real coupling to pay for a check. Both sides
// declare their keys as literals, so reading the literals is sufficient.
//
// Zero dependencies on purpose: CI runs it with bare Node, no install.

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const ROUTES_FILE = 'wizeworks/packages/links/src/routes.ts';
// Every file that configures a `platform.notify` action. A new seed file added
// outside this list is invisible here — which is why the count is printed below
// rather than a bare tick.
const SEED_FILES = ['wizeworks/packages/automation-actions/src/seeds/notifications.ts'];

/** Strip `//` line comments so a key quoted in prose is not read as a declaration. */
function decomment(source) {
  return source
    .split('\n')
    .map((line) => {
      const marker = line.indexOf('//');
      return marker === -1 ? line : line.slice(0, marker);
    })
    .join('\n');
}

function read(relative) {
  const absolute = join(repoRoot, relative);
  if (!existsSync(absolute)) {
    console.error(
      `check-notification-entities: ${relative} does not exist. This check scans a fixed list of paths, so a moved file makes it pass over nothing. Fix the list before trusting it.`
    );
    process.exit(1);
  }
  return decomment(readFileSync(absolute, 'utf8'));
}

// --- The entity table -------------------------------------------------------
const routesSource = read(ROUTES_FILE);
// `entity` and its `path` come from one object literal, so pair them by walking
// the route entries rather than collecting two independent sets.
const entities = new Map();
for (const block of routesSource.split(/\n\s*\{/)) {
  const entity = /\bentity:\s*'([^']+)'/.exec(block)?.[1];
  if (!entity) continue;
  const path = /\bpath:\s*'([^']+)'/.exec(block)?.[1];
  if (path) entities.set(entity, path);
}
// Single-line entries (`{ path: '…', surface: '…', entity: '…' }`) survive the
// split above only when they begin a line; catch the rest directly.
for (const match of routesSource.matchAll(/\{[^{}]*\bentity:\s*'([^']+)'[^{}]*\}/g)) {
  const path = /\bpath:\s*'([^']+)'/.exec(match[0])?.[1];
  if (path && !entities.has(match[1])) entities.set(match[1], path);
}

if (entities.size === 0) {
  console.error(
    `check-notification-entities: read 0 entity types out of ${ROUTES_FILE} — the file changed shape. Fix this script before trusting it.`
  );
  process.exit(1);
}

// --- What the seeds claim ---------------------------------------------------
// One `config: { … }` per notify action, so the entityType and entityId that
// belong together are read together.
const problems = [];
let configs = 0;

for (const relative of SEED_FILES) {
  const source = read(relative);
  for (const match of source.matchAll(/\bentityType:\s*'([^']+)'/g)) {
    configs += 1;
    const entityType = match[1];
    // The rest of this action's config — enough to see whether an id rides along.
    const tail = source.slice(match.index, match.index + 400);
    const scope = tail.slice(0, tail.indexOf('},') === -1 ? tail.length : tail.indexOf('},'));
    const hasId = /\bentityId:\s*'/.test(scope);

    const path = entities.get(entityType);
    if (path === undefined) {
      problems.push(
        `${relative}: entityType '${entityType}' is not an entity in ${ROUTES_FILE}. ` +
          `It must be the route table's key (lowercase, e.g. 'order'), not a Prisma model name.`
      );
      continue;
    }
    if (path.includes('/:') && !hasId) {
      problems.push(
        `${relative}: entityType '${entityType}' lives at ${path}, which takes a record id, ` +
          `but this notify config sets no entityId. The notification would open nothing.`
      );
    }
  }
}

if (configs === 0) {
  console.error(
    `check-notification-entities: found 0 entityType declarations across ${SEED_FILES.length} seed file(s) — either they moved or they changed shape. Fix this script before trusting it.`
  );
  process.exit(1);
}

if (problems.length > 0) {
  console.error(`\n${problems.length} notification(s) would lead nowhere:\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error('');
  process.exit(1);
}

console.log(
  `check-notification-entities: ${configs} notification config(s) across ${SEED_FILES.length} file(s), all resolvable against ${entities.size} entity types.`
);
