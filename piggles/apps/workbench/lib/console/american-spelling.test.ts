// AMERICAN SPELLING IN EVERYTHING A BUSINESS OWNER READS.
//
// The two consoles had drifted apart: Piggles said "Tickets and licenses" and
// sparx said "Tickets and licences", in a pane title, a section heading, a field
// description and a nav entry. Nobody notices until a customer does.
//
// This scans STRING LITERALS in the surfaces and the surface catalog, which is
// where copy lives — not comments, and not identifiers. Scanning whole lines
// instead flagged `const { data: catalogue } = useMigrationVendors()` three
// times, which nobody reads and which the header had already promised not to
// look at.
//
// TWO THINGS IT MUST NOT BREAK, both of them lookups keyed on the British
// spelling rather than copy anybody reads:
//
//   · SEARCH KEYWORDS. A pane lists both spellings on purpose, so an owner who
//     types "licences" still finds it. Removing one would make the pane
//     unfindable for exactly the people who need the alias.
//   · IMPORT COLUMN ALIASES. `['organisation', 'organization', …]` matches a
//     heading in a spreadsheet somebody else wrote. Dropping the British form
//     silently stops matching their file.
//
// Both are BARE words in an array, one per entry, so that is what earns the
// exemption: a literal holding nothing but the word, in a file that also spells
// it the American way. A sentence never looks like that.
//
// ── EDIT THIS FILE WITH AN EDITOR, NEVER THROUGH A SHELL HEREDOC ─────────────
//
// The first version of it was written through one, which ate a backslash and
// turned every `\\b` into `\b` — a BACKSPACE character inside a template
// literal, not a word boundary. The pattern then matched nothing, and the whole
// guard passed, green, over a file that really did say "licences". It was caught
// only by breaking what it guards and watching it stay green, which is why the
// matcher now has a test of its own before anything trusts what it reports.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The repo's one list of British spellings, shared with
// `scripts/check-american-spelling.mjs`. Plain data, no side effects.
import { BRITISH_WORDS } from '../../../../../scripts/british-words.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOTS = [resolve(HERE, '..', '..', 'surfaces'), resolve(HERE, '..', 'surfaces')];

/**
 * British → American.
 *
 * ── Why this list is long, and must stay long ──────────────────────────────
 *
 * It used to be "the words this codebase has actually drifted on", which is a
 * list built from whatever was found the day it was written — and a list like
 * that stops growing the moment it goes green. It did. The guard passed,
 * honestly and for months, while **twenty-eight** status labels across Selling,
 * Customers, Email, Money and Stock read "Cancelled", including a badge sitting
 * three lines away from a sentence in the same file that said "canceled".
 *
 * So the list is now the ordinary British/American pairs a business console can
 * plausibly contain, whether or not anybody has typed one yet. A word that
 * cannot appear costs nothing to list; a word that CAN appear and is missing
 * costs exactly what it cost here. [[feedback_structural_checks_go_blind]]
 *
 * ── And it is ONE list now ────────────────────────────────────────────────
 *
 * It used to be a copy of the server's, kept in step by hand, and it had fallen
 * out of step twice: the server knew `millimetre` and this did not, and neither
 * knew `fulfil` while both knew `fulfilment` — so "ready to fulfil" shipped in a
 * toast in both consoles with every check green. The words live in
 * `scripts/british-words.mjs` and both guards read them from there, so adding
 * one covers every surface at once.
 */
const PAIRS: Record<string, string> = BRITISH_WORDS;

/**
 * Words the SERVER speaks, which this side repeats exactly.
 *
 * `status === 'cancelled'` is not a spelling choice. It is the string in the
 * database and in the event catalog (`order.cancelled`), and Americanising it
 * here would not fix a spelling, it would silently stop matching — a status
 * filter that quietly returns nothing, with every check still green.
 * [[feedback_copy_edit_breaks_identity_lookups]]
 *
 * This exempts ONLY a literal that is exactly the bare lowercase word. The LABEL
 * a person reads beside it is a different literal, and that one is still
 * checked — which is the whole point: the value stays `cancelled`, the badge
 * says "Canceled".
 */
