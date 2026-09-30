#!/usr/bin/env node
/**
 * American spelling in the copy the SERVER writes.
 *
 * ---------------------------------------------------------------------------
 * Why this exists next to a test that already does it
 * ---------------------------------------------------------------------------
 *
 * `apps/workbench/lib/console/american-spelling.test.ts` has guarded this since
 * the day Piggles said "licenses" and sparx said "licences" in the same pane
 * title. It is a good guard. It scans two directories:
 *
 *     apps/workbench/surfaces        apps/workbench/lib/surfaces
 *
 * and a business owner reads a great deal of copy that is not in either. The
 * unit names on "Units" are seeded from `commerce-schemas/src/uom.ts`. The
 * column labels on an import are in `migration/src/canonical.ts`. The sentence
 * that comes back when an upload is too big is in `api-rest`. Every component
 * description in the builder's Add palette is in `builder-schemas`.
 *
 * MEASURED 2026-09-19, before the sweep this check shipped with: the console
 * was clean and the server held **24 British spellings in copy**, including the
 * four starter units a shop owner reads on screen the first time she opens the
 * pane:
 *
 *     1 litre . 2 litres        1 metre . 2 metres
 *     1 millilitre . …          1 millimetre . …
 *
 * A rule written down and applied to one of the places it holds.
 * [[feedback_structural_checks_go_blind]]
 *
 * MEASURED AGAIN 2026-09-25, and the same lesson one level down: this read only
 * QUOTED copy, and Prettier wraps at 100 characters, so a sentence in a React
 * Email template or a studio panel longer than a short label sits between its
 * tags rather than inside a literal. `proseOn` reads those too — 3,298 more
 * pieces of copy — and found "neighbours" in studio's board words. The console
 * test was widened the same way on the same day and found five.
 *
 * AND A THIRD TIME, later the same day, which is the one worth remembering.
 * `TREES` was `wizeworks/packages` + `wizeworks/services` — the SHARED server —
 * so a rule about the words a business owner reads was applied everywhere
 * except the two places she mostly reads them: the brands' own apps. The header
 * above says this check exists because a rule was "written down and applied to
 * one of the places it holds", and it was doing exactly that itself.
 *
 * Adding `piggles/apps`, `piggles/packages` and `sparx/apps` took it from 2,291
 * files to 5,549 and from 100,330 pieces of copy to 309,970, and turned up
 * **50 British spellings on pages customers read** — 24 on each marketing site,
 * two in the sparx console. The sharpest was `payment-methods.ts`, where
 * `check: 'Cheque'` was still labelling the stored value `check`. Piggles fixed
 * that exact line as issue 384, with a comment explaining that the label has to
 * follow the value; sparx's copy of the same file, with the same map, never got
 * it. [[feedback_structural_checks_go_blind]] [[feedback_a_fix_leaves_its_neighbour_behind]]
 *
 * ---------------------------------------------------------------------------
 * What it does NOT touch, and why each one is allowed
 * ---------------------------------------------------------------------------
 *
 *   1. A WIRE VALUE. `status === 'cancelled'` is the string in the database and
 *      in the event catalog (`order.cancelled`). Respelling it would not fix a
 *      spelling, it would silently stop matching.
 *      [[feedback_copy_edit_breaks_identity_lookups]]
 *
 *   2. An IMPORT COLUMN ALIAS. `['fulfilment centre', 'fulfillment center']`
 *      matches a heading in a spreadsheet somebody else wrote. Dropping the
 *      British half stops matching their file. Earned the same way the console
 *      test earns it: a bare lowercase literal whose American twin is also a
 *      literal in the same file.
 *
 *   3. A PROPER NOUN. "Earl Grey" is a tea, not a color.
 *
 *   4. ANOTHER COMPANY'S OWN TERM. Xero's software says "Organisation" on its
 *      own screens, so an error telling somebody to go and look at it has to
 *      say the word they will see there. Listed by file and word, never by
 *      guess.
 *
 * ---------------------------------------------------------------------------
 * Proving it can go red
 * ---------------------------------------------------------------------------
 *
 * Put `name: 'litre'` back in `commerce-schemas/src/uom.ts` and this exits 1
 * naming the line. For the brand half added on 2026-09-25, put `'Cheque'` back
 * in `sparx/apps/workbench/lib/payment-methods.ts` — it exits 1 naming that
 * line, and the same edit under the OLD `TREES` passed.
 * [[feedback_a_test_that_cannot_go_red]]
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

import { BRITISH_WORDS } from './british-words.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const TREES = [
  'wizeworks/packages',
  'wizeworks/services',
  'piggles/apps',
  'piggles/packages',
  'sparx/apps',
];

const missing = TREES.filter((t) => !existsSync(join(ROOT, t)));
if (missing.length > 0) {
  console.error('check-american-spelling: these paths do not exist:');
  for (const t of missing) console.error(`  ${t}`);
  console.error('\nThey moved. Update the paths, or this check scans nothing and passes.');
  process.exit(1);
}

/**
 * British -> American.
 *
 * The same list the console test carries, plus the compound metric words it was
 * missing. `\bmetre\b` does NOT match inside "millimetre" - the letter before it
 * is a word character, so there is no boundary - which is how `millilitre` and
 * `millimetre` were seeded into every tenant under a guard that already knew
 * `litre` and `metre`. A word that cannot appear costs nothing to list.
 */

