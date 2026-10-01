// Fails if a kind of record the search index knows how to build cannot be found,
// or cannot be opened once it is.
//
// The console's search box searches two things at once: the screens, and the
// records. When the record half finds nothing it says so, unqualified:
//
//   "Nothing in your records matches “welcome”. Everything below is a screen."
//
// `launcher-rows.tsx` explains why it is unqualified — it used to list what it
// looked through, got that wrong twice, and the fix chosen was to grow the index
// rather than keep a caveat in step with it. That makes the sentence a PROMISE
// about the whole index, and three separate things have to line up for it to be
// true of any one kind of record:
//
//   1. a PROJECTOR, so the record can be turned into a search document at all;
//   2. a WRITE-TIME SIGNAL, so a record that was just created or renamed reaches
//      the index without somebody running an ops task;
//   3. a ROUTE ENTITY BINDING, so clicking the hit opens the record rather than
//      resolving to undefined and doing nothing.
//
// Miss (1) and search says the business has nothing by that name while the thing
// is on screen. Miss (2) and it says so only for the records made since the last
// reindex, which is worse — it is right often enough to be trusted. Miss (3) and
// the hit is a dead row. All three are silent, and none of them is visible from
// the file you are editing when you add a projector.
//
// WHY A SCRIPT. The three sides are pure data in three packages with no
// dependency on each other (`@wizeworks/commerce`, `@wizeworks/commerce-indexer`,
// `@wizeworks/links`, plus every service that writes a record). Each declares its
// keys as string literals, so reading the literals is sufficient, and adding a
// dependency just to assert a string set would be a real coupling to pay for a
// check. Same reasoning as check-notification-entities and check-surface-routes.
//
// Zero dependencies on purpose: CI runs it with bare Node, no install.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Every file that declares universal-search projectors. A bundle added outside
 *  this list is invisible here — which is why the count is printed rather than a
 *  bare tick. [[feedback_structural_checks_go_blind]] */
const PROJECTOR_FILES = [
  'wizeworks/packages/commerce/src/universal-projection.ts',
  'wizeworks/packages/commerce-indexer/src/messaging-projection.ts',
];

const ROUTES_FILE = 'wizeworks/packages/links/src/routes.ts';

/** THE closed set of module slugs, read from the one file that declares it. */
const MODULES_FILE = 'wizeworks/packages/modules/src/index.ts';

/** Where `PLATFORM_MODULE` is declared — the reserved word for records that
 *  belong to no module and so can never be gated off. */
const PROJECTOR_CONTRACT = 'wizeworks/packages/search/src/projector.ts';

/** Where a write-time signal can be issued from. Whole tree, because the signal
 *  belongs beside the write and the writes are everywhere. */
const WRITE_ROOT = 'wizeworks';

/**
 * Projectors with NO write-time signal yet, each with the reason it is here.
 *
 * A record of one of these kinds reaches search only when somebody runs
 * `ops:reindex-search`, so a blog post published this morning is not findable
 * this afternoon. That is a real gap, never an exemption, and the list exists so
 * the number cannot grow quietly.
 *
 * EMPTY since 2026-09-18. It held `cms_entry`, `billing_document` and `media`
 * for one day; all three now signal from their write routes (and `media` again
 * from media-worker, which owns the 'uploading' → 'ready' flip).
 *
 * A fourth, `cms_page`, was never on this list and should have been — the check
 * counted it as signalled from an SEO audit snapshot that uses the same key for
 * a different purpose. See the note above §3. The lesson is that this list is
 * only as honest as what counts as a signal, so a name added here has to be a
 * gap somebody MEASURED, not one the scan happened to report.
 *
 * Shrink this list; never add to it.
 */
const NO_WRITE_SIGNAL_YET = new Map([]);

function die(lines) {
  console.error('');
  for (const line of lines) console.error(line);
  console.error('');
  process.exit(1);
}

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