const WIRE_VALUES = new Set(['cancelled', 'cancellation']);

const WORDS = Object.keys(PAIRS).join('|');

/**
 * Built ONCE, not per call.
 *
 * It used to be compiled inside `britishIn`, which was affordable while the
 * scan was 7,400 string literals and is not now that `proseOn` brought another
 * 18,000 lines with it: a 200-word alternation recompiled 26,000 times took the
 * test past its 5s budget and it failed as a TIMEOUT, which reads exactly like
 * a broken guard. `lastIndex` never survives a call because there is no `g`.
 */
const BRITISH_RE = new RegExp(String.raw`\b(` + WORDS + String.raw`)\b`, 'i');

/** One British word inside a string literal, or null. Exported shape kept tiny
 *  so the matcher can be proven on known input before it is trusted on a tree. */
function britishIn(text: string): string | null {
  const found = BRITISH_RE.exec(text);
  return found ? found[1]!.toLowerCase() : null;
}

/** A dotted all-lowercase identifier: an event type, a permission, a settings
 *  key. Declared once rather than rebuilt per literal. */
const DOTTED = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

function hasWord(text: string, word: string): boolean {
  return new RegExp(String.raw`\b` + word + String.raw`\b`, 'i').test(text);
}

/** Blank out comments while KEEPING newlines, so line numbers stay true. */
function codeOnly(source: string): string {
  const blank = (match: string): string => match.replace(/[^\n]/g, ' ');
  return source.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/\/\/[^\n]*/g, blank);
}

/** Every string literal on one line of code: 'a', "b", `c`. */
function literalsOn(line: string): string[] {
  const out: string[] = [];
  const re = /'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"|`([^`\\]*(?:\\.[^`\\]*)*)`/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(line)) !== null) {
    // A template literal's `${...}` is CODE. `${data.counts.cancelled}` names a
    // field the server sends, and reading it as copy makes the guard demand a
    // rename that would turn the number into `undefined` while the sentence
    // around it still reads perfectly. The words either side ARE copy and are
    // still checked. [[feedback_copy_edit_breaks_identity_lookups]]
    const raw = match[1] ?? match[2] ?? match[3] ?? '';
    out.push(match[3] === undefined ? raw : raw.replace(/\$\{[^{}]*\}/g, ' '));
  }
  return out;
}

/**
 * Words written straight between two JSX tags, which are copy and are not a
 * string literal.
 *
 * `<option value="cancelled">Cancelled</option>` has TWO spellings on one line
 * and they are not the same kind of thing: the attribute is the value the server
 * sends and must not move, while the text is what a person reads in the menu.
 * Reading literals alone saw only the one that must never change.
 *
 * Deliberately narrow: text on one line, no braces, so an expression is never
 * mistaken for words. `wrappedProse` below reads the rest.
 */
function jsxTextOn(line: string): string[] {
  const out: string[] = [];
  const re = />([^<>{}\n]*[A-Za-z][^<>{}\n]*)</g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(line)) !== null) {
    const text = (match[1] ?? '').trim();
    if (text !== '') out.push(text);
  }
  return out;
}

/**
 * A line that is NOTHING BUT WORDS, which in a `.tsx` file is JSX children and
 * can be nothing else.
 *
 * ── WHY THIS HAD TO EXIST ───────────────────────────────────────────────────
 *
 * `jsxTextOn` wants the tags on the same line as the text. Prettier wraps at
 * 100 characters, so every sentence longer than a short label ends up on a line
 * of its own with no tag either side of it:
 *
 *     <FieldDescription>
 *       Leave this empty and replies are labelled with the page the form sits on.
 *     </FieldDescription>
 *
 * That sentence was on screen in Piggles while this guard was green, because the
 * guard could not see the line it lives on. MEASURED 2026-09-25 across both
 * consoles' `surfaces`, `lib/surfaces` and `components`: **7,412 JSX texts with
 * their tags on the same line, and 18,244 prose lines without them.** The guard
 * was reading 29% of the JSX copy in the console and reporting on all of it.
 *
 * Widening it found five: "labelled" here, and "neighbours", "personalise",
 * "catalogue" and "recognises" in sparx. [[feedback_structural_checks_go_blind]]
 *
 * ── WHY THE TEST IS "NO CODE CHARACTERS", NOT "LOOKS LIKE A SENTENCE" ───────
 *
 * Anything a compiler cares about brings punctuation with it: a tag, a brace, a
 * quote, an `=`, a `;`, a bracket. A line carrying none of those, inside a file
 * the comment blanker has already been over, is prose. Requiring whitespace as
 * well drops a bare identifier on its own line, which is code that happens to be
 * spelled like a word.
 */
