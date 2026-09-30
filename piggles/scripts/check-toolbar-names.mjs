#!/usr/bin/env node
// A pane may not introduce itself under two names.
//
// ── WHAT THIS GUARDS ────────────────────────────────────────────────────────
//
// A pane's tab carries its name: from lib/console/vocabulary.ts in Piggles,
// from the surface catalog's own `title` everywhere else. Its toolbar carries
// its own `label=`, which is the toolbar's accessible name AND the heading its
// overflow popover prints. Where the two disagree, a person opening the menu on
// a screen called "What fits what" reads "Compatibility list controls" — the
// sparx category word, on the screen that was renamed to avoid it. 66 of the 81
// named toolbars did that (issue 802).
//
// ── THE TWO SHAPES ──────────────────────────────────────────────────────────
//
// The house writes a toolbar label two ways, and which one depends on the name:
// a NOUN takes "<name> controls"; a CLAUSE takes "Controls for <name>", because
// "How people find you controls" does not read. Both are accepted; a label that
// is neither, or that names a different screen, fails.
//
// ── IT USED TO CHECK ONLY THE RENAMED PANES, AND ONLY ONE CONSOLE ───────────
//
// Two holes, found on 2026-09-25 while reading the report library as a clothes
// maker. Its tab says **Build a report**; its toolbar said **Report library
// controls**, a phrase that appears nowhere else in that console and names a
// screen which does not exist in it.
//
// The first hole was the reasoning that a pane with no vocabulary entry has "no
// second name to compare against". It has one: the catalog title is what the
// tab shows. The rename is where this risk is CONCENTRATED, not where it lives.
//
// The second was that this scanned Piggles alone, exactly the way
// check-toolbar-primary did until 2026-09-19. Measured the moment both holes
// were closed:
//
//     piggles   79 of 182 toolbars disagreed   (82 had been checked)
//     sparx    140 of 186 toolbars disagreed   (0 had been checked)
//
// 219 of 368, under a guard that had been printing green.
// [[feedback_structural_checks_go_blind]]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');

/** Fail loudly rather than scanning nothing — [[feedback_structural_checks_go_blind]]. */
function mustExist(path, what) {
  if (!existsSync(path)) {
    console.error(`✗ check:toolbar-names — ${what} is not at ${path}`);
    process.exit(1);
  }
  return path;
}

/**
 * The two consoles.
 *
 * `vocabulary` is Piggles-only: sparx names its panes in the catalog and has no
 * rename layer, so there the catalog title IS the name. `minNames` is each
 * console's own denominator, asserted so a parse that collapses to nothing
 * cannot pass.
 */
const CONSOLES = [
  { brand: 'piggles', vocabulary: 'PIGGLES_SURFACES', minNames: 100, minTitles: 100 },
  { brand: 'sparx', vocabulary: null, minNames: 0, minTitles: 100 },
];

const CLAUSE = /^(how|what|who|where|why|when)\b/i;
const accepted = (name) =>
  CLAUSE.test(name) || name.includes(',')
    ? [`Controls for ${name[0].toLowerCase()}${name.slice(1)}`]
    : [`${name} controls`];

/** The renamed screen names, and ONLY those.
 *
 *  vocabulary.ts exports two maps keyed alike on purpose: the screen names and
 *  the create-button labels. Reading both makes a list pane take the name of the
 *  button that makes a new one, so the parse is bounded to the first map and
 *  asserts it did not run into the second. */
function renamedNames(root, exportName, minNames) {
  if (!exportName) return new Map();
  const vocab = mustExist(join(root, 'lib/console/vocabulary.ts'), 'the screen-name map');
  const src = readFileSync(vocab, 'utf8');
  const startAt = src.indexOf(`export const ${exportName}`);
  const endAt = src.indexOf('\n};', startAt);
  if (startAt === -1 || endAt === -1) {
    console.error(`✗ check:toolbar-names — could not find ${exportName} in vocabulary.ts`);
    process.exit(1);
  }
  const block = src.slice(startAt, endAt);
  if (block.includes('PIGGLES_CREATE_LABELS')) {
    console.error('✗ check:toolbar-names — the two vocabulary maps ran together');
    process.exit(1);
  }
  const out = new Map();
  for (const m of block.matchAll(/^ {2}'([a-z0-9.\-]+)': '([^']*)',/gm)) out.set(m[1], m[2]);
  if (out.size < minNames) {
    console.error(`✗ check:toolbar-names — only parsed ${out.size} screen names`);
    process.exit(1);
  }
  return out;
}

