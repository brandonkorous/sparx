#!/usr/bin/env node
/**
 * Fails when a sentence a person reads counts things as `thing(s)`.
 *
 * ---------------------------------------------------------------------------
 * The problem this exists for
 * ---------------------------------------------------------------------------
 *
 * `${n} line(s) do not agree` is a programmer counting. It is written that way
 * because the plural is awkward in a template literal, and the cost of the
 * shortcut lands on somebody checking an invoice:
 *
 *     1 line(s) do not agree
 *     1 line(s) are short of what was outstanding
 *     12 node(s) still use it. Delete those first.
 *
 * The second of those is issue 495, found by a dressmaker whose delivery was two
 * metres short. It was fixed where she saw it, in receiving, and the comment
 * left behind says so in as many words. The bill check on the screen beside it
 * went on saying the same thing for months, and so did four messages inside the
 * packages. MEASURED 2026-09-18: five live strings, in three areas, all of the
 * same shape, all after the fix.
 *
 * That is the whole reason this is a check rather than a fix: the shape comes
 * back one file over, and nothing was watching for it.
 *
 * ---------------------------------------------------------------------------
 * The rule
 * ---------------------------------------------------------------------------
 *
 * Count in words. Both branches, and the verb with them:
 *
 *     `${plural(n, 'line', 'lines')} ${n === 1 ? 'does' : 'do'} not agree`
 *     n === 1 ? 'The one line matches' : `All ${n} lines match`
 *
 * Every console has a `plural(count, one, many)` helper for the first half.
 *
 * ---------------------------------------------------------------------------
 * What it reads
 * ---------------------------------------------------------------------------
 *
 * String literals only, comments stripped first. A comment may quote the old
 * wording while explaining why it went — that is a note to us, not a sentence on
 * a screen, and treating it as a finding is how a check gets switched off.
 *
 * It scans both consoles and every package `src`, because four of the five live
 * strings were in the packages, where the copy checks have never reached
 * (issue 657).
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * Every tree that holds a sentence somebody reads.
 *
 * Each one is ASSERTED to exist below. A check whose scan root has moved reads
 * nothing and prints a green tick over no work at all, which is worse than
 * having no check: five of them did exactly that in one tree move.
 */
const TREES = [
  'piggles/apps/workbench',
  'sparx/apps/workbench',
  'wizeworks/packages',
  'wizeworks/services',
];

/**
 * Not copy.
 *
 * `scripts` and `test` are written for us. A migration's `RAISE NOTICE` is a
 * deploy log. `prisma` holds the schema's own comments, which are documentation.
 */
const SKIP_DIR = new Set(['node_modules', 'dist', '.next', 'scripts', 'test', 'prisma', 'seed']);

const missing = TREES.filter((t) => !existsSync(join(ROOT, t)));
if (missing.length > 0) {
  console.error('check-counted-in-words: these scan roots do not exist:');
  for (const t of missing) console.error(`  ${t}`);
  console.error('\nThe paths moved. Update TREES, or this check scans nothing and passes.');
  process.exit(1);
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIR.has(entry.name)) continue;
      walk(join(dir, entry.name), out);
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

/** A comment is for us, not for the reader. */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => (line.trim().startsWith('//') ? '' : line))
    .join('\n');
}

/**
 * Every string literal in the file, quotes included so a template's `${…}` is
 * kept — the shape being looked for is usually `${n} line(s)`, and the count in
 * front of it is the point.
 *
 * Deliberately simple: `thing(s)` cannot occur in a Tailwind class list, an
 * import path or an identifier, so the usual reason to parse properly (telling
 * copy from code) does not apply here.
 */
const STRINGS = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;

/**
 * `line(s)`, `node(s)`, `item(s)` — a word, then a parenthesised s.
 *
 * The word must NOT follow a dot, or `/[",\n]/.test(s)` reads as a count of
 * tests: the character class in that regex opens with a quote, so the scanner
 * above tokenises part of it as a string. Two of those were the only false
 * alarms in the first run, and both are method calls.
 */
const COUNTED = /(?:^|[^.\w$])[A-Za-z]+\(s\)/;

/**
 * Two things, and only two.
 *
 * `http(s)` is a protocol, not a count, and it turns up in real sentences about
 * addresses.
 *
 * `Attribute N value(s)` is WooCommerce's own CSV COLUMN NAME. It is not our
 * copy, nobody reads it, and the importer looks a spreadsheet up by it — so
 * "fixing" the wording there would quietly stop every WooCommerce import
 * finding its attribute columns. A name somebody else chose is a key, not a
 * sentence. (See the memory on a copy edit breaking identity lookups: the same
 * mistake renamed 32 seeded automations and would have double-emailed every
 * tenant.)
 *
 * Nothing else is exempt: if a word is genuinely hard to pluralise, the
 * sentence is the thing to change.
 */
const ALLOWED = [/https?\(s\)/i, /Attribute .*value\(s\)/];

const found = [];
let scanned = 0;
for (const tree of TREES) {
  for (const file of walk(join(ROOT, tree))) {
    scanned += 1;
    const source = stripComments(readFileSync(file, 'utf8'));
    for (const literal of source.match(STRINGS) ?? []) {
      if (!COUNTED.test(literal)) continue;
      if (ALLOWED.some((re) => re.test(literal))) continue;
      found.push({
        file: relative(ROOT, file).split(sep).join('/'),
        text: literal.length > 160 ? `${literal.slice(0, 160)}…` : literal,
      });
    }
  }
}

if (found.length > 0) {
  console.error(
    `\n${String(found.length)} ${found.length === 1 ? 'sentence counts' : 'sentences count'} ` +
      'things the way a programmer does.\n\n' +
      "Write both branches out: `${plural(n, 'line', 'lines')} ${n === 1 ? 'does' : 'do'} not agree`.\n"
  );
  for (const f of found) console.error(`  ${f.file}\n      ${f.text}`);
  console.error('');
  process.exit(1);
}

console.log(
  `check:counted-in-words — ${String(scanned)} files read across ${String(TREES.length)} trees, ` +
    'nothing counted as thing(s).'
);