const PAIRS = BRITISH_WORDS;

/**
 * Values the database and the event catalog hold. Bare and lowercase only.
 *
 * `enquired` is a funnel STAGE KEY, in `funnels/src/library.ts` and
 * `schemas.ts`. `funnels/types.ts` states what that key is: "the identity
 * history is recorded against, so renaming `name` never orphans past results."
 * Respelling the key would orphan every result already recorded against it,
 * which is the opposite of fixing a spelling. The NAME beside it is what a
 * person reads, and it says "Got in touch" and "Asked about a slot" — neither
 * of which contains the word at all. [[feedback_a_copy_edit_breaks_identity_lookups]]
 */
const WIRE_VALUES = new Set(['cancelled', 'cancellation', 'enquired']);

/**
 * Keywords in somebody else's file format, spelled the way the format spells
 * them.
 *
 * `CANCELLED` is the RFC 5545 STATUS property. A calendar we WRITE has to say it
 * or no calendar application understands us, and a calendar we READ arrives
 * saying it whatever we would have preferred. Upper case and bare, because a
 * sentence never looks like that.
 */
const FORMAT_KEYWORDS = new Set(['CANCELLED', 'TENTATIVE', 'CONFIRMED', 'TRANSPARENT']);

/**
 * A FORMER name, which is a lookup key on rows that already exist.
 *
 * `upsertSystemAutomation` finds a tenant's installed rule by its current name
 * and then by anything in `previousNames`, and adopts the row it finds. That
 * array is the whole reason a system automation can be renamed at all: respell
 * the entry and the rename stops reaching every tenant who already has the old
 * one, which installs a SECOND rule beside the first and emails the customer
 * twice. The `name` beside it is what a person reads, and that one is still
 * checked. [[feedback_copy_edit_breaks_identity_lookups]]
 */
const FORMER_NAME_FIELD = /\bpreviousNames\s*:/;

/**
 * Phrases that are somebody's NAME, not a spelling.
 *
 * Matched case-sensitively and as a whole phrase, because "Earl Grey" is a tea
 * and "earl grey tone" would be a color.
 */
const PROPER_NOUNS = [/\bEarl Grey\b/, /\bGrey Goose\b/];

/**
 * Another company's own word, in the file that has to say it.
 *
 * Keyed by file AND word so it cannot spread: a second file saying
 * "organisation" is still a defect.
 */
const THIRD_PARTY_TERMS = new Map([
  ['wizeworks/packages/finance/src/accounting/providers/xero.ts', new Set(['organisation'])],
  // The heading at the top of somebody else's export file. BigCommerce writes
  // "Zip/Postcode", WooCommerce writes "Postcode", and Magento's field is named
  // `_address_postcode`. A connector has to say the word that is actually in the
  // file it was handed, so respelling these would simply stop reading the column.
  ['wizeworks/packages/migration/src/vendors/bigcommerce.ts', new Set(['postcode'])],
  ['wizeworks/packages/migration/src/vendors/magento.ts', new Set(['postcode'])],
  ['wizeworks/packages/migration/src/vendors/woocommerce.ts', new Set(['postcode'])],
]);

const WORDS = Object.keys(PAIRS).join('|');
const FINDER = new RegExp(String.raw`\b(` + WORDS + String.raw`)\b`, 'gi');

function hasWord(text, word) {
  return new RegExp(String.raw`\b` + word + String.raw`\b`, 'i').test(text);
}

/**
 * The same text with EVERY British word replaced.
 *
 * One alias literal held both `fulfilment` AND `centre`, and respelling one word
 * at a time produced "fulfillment centre", which is nobody's spelling and
 * matched no twin in the file. So a deliberate alias pair was reported as a
 * defect twice over. [[feedback_a_fix_leaves_its_neighbour_behind]]
 */
function americanTwin(text) {
  let out = text;
  for (const [british, american] of Object.entries(PAIRS)) {
    out = out.replace(new RegExp(String.raw`\b` + british + String.raw`\b`, 'gi'), american);
  }
  return out;
}

/** Blank comments while KEEPING newlines, so line numbers stay true. */
function codeOnly(source) {
  const blank = (match) => match.replace(/[^\n]/g, ' ');
  return source.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/\/\/[^\n]*/g, blank);
}

/** Every string literal on one line. A template's `${...}` is CODE, not copy. */
function literalsOn(line) {
  const out = [];
  const re = /'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"|`([^`\\]*(?:\\.[^`\\]*)*)`/g;
  let match;
  while ((match = re.exec(line)) !== null) {
    const raw = match[1] ?? match[2] ?? match[3] ?? '';
    out.push(match[3] === undefined ? raw : raw.replace(/\$\{[^{}]*\}/g, ' '));
  }
  return out;
}