function read(rel) {
  const full = join(repoRoot, rel);
  if (!existsSync(full)) {
    die([
      `✖ check:search-entities is looking for ${rel} and it is not there.`,
      '   It cannot report what it cannot read, and a check that scans nothing',
      '   prints a tick. Point it at the new location rather than leaving it blind.',
    ]);
  }
  return decomment(readFileSync(full, 'utf8'));
}

// ── 1. every projector ────────────────────────────────────────────────────────

const projectors = new Map(); // entityType -> file it is declared in
for (const file of PROJECTOR_FILES) {
  const source = read(file);
  const found = [...source.matchAll(/entityType:\s*'([\w-]+)'/g)].map((m) => m[1]);
  if (found.length === 0) {
    die([
      `✖ check:search-entities read ${file} and found no projectors in it.`,
      "   It matches `entityType: '…'`. If that shape changed, this check is",
      '   scanning a file it no longer understands. Fix the pattern, not the count.',
    ]);
  }
  for (const type of found) projectors.set(type, file);
}

// ── 2. every route that can open one ─────────────────────────────────────────

const routeSource = read(ROUTES_FILE);
const routed = new Set([...routeSource.matchAll(/entity:\s*'([\w-]+)'/g)].map((m) => m[1]));
if (routed.size === 0) {
  die([
    `✖ check:search-entities read ${ROUTES_FILE} and found no entity bindings.`,
    "   It matches `entity: '…'`. If that shape changed, this check is blind.",
  ]);
}

// ── 2b. every projector's module is one a tenant can actually have ───────────
//
// The FOURTH thing that has to line up, and the quietest of the four.
//
// `/v1/search/all` filters documents to the tenant's ENABLED modules, so a
// disabled module's stale rows never surface. That makes the `module` field on a
// projector load-bearing: name a module that is not in `ALL_MODULES` and the
// filter asks for something nobody can enable, matches nothing, and reports it
// with the same unqualified sentence as a genuinely empty result — "Nothing in
// your records matches". Everything else about the document is correct, so
// nothing else in this check, or in typecheck, or on the screen, says a word.
//
// Both shapes of the mistake have shipped, and both were found by a person
// typing a name they were looking at (measured 2026-09-18, one tenant):
//
//   site        module 'sitebuilder'  the slug is 'builder'   7 websites hidden
//   automation  module 'automations'  there IS no such slug  57 rules hidden
//
// The second is not a typo: automations are a PLATFORM CAPABILITY with no module
// at all (docs/81 §3). That is what `PLATFORM_MODULE` is for, and the route lets
// it through the filter rather than looking it up.
// [[feedback_absent_behaves_like_fine]]

const modulesSource = read(MODULES_FILE);
const slugs = new Set([...modulesSource.matchAll(/^\s*'([\w-]+)',$/gm)].map((m) => m[1]));
if (slugs.size < 10) {
  die([
    `✖ check:search-entities read ${MODULES_FILE} and found only ${String(slugs.size)} module slugs.`,
    '   It reads the quoted entries of `ALL_MODULES`. If that shape changed, this',
    '   check is comparing every projector against a list it no longer understands,',
    '   and would report all of them as faults. Fix the pattern, not the count.',
  ]);
}

const contractSource = read(PROJECTOR_CONTRACT);
const platformMatch = /PLATFORM_MODULE\s*=\s*'([\w-]+)'/.exec(contractSource);
if (!platformMatch) {
  die([
    `✖ check:search-entities cannot find PLATFORM_MODULE in ${PROJECTOR_CONTRACT}.`,
    '   It is the one sanctioned value for a record that belongs to no module.',
    '   Without it this check cannot tell a platform capability from a typo.',
  ]);
}
const platformModule = platformMatch[1];

// TWO `module` values per projector, and only ONE of them reaches Typesense:
//
//   EntityProjector.module   declared on the projector object. NOTHING READS IT.
//   document.module          inside the returned UniversalSearchDocument. This is
//                            what is stored, faceted and filtered on.
//
// So the second is checked, and the first is required to AGREE with it. The
// declaration being inert is what makes it a trap rather than a nicety: it is
// the line somebody edits believing they have changed the module. That is
// exactly how the `site` fix failed — the projector was changed to 'builder',
// the document three lines below went on saying 'sitebuilder', a full reindex
// rewrote all 7 documents with the old value, and the projector's own field read
// correct the whole time.