const CODE_PUNCTUATION = /[<>{}`'"=;()[\]]/;

/**
 * An object property written without quotes: `cancelled: 0,`,
 * `externalId: organisation,`. It carries no bracket, quote or semicolon of its
 * own, so the punctuation test above lets it through — and its key is a field
 * name, which must not move. Found by running this matcher over the server
 * trees, where it flagged three of them. [[feedback_a_copy_edit_breaks_identity_lookups]]
 */
const OBJECT_PROPERTY = /^[A-Za-z_$][\w$]*\s*:/;

function proseOn(line: string): string[] {
  const text = line.trim();
  if (text === '') return [];
  if (CODE_PUNCTUATION.test(text)) return [];
  if (OBJECT_PROPERTY.test(text)) return [];
  if (!/[A-Za-z]{2}/.test(text)) return [];
  if (!/\s/.test(text)) return [];
  return [text];
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full) && !/\.test\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

interface Hit {
  where: string;
  british: string;
  text: string;
}

function britishInCopy(): { hits: Hit[]; files: number; literals: number } {
  const hits: Hit[] = [];
  let files = 0;
  let literals = 0;

  for (const root of ROOTS) {
    for (const file of walk(root)) {
      files += 1;
      const code = codeOnly(readFileSync(file, 'utf8'));
      // Read each line's copy ONCE. It used to be read twice — once to build
      // the alias set, once to scan — and `literalsOn`'s nested quantifiers are
      // the expensive part of this test, so doubling them doubled the whole run.
      const perLine = code
        .split('\n')
        .map((line) => [...literalsOn(line), ...jsxTextOn(line), ...proseOn(line)]);
      // Every literal in the file, so an alias pair is recognised wherever its
      // American twin happens to sit.
      const literalsInFile = new Set(perLine.flat());
      perLine.forEach((texts, i) => {
        for (const text of texts) {
          literals += 1;
          const british = britishIn(text);
          if (british === null) continue;
          const american = PAIRS[british]!;
          // Both spellings in ONE literal — already deliberate.
          if (hasWord(text, american)) continue;
          // ── The exemptions below apply ONLY to lowercase text ──────────────
          //
          // A search keyword and an import-column alias are written lowercase
          // ('licences', 'labour cost'). A LABEL is capitalized, because it is
          // read. Without that distinction `cancelled: 'Cancelled'` slipped
          // through both rules below — the literal is a bare word, and the
          // file's other labels already said 'Canceled', so the alias exemption
          // fired on a label. The guard stayed green over the exact defect it
          // had just been widened to catch, and only breaking it on purpose
          // showed that. [[feedback_a_test_that_cannot_go_red]]
          const lowercase = text === text.toLowerCase();

          // A bare alias in a list, with the American spelling elsewhere in the
          // same file. A sentence is never a bare word.
          if (lowercase && text.trim() === british && hasWord(code, american)) continue;
          // A value the server sends, repeated verbatim. Bare and lowercase, so
          // a label or a sentence can never reach this line.
          if (WIRE_VALUES.has(british) && text.trim() === british) continue;
          // A dotted, all-lowercase identifier: an event type
          // (`order.cancelled`), a permission, a settings key. Never copy, and
          // renaming one breaks a lookup rather than fixing a spelling.
          if (DOTTED.test(text.trim())) continue;
          // A deliberate ALIAS PAIR: the same phrase spelled the American way
          // is also a literal in this file. `['labour cost', 'labor cost']` is
          // a search keyword list, and dropping the British half makes the pane
          // unfindable for exactly the people who need the alias. Generalises
          // the bare-word rule above from a word to a phrase.
          // [[feedback_copy_edit_breaks_identity_lookups]]
          const twin = text.replace(
            new RegExp(String.raw`\b` + british + String.raw`\b`, 'gi'),
            american
          );
          if (lowercase && twin !== text && literalsInFile.has(twin)) continue;
          hits.push({
            where: `${relative(root, file).split(sep).join('/')}:${String(i + 1)}`,
            british,
            text: text.slice(0, 100),
          });
        }
      });
    }
  }
  return { hits, files, literals };
}

describe('the words a business owner reads', () => {
  it('scans a real set of files', () => {
    // The denominator. A scan whose roots moved would find nothing and pass the
    // assertion below without having looked at anything.
    const { files, literals } = britishInCopy();
    expect(files).toBeGreaterThan(200);
    expect(literals).toBeGreaterThan(2000);
  });

  it('can actually see a British spelling', () => {
    // The guard on the guard. The first version of this file matched NOTHING
    // because a shell heredoc turned `\\b` into a backspace character, so it
    // passed over real drift.
    expect(britishIn('Tickets and licences')).toBe('licences');
    expect(britishIn('Tickets and licenses')).toBeNull();
    expect(britishIn('A fulfilment company')).toBe('fulfilment');
    // The word that went missing for months because the list was short.
    expect(britishIn('Cancelled')).toBe('cancelled');
    expect(britishIn('This order was canceled')).toBeNull();
  });

  it('never exempts a capitalized label as if it were a search alias', () => {
    // The hole the red proof found: 'Cancelled' is a bare word whose American
    // twin sits elsewhere in the same file, which satisfied both alias rules —
    // so a label was treated as a deliberate keyword and the guard went green
    // over it. A keyword is lowercase; a label is read.
    const { hits } = britishInCopy();
    expect(hits.filter((hit) => hit.text === 'Cancelled')).toEqual([]);
  });

  it('does not read a field name out of a template hole', () => {
    // `${data.counts.cancelled}` is the server's field, not a word anybody reads.
    expect(literalsOn('`${String(data.counts.cancelled)} customers left`')).toEqual([
      '  customers left',
    ]);
    // And the words around a hole are still copy.
    // Two spaces: the hole becomes one, and the literal already had one after it.
    expect(literalsOn('`${n} orders were cancelled`')).toEqual(['  orders were cancelled']);
  });

  it('reads string literals, not identifiers', () => {
    // `const { data: catalogue } = …` is nobody's copy.
    expect(literalsOn('const { data: catalogue } = useMigrationVendors();')).toEqual([]);
    expect(literalsOn('title="Tickets and licences"')).toEqual(['Tickets and licences']);
    expect(literalsOn("keywords: ['licences', 'licenses'],")).toEqual(['licences', 'licenses']);
  });

  it('reads the words BETWEEN tags, which are not literals', () => {
    // The gap that let `<option value="cancelled">Cancelled</option>` through:
    // the attribute is the server's value and must not move, the text is what a
    // person reads, and only one of them was being looked at.
    expect(jsxTextOn('<option value="cancelled">Cancelled</option>')).toEqual(['Cancelled']);
    expect(jsxTextOn('<AlertTitle>Cancelled</AlertTitle>')).toEqual(['Cancelled']);
    // An expression is not words.
    expect(jsxTextOn('<td>{row.cancelled}</td>')).toEqual([]);
  });

  it('are spelled the American way, unless the word is a deliberate alias', () => {
    const { hits } = britishInCopy();
    expect(
      hits.map((hit) => `${hit.where}  ${hit.british}  ${hit.text}`),
      'British spelling in copy'
    ).toEqual([]);
  });
});
