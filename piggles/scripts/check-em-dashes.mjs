#!/usr/bin/env node
// AN EM DASH IN A SENTENCE SOMEBODY READS.
//
// The house rule is flat: no em dashes in copy. Reword instead. It has been a
// standing instruction for a long time and there has never been a check for
// it, so the only thing keeping them out was whoever was typing remembering.
//
// On 2026-09-25 the Customers app was showing five of them at once, on the one
// screen whose job is to teach the report builder:
//
//     Everyone on your list grouped by where they have got to — leads, …
//     Closed-won value month by month over the last year — whether you are …
//     Open support requests grouped by how urgent they are — what your team …
//
// Those came out of the database, seeded from `report-builtins.ts`, which had
// already replaced every one of them with a colon. The file was right and 35
// rows across 7 tenants were still wrong. That half is a migration; this is the
// half that stops the next one being typed.
//
// ── IT GREW TO THE SEED PACKAGES (2026-09-25) ───────────────────────────────
//
// `report-builtins.ts` is not in the console and was never read by this check.
// Neither was the Add palette's component catalog, the AI prompt library, the
// legal templates or the demo business. The guard was named for a house rule
// and scanned one app. Adding the nine shared seed trees took it from 1,421
// files to 1,713 and from 10,730 sentences to 12,599 — and both halves' counts
// are printed separately below, so one going blind cannot hide behind the
// other. [[feedback_structural_checks_go_blind]]
//
// ── WHAT COUNTS, AND WHAT DOES NOT ──────────────────────────────────────────
//
// A bare em dash is the console's EMPTY-CELL mark and is not prose: `'—'` in a
// table cell means "nothing recorded here", it is a symbol rather than a word,
// and there are 300-odd of them. The prose test below rejects them for free,
// because it asks for two words with letters in.
//
// COMMENTS ARE NOT COPY. This file's own header is full of em dashes and so is
// every good comment in the console. Comments are stripped before the scan, the
// same way `check-plain-words` strips them.
//
// An EN dash (–) is here too. It is the same mistake with a narrower glyph, and
// it is harder to spot in a diff, which makes it the more likely one to survive.
//
// ── MEASURED BEFORE IT WAS WRITTEN ──────────────────────────────────────────
//
// A guard that starts red is a guard somebody turns off. The count at the time
// of writing is printed on every green run, so a rise is visible.
// [[feedback_a_test_that_cannot_go_red]] [[feedback_structural_checks_go_blind]]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PIGGLES = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(PIGGLES, '..');

/** The same trees `check-plain-words` reads, for the same reason: these are the
 *  ones that hold sentences a person reads. `lib/surfaces` stays out — the
 *  catalog's titles are overridden by vocabulary.ts before anybody sees them. */
const CONSOLE_ROOTS = [
  join(PIGGLES, 'apps', 'workbench', 'surfaces'),
  join(PIGGLES, 'apps', 'workbench', 'components'),
  join(PIGGLES, 'apps', 'workbench', 'lib', 'console'),
  join(PIGGLES, 'apps', 'workbench', 'lib', 'studio'),
  join(PIGGLES, 'apps', 'workbench', 'lib', 'tour'),
  join(PIGGLES, 'apps', 'workbench', 'lib', 'onboarding'),
  join(PIGGLES, 'apps', 'workbench', 'lib', 'dock'),
];

/**
 * THE SEED TREES, which this file's header always said it would grow to.
 *
 * Copy that a shop owner reads is not only written in a component. A large part
 * of it is written ONCE into a row and read off a screen later: the Add
 * palette's 138 component descriptions, the ready-made AI prompt library, the
 * built-in CRM reports, the demo business every trial tenant starts with.
 *
 * Those live outside the console and every copy guard in the repo stopped at
 * the console's edge, so the trees that feed the database were checked by
 * nothing. On 2026-09-25 a prompt row on screen read "genuinely helpful —
 * never pushy" while its own source file had said "helpful, never pushy" for
 * months; the row was stale, but nothing here would have caught the source
 * either. [[feedback_structural_checks_go_blind]]
 *
 * These are SHARED packages, not one brand's, which is why a check living under
 * `piggles/scripts` reads them: both consoles seed from exactly these files.
 *
 * A stale ROW is a migration and is not this. This half stops the next one
 * being typed.
 */
const SEED_ROOTS = [
  join(REPO, 'wizeworks', 'packages', 'builder-schemas', 'src', 'catalog'),
  join(REPO, 'wizeworks', 'packages', 'db', 'src', 'sample-data'),
  join(REPO, 'wizeworks', 'packages', 'db', 'prisma'),
  join(REPO, 'wizeworks', 'packages', 'crm', 'src', 'services'),
  join(REPO, 'wizeworks', 'packages', 'legal-templates', 'src'),
  join(REPO, 'wizeworks', 'packages', 'modules', 'src'),
  join(REPO, 'wizeworks', 'packages', 'silica-catalog', 'src'),
  join(REPO, 'wizeworks', 'packages', 'email', 'src', 'templates'),
  join(REPO, 'wizeworks', 'services', 'api-rest', 'src', 'lib', 'ai'),
];

const SCAN_ROOTS = [...CONSOLE_ROOTS, ...SEED_ROOTS];

// Every root asserted. A check that scans a directory which has moved reports
// zero problems, in green, forever.
for (const root of SCAN_ROOTS) {
  if (!existsSync(root)) {
    console.error(`check:em-dashes — scan root is missing: ${root}`);
    console.error('Point this at its new home; carrying on would scan nothing.');
    process.exit(1);
  }
}