const declaredModule = new Map(); // entityType -> EntityProjector.module
const documentModule = new Map(); // entityType -> the value that ships

for (const file of PROJECTOR_FILES) {
  const source = read(file);
  for (const m of source.matchAll(
    /entityType:\s*'([\w-]+)',\s*\n\s*module:\s*(?:'([\w-]+)'|(PLATFORM_MODULE))/g
  )) {
    declaredModule.set(m[1], m[3] ? platformModule : m[2]);
  }
  for (const m of source.matchAll(
    /entity_type:\s*'([\w-]+)',\s*\n\s*module:\s*(?:'([\w-]+)'|(PLATFORM_MODULE))/g
  )) {
    documentModule.set(m[1], m[3] ? platformModule : m[2]);
  }
}

// ── 3. every write-time signal ───────────────────────────────────────────────
//
// FOUR call shapes, and all four are load-bearing:
//
//   indexEntity({ entityType: 'x', … })                       the generic helper
//   indexCommerceEntity(ctx, 'bundle', id)                    a positional wrapper
//   indexEntity({ entityType: target.entityType, … })         a literal in a MAP
//     fed into the helper, as commerce/src/events.ts does
//   data: { entityType: …, op: 'upsert' } on a hand-built     crm/src/pubsub-bridge.ts
//     `search.entity.changed` envelope
//
// A first version read only the first shape and reported eleven kinds as
// unindexed when eight were signalled through a wrapper: a check that knows one
// spelling reports the other spelling as a fault.
//
// The fix for THAT introduced the opposite fault, which is worse because it is
// silent. Matching a bare `entityType: 'x'` anywhere counts a word that several
// unrelated vocabularies also use — an SEO audit snapshot
// (`api-rest/src/lib/seo-audit.ts` builds one keyed `entityType: 'cms_page'`), a
// notification seed, a webhook envelope. `cms_page` was reported signalled on
// the strength of that snapshot and a test fixture, and had in fact no
// write-time signal at all. Thirteen of thirty were being counted on evidence
// that did not say what the check thought it said.
//
// So a file only gets READ for signals if it could plausibly be issuing one:
// it calls an `index*Entity*` helper, or it names the event itself. That is a
// property of the file, not of the line, which is what lets the map-and-variable
// shapes keep working while the look-alikes drop out. Tests are excluded
// outright — a signal in a fixture proves nothing about production.
// [[feedback_a_test_that_cannot_go_red]]

const NAMED = /entityType:\s*'([\w-]+)'/g;
const POSITIONAL = /index\w*Entity\w*\(\s*[\w.{} ,:]+?,\s*'([\w-]+)'/g;

/** Could this file be issuing a search-index signal at all? */
function isSignalSource(source) {
  return /index\w*Entity\w*\(/.test(source) || source.includes("'search.entity.changed'");
}

const signalled = new Map(); // entityType -> first file that signals it
let scannedFiles = 0;
let signalSources = 0;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    // `.next` is build output, and a running dev server deletes files in it
    // mid-walk, which crashed this check with ENOENT instead of reporting.
    if (name === 'node_modules' || name === 'dist' || name === '.turbo' || name === '.next') {
      continue;
    }
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!name.endsWith('.ts') || name.endsWith('.d.ts')) continue;
    if (name.includes('.test.') || name.includes('.spec.')) continue;
    const rel = relative(repoRoot, full).split('\\').join('/');
    if (PROJECTOR_FILES.includes(rel)) continue;
    scannedFiles += 1;
    const source = decomment(readFileSync(full, 'utf8'));
    if (!isSignalSource(source)) continue;
    signalSources += 1;
    for (const pattern of [NAMED, POSITIONAL]) {
      pattern.lastIndex = 0;
      for (const match of source.matchAll(pattern)) {
        if (!signalled.has(match[1])) signalled.set(match[1], rel);
      }
    }
  }
}
walk(join(repoRoot, WRITE_ROOT));