/**
 * A line that is NOTHING BUT WORDS, which in a `.tsx` file is JSX children.
 *
 * `literalsOn` wants quotes round the copy. Prettier wraps at 100 characters,
 * so every sentence in a React Email template or a studio panel longer than a
 * short label sits on a line of its own, between its tags rather than inside a
 * literal. MEASURED 2026-09-25: **38,854 such lines across the 2,291 server
 * files**, none of them read until now. It found "neighbours" in
 * `studio/src/react/theme/board/words.tsx`.
 *
 * The same matcher the console test carries, including the object-property
 * rule: `cancelled: 0,` has no bracket, quote or semicolon of its own, and its
 * key is a field name that must not move.
 * [[feedback_structural_checks_go_blind]]
 */
const CODE_PUNCTUATION = /[<>{}`'"=;()\[\]]/;
const OBJECT_PROPERTY = /^[A-Za-z_$][\w$]*\s*:/;

function proseOn(line) {
  const text = line.trim();
  if (text === '') return [];
  if (CODE_PUNCTUATION.test(text)) return [];
  if (OBJECT_PROPERTY.test(text)) return [];
  if (!/[A-Za-z]{2}/.test(text)) return [];
  if (!/\s/.test(text)) return [];
  return [text];
}

/** A dotted all-lowercase identifier: an event type, a permission, a key. */
const DOTTED = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
/** A kebab or snake slug: `order-cancelled`, `tea-earl-grey`. Never a sentence. */
const SLUG = /^[a-z0-9]+([-_][a-z0-9]+)+$/;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.turbo' || name === '.next') {
      continue;
    }
    if (name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) yield full;
  }
}

let files = 0;
let literals = 0;
const offences = [];

for (const tree of TREES) {
  const base = join(ROOT, tree);
  for (const file of walk(base)) {
    const rel = `${tree}/${relative(base, file).split(sep).join('/')}`;
    files += 1;
    const code = codeOnly(readFileSync(file, 'utf8'));
    // Read each line's copy ONCE: `literalsOn`'s nested quantifiers are the
    // expensive part of this check, and it used to run them twice per file.
    const lines = code.split('\n');
    const perLine = lines.map((line) => [...literalsOn(line), ...proseOn(line)]);
    const inFile = new Set(perLine.flat());
    const exempt = THIRD_PARTY_TERMS.get(rel) ?? new Set();

    perLine.forEach((texts, i) => {
      // A line of former names holds nothing but lookup keys.
      if (FORMER_NAME_FIELD.test(lines[i] ?? '')) return;
      for (const text of texts) {
        literals += 1;
        // EVERY British word in the literal, not just the first. One sentence
        // held both "organisation" and "authorised", and reading only the first
        // match left the second in place through a sweep that had just read the
        // line. [[feedback_a_fix_leaves_its_neighbour_behind]]
        FINDER.lastIndex = 0;
        for (const found of text.matchAll(FINDER)) {
          const british = (found[1] ?? '').toLowerCase();
          const american = PAIRS[british];
          if (american === undefined) continue;
          if (exempt.has(british)) continue;
          // Both spellings in ONE literal: already deliberate.
          if (hasWord(text, american)) continue;
          const trimmed = text.trim();
          const lowercase = text === text.toLowerCase();
          // A bare alias in a list, with the American spelling elsewhere in the
          // same file. A sentence is never a bare word, and a LABEL is
          // capitalized because it is read.
          if (lowercase && trimmed === british && hasWord(code, american)) continue;
          // A value the server sends, repeated verbatim.
          if (WIRE_VALUES.has(british) && trimmed === british) continue;
          // A keyword in another format's grammar.
          if (FORMAT_KEYWORDS.has(trimmed)) continue;
          // An identifier, not copy.
          if (DOTTED.test(trimmed) || SLUG.test(trimmed)) continue;
          // A deliberate ALIAS PAIR: the same phrase spelled the American way
          // is also a literal in this file.
          const twin = americanTwin(text);
          if (lowercase && twin !== text && inFile.has(twin)) continue;
          // Somebody's name.
          if (PROPER_NOUNS.some((re) => re.test(text))) continue;
          offences.push({
            where: `${rel}:${String(i + 1)}`,
            british,
            american,
            text: trimmed.slice(0, 110),
          });
        }
      }
    });
  }
}

console.log(
  `check-american-spelling: ${String(files)} server files, ${String(literals)} pieces of copy, ` +
    `${String(Object.keys(PAIRS).length)} British words looked for.`
);

if (offences.length > 0) {
  console.error(`\n${String(offences.length)} British spelling(s) in copy the server writes:\n`);
  for (const o of offences) {
    console.error(`  ${o.where}\n      ${o.british} -> ${o.american}\n      ${o.text}`);
  }
  console.error(
    '\nThe console has guarded its own surfaces for months; this is everything\n' +
      'else a business owner reads. If the word is a column alias, a wire value,\n' +
      "a proper noun or another company's own term, say so at the top of this\n" +
      'file rather than respelling it.\n'
  );
  process.exit(1);
}

console.log('Every word the server writes is spelled the American way.');
