// A pane that WAITS for a query must handle that query FAILING.
//
// ── THE SHAPE THIS EXISTS FOR ───────────────────────────────────────────────
//
// A pane with two fetches usually writes three states and means four:
//
//     if (listQuery.isError) return <PaneLoadError … />;          // one failed
//     if (listQuery.isPending || entriesQuery.isPending) …        // still coming
//     return <Editor entries={entriesQuery.data ?? []} />;        // here it is
//
// The fourth is `entriesQuery.isError`, and it falls through the bottom. `?? []`
// then turns a failed read into an empty list, and the screen draws it as an
// answer: a price list with no prices under a row that says "1 price", a
// transfer with two empty location choosers, a product's stock page offering
// fewer places to count into than the business has.
//
// Worse where a sentence sits under the empty list. Three panes said "You have
// no customer groups yet. Create one under Customers" — a claim about the
// owner's business, printed because a fetch did not come back. Juniper Row has
// nine ([[feedback_never_present_absence_as_measurement]], issue 627).
//
// ── WHY A CHECK AND NOT A TEST ──────────────────────────────────────────────
//
// Nothing else can see it. Typecheck and lint are happy: every branch is
// well-typed and `?? []` is correct code. A unit test would have to mount the
// pane with one query failing, which the console's node test seat cannot do.
// And the failure only appears when a server misbehaves, which is exactly when
// nobody is looking. It was found by an api-rest restart during a persona walk.
//
// ── THE RULE ────────────────────────────────────────────────────────────────
//
// In a pane that asks ANY query whether it failed, every query it WAITS for must
// be asked too.
//
// The two halves both matter. "Asks any query" scopes the rule to panes that
// have decided load failure is their problem — a pane with no error branch at
// all is a different conversation. "Waits for" is the pane's own declaration
// that it cannot draw without that data; if it can draw without it, it does not
// need to wait, and this check has nothing to say.
//
// A query is "handled" if the file mentions `<name>.isError`, or hands the whole
// query to a helper that reads it (`choiceListState(<name>)`).

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Both consoles. The rule is about data loading, so it holds identically. */
const ROOTS = [
  join(REPO, 'piggles', 'apps', 'workbench', 'surfaces'),
  join(REPO, 'sparx', 'apps', 'workbench', 'surfaces'),
];

// Resolved from the repo root and asserted, never counted in `..`s: a check that
// scans a directory which has moved reports zero problems in green.
for (const root of ROOTS) {
  if (!existsSync(root)) {
    console.error(`check:pane-load — scan root is missing: ${root}`);
    console.error('The surfaces tree has moved. Fix this path; a check that scans');
    console.error('nothing passes every time.');
    process.exit(1);
  }
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (entry.name.endsWith('.tsx')) out.push(path);
  }
  return out;
}

/** Locally-named query results: `const fooQuery = useSomething(...)`. Only
 *  names ending in Query, because those are the ones a pane refers to by name
 *  in its guards — an inlined `useFoo()` has nothing to check. */
function queryNames(source) {
  return new Set([...source.matchAll(/const\s+(\w*[Qq]uery)\s*=\s*use/g)].map((m) => m[1]));
}

const mentions = (source, name, prop) => new RegExp(`\\b${name}\\.${prop}\\b`).test(source);

/** Handed whole to something that reads its failure for us. */
const delegated = (source, name) => new RegExp(`choiceListState\\(\\s*${name}\\s*\\)`).test(source);

const failures = [];
let scanned = 0;
let withGuards = 0;

for (const root of ROOTS) {
  for (const file of walk(root)) {
    scanned += 1;
    const source = readFileSync(file, 'utf8');
    const names = [...queryNames(source)];
    if (names.length < 2) continue;

    const handled = names.filter((n) => mentions(source, n, 'isError') || delegated(source, n));
    // A pane with no error branch at all is out of scope: this rule is about
    // panes that already decided a failed load is theirs to report.
    if (handled.length === 0) continue;
    withGuards += 1;

    for (const name of names) {
      if (handled.includes(name)) continue;
      if (!mentions(source, name, 'isPending')) continue;
      failures.push({ file: relative(REPO, file).split('\\').join('/'), name });
    }
  }
}

if (failures.length > 0) {
  console.error(
    `\n${String(failures.length)} query/queries are waited for but never asked whether they failed.\n\n` +
      'The pane blocks on each of these while it loads, which is its own statement\n' +
      'that it cannot draw without them — and then falls through to the working UI\n' +
      'when one of them fails. `?? []` turns the failed read into an empty list and\n' +
      'the screen draws it as an answer.\n\n' +
      'Either add it to the error branch beside the query that is checked, or, if it\n' +
      'only fills a chooser, hand it to <ChoiceListNote state={choiceListState(q)} />\n' +
      'so an unread list never prints as "you have none of those".\n'
  );
  for (const failure of failures) {
    console.error(`  ${failure.name.padEnd(20)} ${failure.file}`);
  }
  console.error('');
  process.exit(1);
}

console.log(
  `check:pane-load — every waited-for query is checked for failure ` +
    `(${String(withGuards)} of ${String(scanned)} surfaces guard a load).`
);