if (signalSources === 0) {
  die([
    `✖ check:search-entities scanned ${String(scannedFiles)} files under ${WRITE_ROOT} and`,
    '   found not one that issues a search-index signal. Either the tree moved or',
    '   the helper was renamed — a check that recognises nothing prints every type',
    '   as a fault, which is as useless as printing a tick. Fix the pattern.',
  ]);
}

// ── the report ───────────────────────────────────────────────────────────────

const problems = [];

for (const [type, file] of projectors) {
  if (!routed.has(type)) {
    problems.push(
      `  ${type}: projected in ${file}, but no route in ${ROUTES_FILE} claims it.\n` +
        `     A hit on one opens nothing — routeForEntity returns undefined.`
    );
  }
}

for (const [type, file] of projectors) {
  const shipped = documentModule.get(type);
  if (shipped === undefined) {
    problems.push(
      `  ${type}: projected in ${file}, but this check could not read the \`module\` its\n` +
        "     DOCUMENT carries. It matches `entity_type: '…'` followed by `module:`.\n" +
        '     A value it cannot read is a value it cannot check, and a wrong one is silent.'
    );
    continue;
  }

  if (shipped !== platformModule && !slugs.has(shipped)) {
    const near = [...slugs].find((s) => shipped.includes(s) || s.includes(shipped));
    problems.push(
      `  ${type}: its document carries module '${shipped}', which is not a module a\n` +
        "     tenant can have. /v1/search/all filters to the tenant's ENABLED modules, so\n" +
        `     every ${type} document is dropped by the filter and the box says "Nothing in\n` +
        '     your records matches" over records it is holding. Nothing else is wrong.\n' +
        (near
          ? `     Did you mean '${near}'?`
          : `     If ${type} belongs to no module, use PLATFORM_MODULE from @wizeworks/search.`)
    );
    continue;
  }

  const declared = declaredModule.get(type);
  if (declared !== undefined && declared !== shipped) {
    problems.push(
      `  ${type}: the projector declares module '${declared}' and its document ships\n` +
        `     '${shipped}'. Only the document is read — the declaration has no consumers —\n` +
        '     so the two disagreeing means the next person to "change the module" will\n' +
        '     edit the one that does nothing and watch the old value survive a reindex.\n' +
        `     Make both say '${shipped}'.`
    );
  }
}

for (const [type, file] of projectors) {
  if (signalled.has(type)) {
    if (NO_WRITE_SIGNAL_YET.has(type)) {
      problems.push(
        `  ${type}: now signalled from ${signalled.get(type)}, but still listed in\n` +
          `     NO_WRITE_SIGNAL_YET. Delete the entry — the list is a debt, not a record.`
      );
    }
    continue;
  }
  if (NO_WRITE_SIGNAL_YET.has(type)) continue;
  problems.push(
    `  ${type}: projected in ${file}, but nothing signals the index when one is\n` +
      `     written. It reaches search only when ops:reindex-search runs, so a record\n` +
      `     made today is not findable today. Call indexEntity (or your module's\n` +
      `     wrapper) after the write commits.`
  );
}

if (problems.length > 0) {
  die([
    `✖ search entities: ${String(problems.length)} of ${String(projectors.size)} cannot be found or opened`,
    '',
    ...problems,
  ]);
}

const waiting = [...NO_WRITE_SIGNAL_YET.keys()].sort().join(', ');
console.log(
  `✓ search entities: ${String(projectors.size)} projectors, all routed; ` +
    `${String(projectors.size - NO_WRITE_SIGNAL_YET.size)} signalled on write ` +
    `(${String(signalSources)} signal sources in ${String(scannedFiles)} files). ` +
    (waiting === '' ? 'None waiting on a reindex.' : `Still waiting: ${waiting}.`)
);