/** Surface key -> its catalog title, and the file the catalog imports its
 *  component from. By FULL PATH, never basename: reports.tsx exists under four
 *  different modules. */
function catalogOf(root, minTitles) {
  const dir = mustExist(join(root, 'lib/surfaces/catalog'), 'the surface catalog');
  const fileForKey = new Map();
  const titleForKey = new Map();
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith('.ts') || name.endsWith('.test.ts')) continue;
    const src = readFileSync(join(dir, name), 'utf8');
    const imports = new Map();
    for (const m of src.matchAll(/import \{ (\w+) \} from '([^']+)'/g)) imports.set(m[1], m[2]);
    for (const m of src.matchAll(/key: '([a-z0-9.\-]+)',\s*\n\s*title: '([^']+)'/g)) {
      if (!titleForKey.has(m[1])) titleForKey.set(m[1], m[2]);
    }
    for (const m of src.matchAll(/key: '([a-z0-9.\-]+)',(?:.|\n)*?component: (\w+),/g)) {
      const rel = imports.get(m[2]);
      if (!rel || !rel.includes('surfaces/')) continue;
      const path = join(root, 'surfaces', `${rel.split('surfaces/')[1]}.tsx`);
      if (existsSync(path) && !fileForKey.has(m[1])) fileForKey.set(m[1], path);
    }
  }
  if (titleForKey.size < minTitles) {
    console.error(`✗ check:toolbar-names — only parsed ${titleForKey.size} catalog titles`);
    process.exit(1);
  }
  return { fileForKey, titleForKey };
}

const failures = [];
let checked = 0;
let shared = 0;
let computed = 0;
let names = 0;

for (const console_ of CONSOLES) {
  const root = mustExist(
    join(REPO, console_.brand, 'apps', 'workbench'),
    `the ${console_.brand} workbench`
  );
  const paneName = renamedNames(root, console_.vocabulary, console_.minNames);
  const { fileForKey, titleForKey } = catalogOf(root, console_.minTitles);
  names += paneName.size > 0 ? paneName.size : titleForKey.size;

  // One file can back several keys; with several names there is no single right
  // answer, so those are reported as unchecked rather than guessed at.
  const namesForFile = new Map();
  for (const [key, path] of fileForKey) {
    const name = paneName.get(key) ?? titleForKey.get(key);
    if (!name) continue;
    if (!namesForFile.has(path)) namesForFile.set(path, new Set());
    namesForFile.get(path).add(name);
  }

  for (const [path, forFile] of [...namesForFile].sort()) {
    const src = readFileSync(path, 'utf8');
    const m = src.match(/label="([^"]*(?:controls|Controls for[^"]*))"/);
    if (!m) {
      // A label that is an EXPRESSION rather than a literal — `label={`${…}
      // controls`}`. This scan cannot evaluate one, and it used to skip them
      // without saying so, which is a hole that widens silently every time a
      // pane needs its name from the brand's copy rather than the catalog. It
      // is counted and printed now, so a wave of them is visible in the green
      // line rather than invisible in the denominator.
      // [[feedback_structural_checks_go_blind]]
      if (/<PaneToolbar[\s\S]{0,240}?label=\{/.test(src)) computed += 1;
      continue;
    }
    if (forFile.size !== 1) {
      shared += 1;
      continue;
    }
    const name = [...forFile][0];
    const want = accepted(name);
    checked += 1;
    if (!want.includes(m[1])) {
      failures.push({
        path: path.replace(REPO, '').split('\\').join('/'),
        name,
        is: m[1],
        want: want[0],
      });
    }
  }
}

if (checked === 0) {
  console.error('✗ check:toolbar-names — matched no toolbars at all; the scan went blind');
  process.exit(1);
}

if (failures.length > 0) {
  console.error('✗ check:toolbar-names — a pane introduces itself under two names\n');
  for (const f of failures) {
    console.error(`  ${f.name}`);
    console.error(`    toolbar says  "${f.is}"`);
    console.error(`    should say    "${f.want}"`);
    console.error(`    ${f.path}\n`);
  }
  console.error(
    `${failures.length} of ${checked} named toolbars disagree with the tab above them.`
  );
  process.exit(1);
}

console.log(
  `✓ check:toolbar-names — ${checked} named toolbar(s) across both consoles carry the name of ` +
    `the pane they sit in (${names} pane names, ${shared} shared by several panes and ` +
    `${computed} named by an expression this scan cannot read).`
);