const SKIP = new Set(['node_modules', '.next', 'dist', '.turbo']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => (line.trim().startsWith('//') ? '' : line))
    .join('\n');
}

/** The props that carry a sentence. `className` is pointedly not one. */
const COPY_PROPS =
  /\b(?:title|description|label|placeholder|detail|blurb|body|help|helpText|message|summary|tagline)\s*[:=]\s*(?:\{\s*)?(['"`])([^'"`]{8,600})\1/g;

const JSX_TEXT = />((?:[^<>'"`]|\{[^{}<>]*\}){8,600})</g;
const INTERPOLATION = /\{[^{}]*\}/g;

/** Whether a captured run is a SENTENCE rather than code that happened to sit
 *  between a `>` and a `<`. Same test as check-plain-words, and the reason it
 *  is repeated rather than shared is that the two checks disagree about what
 *  they scan next: this one will grow to the seed packages, that one will not. */
function isProse(text) {
  if (!/\s/.test(text)) return false;
  if (/[;={}()[\]|<>]/.test(text)) return false;
  if (/\s\./.test(text)) return false;
  if (/\w\.\w/.test(text) && !/[a-z][.!?]\s/i.test(text)) return false;
  if (!/[A-Za-z]{2,}/.test(text)) return false;
  return (
    text
      .trim()
      .split(/\s+/)
      .filter((word) => /[A-Za-z]/.test(word)).length >= 2
  );
}

function readableText(source) {
  const out = [];
  for (const [, , text] of source.matchAll(COPY_PROPS)) out.push(text.replace(/\s+/g, ' ').trim());
  for (const [, text] of source.matchAll(JSX_TEXT)) {
    out.push(text.replace(INTERPOLATION, ' … ').replace(/\s+/g, ' ').trim());
  }
  return out.filter(isProse);
}

/**
 * The two shapes a dash is ALLOWED to take, removed before the test.
 *
 * A NUMBER RANGE is what an en dash is actually for: "61–90 days late" and
 * "15–30% light" are correct typography, not slips, and banning them would be
 * banning the punctuation mark rather than the habit.
 *
 * A QUOTED GLYPH is the console explaining its own empty-cell mark: the page
 * results note tells a person a figure can read “—” rather than zero, and it
 * has to print the thing it is talking about.
 */
const NUMBER_RANGE = /\d\s*[–—]\s*\d/g;
const QUOTED_GLYPH = /[“‘"']\s*[–—]\s*[”’"']/g;

function offendingDash(text) {
  const clean = text.replace(QUOTED_GLYPH, ' … ').replace(NUMBER_RANGE, ' 0 ');
  if (clean.includes('—')) return 'em dash';
  if (clean.includes('–')) return 'en dash';
  return null;
}

const found = [];

/** Counted per HALF, because the two halves can go blind separately: a tree
 *  move in `wizeworks` would leave the console's numbers looking healthy while
 *  the seed packages quietly stopped being read. Both are printed. */
function scan(roots) {
  let files = 0;
  let sentences = 0;
  for (const root of roots) {
    for (const file of walk(root)) {
      files += 1;
      const source = stripComments(readFileSync(file, 'utf8'));
      for (const text of readableText(source)) {
        sentences += 1;
        const kind = offendingDash(text);
        if (!kind) continue;
        found.push({ file: relative(REPO, file).split('\\').join('/'), kind, text });
      }
    }
  }
  return { files, sentences };
}

const consoleHalf = scan(CONSOLE_ROOTS);
const seedHalf = scan(SEED_ROOTS);
const scanned = consoleHalf.files + seedHalf.files;
const sentences = consoleHalf.sentences + seedHalf.sentences;

// The denominator, asserted, for EACH half. One half resolving to nothing while
// the other stays healthy is the failure this guards against, and a combined
// total would hide it.
if (consoleHalf.sentences === 0 || seedHalf.sentences === 0) {
  console.error(
    `check:em-dashes — console half: ${String(consoleHalf.sentences)} sentence(s) in ` +
      `${String(consoleHalf.files)} file(s); seed half: ${String(seedHalf.sentences)} ` +
      `sentence(s) in ${String(seedHalf.files)} file(s).`
  );
  console.error('One half read nothing. Fix the scan before trusting this.');
  process.exit(1);
}

if (scanned === 0 || sentences === 0) {
  console.error(
    `check:em-dashes — read ${String(scanned)} file(s) and found ${String(sentences)} sentence(s).`
  );
  console.error('Nothing was checked. Fix the scan before trusting this.');
  process.exit(1);
}

if (found.length > 0) {
  console.error(
    `\n${String(found.length)} sentence(s) put a dash on screen where a word belongs.\n\n` +
      'Reword it. A colon, a full stop or a comma does the same job and reads the\n' +
      'way a person writes. A bare dash in a table cell is fine and is not this.\n'
  );
  for (const f of found) console.error(`  [${f.kind}] ${f.file}\n      ${f.text.slice(0, 160)}`);
  console.error('');
  process.exit(1);
}

console.log(
  `check:em-dashes — ${String(sentences)} sentence(s) across ${String(scanned)} file(s), ` +
    'and not one of them reaches for a dash instead of a word.\n' +
    `  the console  ${String(consoleHalf.sentences).padStart(6)} sentence(s), ` +
    `${String(consoleHalf.files)} file(s)\n` +
    `  the seeds    ${String(seedHalf.sentences).padStart(6)} sentence(s), ` +
    `${String(seedHalf.files)} file(s)`
);
