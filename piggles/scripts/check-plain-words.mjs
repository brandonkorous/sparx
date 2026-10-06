#!/usr/bin/env node
// Words a Piggles customer should never be made to learn, in the copy they read.
//
// ── WHY THIS IS SEPARATE FROM check-nav-vocabulary ──────────────────────────
//
// That check reads NAMES: the rail, the screen titles, the section headings,
// and a handful of named catalogs. It is exact and it is exhaustive over what it
// scans. What it does not read is the ~4,000 sentences on the screens
// themselves, and that is where the words go on arriving:
//
//   "Anything you add here appears on the record straight away, in the API …"
//   "Custom schedule (set through the API)"
//   "Sign-ups on sparx drop a lead straight into your CRM"
//
// The first two sat on Stock and Sell, which every shop owner opens. None of
// them explained the word. The person reading them runs a shop.
//
// ── WHAT IT READS, AND WHAT IT DELIBERATELY DOES NOT ────────────────────────
//
// Text between JSX tags, and the value of the props that carry sentences
// (`title`, `description`, `label`, `placeholder`, `detail`, `blurb`, `body`,
// `help`). Not every string in the file: half the console's string literals are
// Tailwind class lists, and `text-module size-5` is not a person being told
// about modules. Scanning everything made the word "module" fire ninety times
// on class names and buried the four real ones, which is how a check gets
// switched off.
//
// ── THE WORD LIST ───────────────────────────────────────────────────────────
//
// `BANNED_IN_PRODUCT_COPY` from the lexicon, parsed rather than copied, because
// a hand-copied list is how issue 607 happened: the same words were written down
// twice and only one copy was maintained. Plus a short technical set that is not
// in the lexicon because it is not a VOCABULARY choice — there is no Piggles
// word for JSON, the sentence simply should not need one.
//
// ── ALLOWED, AND DEBT ───────────────────────────────────────────────────────
//
// ALLOWED is for a term that is genuinely unavoidable AND defined on the spot,
// which is what the audience rule asks for. "API key" on AI connections is the
// worked example: the very next sentence says what one is, and it is the literal
// phrase the other app's own setup screen will use, so renaming it would leave a
// person unable to match the two.
//
// DEBT is what existed when this was written. It may SHRINK and never grow. A
// string in neither list fails the build.

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PIGGLES = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Every tree that holds sentences a person reads.
 *
 * `surfaces` + `components` + `lib/console` were the original three, and they
 * left four more outside the check with 205 files between them — including the
 * whole builder canvas, where "· live region" (a screen-reader term) was printed
 * under a footer block on every site anybody edited.
 *
 * `lib/surfaces` IS DELIBERATELY NOT HERE, and it is the one directory that must
 * stay out. It holds the surface CATALOG, whose titles are not what a person
 * reads: `lib/console/vocabulary.ts` overrides them, and `check-nav-vocabulary`
 * resolves each one the way the app does before testing it. Scanning the raw
 * catalog reports "Product fitment" and "How the CRM behaves" — both of which
 * were renamed years of sessions ago and render as "What it fits" and "How this
 * app behaves". Two false alarms is how a check gets switched off.
 */
const SCAN_ROOTS = [
  join(PIGGLES, 'apps', 'workbench', 'surfaces'),
  join(PIGGLES, 'apps', 'workbench', 'components'),
  join(PIGGLES, 'apps', 'workbench', 'lib', 'console'),
  join(PIGGLES, 'apps', 'workbench', 'lib', 'studio'),
  join(PIGGLES, 'apps', 'workbench', 'lib', 'tour'),
  join(PIGGLES, 'apps', 'workbench', 'lib', 'onboarding'),
  join(PIGGLES, 'apps', 'workbench', 'lib', 'dock'),
];

// Every root asserted. A check that scans a directory which has moved reports
// zero problems, in green, forever.
for (const root of SCAN_ROOTS) {
  if (!existsSync(root)) {
    console.error(`check:plain-words — scan root is missing: ${root}`);
    console.error('Point this at its new home; carrying on would scan nothing.');
    process.exit(1);
  }
}

/**
 * Screens this brand does not have, so their words are never read HERE.
 *
 * `hiddenSurfaces` in lib/console/product.tsx removes whole surfaces from the
 * Piggles console because they are about a sparx PRODUCT: what a business pays
 * WizeWorks, turning priced modules on and off, the reseller programme. Their
 * files still sit in this tree — the two consoles share a surface set — and
 * their copy is sparx's copy, written for sparx's reader.
 *
 * Scanning them reported seven findings on screens nobody using this brand can
 * open, including "You're not paying for any paid modules right now" on a
 * billing pane Piggles deliberately does not show. A check that reports work
 * nobody can act on is a check that gets switched off, so the hidden set is
 * PARSED from the same file the app reads it from rather than listed again
 * here. A `partner.*` entry hides the whole namespace, which is the form that
 * kept an eighth partner screen from being missed.
 */
function hiddenSurfaceDirs() {
  const file = join(PIGGLES, 'apps', 'workbench', 'lib', 'console', 'product.tsx');
  if (!existsSync(file)) {
    console.error(`check:plain-words — the brand adapter is missing: ${file}`);
    console.error('It moved or was renamed. Fix this parser rather than deleting the check.');
    process.exit(1);
  }
  // Comments first. Every entry carries a paragraph saying why that product is
  // not this brand's, and those paragraphs are full of apostrophes — "the
  // rail's plan card", "sparx's reseller programme" — so a naive scan for
  // quoted strings reads the prose BETWEEN two of them as a surface key. The
  // lexicon parser two functions up learned the same lesson.
  const block = /const hiddenSurfaces = new Set\(\[([\s\S]*?)\]\);/.exec(
    stripComments(readFileSync(file, 'utf8'))
  );
  if (!block) {
    console.error('check:plain-words — hiddenSurfaces is not where this expects it.');
    process.exit(1);
  }
  const keys = new Set([...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]));
  if (keys.size < 3) {
    console.error(`check:plain-words — parsed only ${String(keys.size)} hidden surfaces.`);
    console.error('That is fewer than the adapter has ever hidden; the parse is wrong.');
    process.exit(1);
  }

  // The key says which SCREEN; this says which FILE. Derived by hand because a
  // key does not name its file — `platform.settings.modules` is rendered by
  // surfaces/modules/modules-list.tsx — and deriving it properly would mean
  // parsing the catalog's imports to follow a component name back to a path.
  //
  // It cannot rot quietly: every key below is checked against the set just
  // parsed, so un-hiding a screen turns this red rather than silently leaving
  // its file unscanned.
  const files = {
    'finance.subscription': 'finance/subscription.tsx',
    'platform.settings.modules': 'modules/modules-list.tsx',
  };
  const skip = new Set();
  for (const [key, file] of Object.entries(files)) {
    if (!keys.has(key)) {
      console.error(`check:plain-words — "${key}" is no longer hidden from this brand.`);
      console.error(`Remove it here so ${file} is scanned again.`);
      process.exit(1);
    }
    skip.add(file);
  }
  return skip;
}

const HIDDEN_FILES = hiddenSurfaceDirs();

/** The path under surfaces/, or null for a file that is not a surface. */
function surfacePath(file) {
  const parts = file.split(/[\\/]/);
  const at = parts.lastIndexOf('surfaces');
  return at === -1 ? null : parts.slice(at + 1).join('/');
}

const LEXICON = join(PIGGLES, 'packages', 'config', 'src', 'lexicon.ts');
if (!existsSync(LEXICON)) {
  console.error(`check:plain-words — the lexicon is missing: ${LEXICON}`);
  process.exit(1);
}

/** The banned list, PARSED from the lexicon so there is only ever one of it. */
function bannedWords() {
  // Comments first: the entry explaining why a word is banned quotes that word,
  // so a naive parse reads every hit twice.
  const source = readFileSync(LEXICON, 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  const block = /export const BANNED_IN_PRODUCT_COPY = \[([\s\S]*?)\] as const;/.exec(source);
  if (!block) {
    console.error('check:plain-words — BANNED_IN_PRODUCT_COPY is not where this expects it.');
    console.error('It moved or was renamed. Fix this parser rather than deleting the check.');
    process.exit(1);
  }
  const words = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  if (words.length < 10) {
    console.error(`check:plain-words — parsed only ${String(words.length)} banned words.`);
    console.error('That is fewer than the list has ever had; the parse is wrong.');
    process.exit(1);
  }
  return words;
}

/** Not vocabulary choices — there is no Piggles word for these, and a sentence
 *  that needs one is the wrong sentence.
 *
 *  "live region" is the odd one out: it is not a thing a person might need named,
 *  it is a SCREEN-READER term that got borrowed to mean "the platform fills this
 *  in for you". It sat on the builder canvas under every block the platform
 *  draws — "Shopping cart · live region" — where the question the author is
 *  actually asking is whether their customers will see the grey box in front of
 *  them. */
const TECHNICAL = [
  'API',
  'JSON',
  'endpoint',
  'payload',
  'OAuth',
  'idempotent',
  'webhook',
  'live region',
];

/**
 * Each entry is a decision, with the reason it was made.
 *
 * There is exactly one reason on this list, and it is the one the audience rule
 * already allows for: THE WORD IS ON SOMEBODY ELSE'S SCREEN. When we are telling
 * a person to go to Stripe and click a thing, the thing is called what Stripe
 * calls it. Translating it into plainer words would leave her reading our
 * sentence and looking at a menu that does not contain any of it — which is a
 * worse failure than the jargon, because now she cannot finish the job.
 *
 * "It was too hard to reword" is not a reason and does not go here.
 */
const ALLOWED = [
  // The section defines it in its own next sentence ("a key does the same job …
  // treat a key like a password"), and it is the literal phrase the other app's
  // setup screen uses.
  'API key',
  'API keys',
  // Finding that key on somebody else's website: their menu says "API keys".
  'under API keys',
  // Connecting Stripe. Every one of these is a word on a Stripe screen that she
  // has to find: the menu path, the field she pastes into, and the value Stripe
  // hands back. Our own sentence around them is plain.
  'In Stripe: Developers',
  'webhook address',
  'Webhook signing secret',
  // The same job for Square, PayPal and Authorize.net (issue 739): each menu
  // path is the one on their screen, and each field name is the value their
  // screen hands back, pasted into the field of that name above. A custom
  // processor is told the secret by whoever set it up, under that name.
  'In Square: Developer Console',
  'In Authorize.net: Account',
  'Webhook signature key',
  'Webhook ID',
  'Webhook secret',
  // Bringing a shop over from elsewhere: these are the file types her old
  // system gave her, and the clause after the colon is the definition.
  'whatever your platform gave you',
  // The name of an HTTP header her supplier's system asks for. It is typed into
  // their system, not ours, and a plainer name would not be the one that works.
  'X-API-Key',
];

const DEBT_FILE = join(PIGGLES, 'scripts', 'plain-words-debt.txt');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

/** A comment is for us, not the reader. */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => (line.trim().startsWith('//') ? '' : line))
    .join('\n');
}

/** The props that carry a sentence. `className` is pointedly not one. */
const COPY_PROPS =
  /\b(?:title|description|label|placeholder|detail|blurb|body|help|helpText|message|summary|tagline|noun|confirmLabel|cancelLabel|retryLabel)\s*[:=]\s*(?:\{\s*)?(['"`])([^'"`]{8,600})\1/g;

/**
 * A TEMPLATE LITERAL with a value in the middle of it, wherever it sits.
 *
 * The two passes above reach a named prop and a run of JSX text. A sentence in
 * the losing half of a ternary is neither:
 *
 *     : `This product is also in ${String(n)} collections that are no longer
 *        in your list.`
 *
 * The singular branch beside it had already been reworded to "one group"; this
 * one kept the word RULE #3 bans first, and no pass could see it, because
 * COPY_PROPS captures the raw text and `${…}` reads as code (issue 897).
 * Likewise `aria-label={`Save ${name} to a collection`}` on a pane that says
 * "album" in all seven of its visible labels.
 *
 * Most template literals in a console are NOT sentences, so two rejections
 * carry this pass: one that starts with a slash is an address, and one with no
 * capital letter and hyphens through it is a list of classes. Measured over
 * 1,264 files: without them, 57 findings, 55 of them addresses and class
 * strings; with them, 2, both real.
 */
const TEMPLATE_SENTENCE = /`((?:[^`\\]|\\.)*\$\{(?:[^`\\]|\\.)*)`/g;
const TEMPLATE_VALUE = /\$\{[^{}]*\}/g;

function isAddressOrClassList(text) {
  if (text.startsWith('/')) return true;
  return !/[A-Z]/.test(text) && (text.match(/[a-z]-[a-z]/g) ?? []).length >= 2;
}

/**
 * A run of text between JSX tags, INCLUDING one with a value in the middle of it.
 *
 * This used to reject any run containing a brace, which quietly excluded 576 of
 * the console's 4,362 sentences — one sentence in eight — because most real
 * sentences on a console have a number or a name in them:
 *
 *     The {String(FINISHED_SHOWN)} most recent. Older runs live in the module
 *     that started them.
 *
 * That one was live on Pulse, and "module" is the first word the lexicon bans:
 * Piggles has no modules and does not price by them. The check read the file,
 * counted it, and could not see the sentence.
 *
 * `{…}` spans are replaced with an ellipsis before the prose test below, so an
 * interpolation reads as a word rather than as code. Nested braces are not
 * matched on purpose — `{items.map(x => <Row/>)}` is a subtree, not a sentence,
 * and the inner tags are found on their own.
 */
const JSX_TEXT = />((?:[^<>'"`]|\{[^{}<>]*\}){8,600})</g;
const INTERPOLATION = /\{[^{}]*\}/g;

/**
 * Whether a captured string is a SENTENCE rather than code that happened to sit
 * between a `>` and a `<`.
 *
 * The JSX-text pattern is what needs this: an arrow function's `=>` supplies the
 * opening angle bracket and a generic or a comparison supplies the closing one,
 * so `=> api.get(` reads as text. Without this filter the check reported 1,040
 * findings, almost all of them `api.get`, which is exactly how a check gets
 * switched off instead of read.
 */
function looksLikeCode(text) {
  if (/[;={}()[\]|<>]/.test(text)) return true;
  // A method chain wrapped onto the next line — `api\n  .list` — which collapses
  // to "api .list" and is the shape that survived every other test here.
  if (/\s\./.test(text)) return true;
  // `a.b` is code, unless a real sentence ended before it: a LETTER, then a full
  // stop, then a space. The letter matters — "id ? api.patch" has a space before
  // its question mark, and without it that read as prose.
  if (/\w\.\w/.test(text) && !/[a-z][.!?]\s/i.test(text)) return true;
  if (!/[A-Za-z]{2,}/.test(text)) return true;
  return false;
}

function isProse(text) {
  if (!/\s/.test(text)) return false;
  if (looksLikeCode(text)) return false;
  // TWO WORDS, ONE OF THEM REAL. This used to demand two ADJACENT words of two
  // letters or more, which quietly excluded every short phrase whose middle word
  // is one letter: "Add a redirect" has three words and no two long ones side by
  // side, so a button saying it on a screen deliberately renamed "Old links" was
  // invisible to the check that exists to catch exactly that.
  //
  // Loosening it alone would have re-admitted the `api.get` noise this filter was
  // written for (measured: 29 new findings, 28 of them `api .list`). The two
  // rejections above are what make it safe — with them, the looser test gains
  // 212 strings, ONE new finding, and loses nothing.
  return (
    text
      .trim()
      .split(/\s+/)
      .filter((word) => /[A-Za-z]/.test(word)).length >= 2
  );
}

function readableText(source) {
  const out = [];
  // A NAMED COPY PROP IS PROSE BY VIRTUE OF ITS NAME. The two-word rule exists
  // to throw out code that happened to sit between a `>` and a `<`; a string
  // assigned to `noun` or `confirmLabel` did not get there by accident. Holding
  // prop values to that rule hid every ONE-WORD term on the platform: the CRM's
  // process pane said `noun="pipeline"`, which renders "That pipeline is no
  // longer here", and this check read the string, counted it, and threw it away
  // for having one word (issue 897). [[feedback_structural_checks_go_blind]]
  for (const [, , text] of source.matchAll(COPY_PROPS)) {
    const value = text.replace(/\s+/g, ' ').trim();
    if (!looksLikeCode(value)) out.push(value);
  }
  for (const [, text] of source.matchAll(JSX_TEXT)) {
    // The value stands in as an ellipsis: what is being checked is the words
    // AROUND it, and the value itself is whatever the screen happens to hold.
    const value = text.replace(INTERPOLATION, ' … ').replace(/\s+/g, ' ').trim();
    if (isProse(value)) out.push(value);
  }
  for (const [, raw] of source.matchAll(TEMPLATE_SENTENCE)) {
    const value = raw.replace(TEMPLATE_VALUE, ' … ').replace(/\s+/g, ' ').trim();
    if (isProse(value) && !isAddressOrClassList(value)) out.push(value);
  }
  return out;
}

const WORDS = [...bannedWords(), ...TECHNICAL];

/**
 * The banned word, IN THE PLURAL TOO.
 *
 * The lexicon lists singulars, and `\bcollection\b` does not match
 * "collections" — the `s` is a word character, so the boundary fails. That is
 * the form the word is most often written in: "This product is also in 3
 * collections that are no longer in your list" sat live on the product pane and
 * this check read it, matched nothing, and passed (issue 897). The ALLOWED list
 * already carried 'API key' AND 'API keys' as two entries, which is somebody
 * meeting this and working around it one word at a time.
 *
 * Only a trailing `s`. Nothing here needs "-ies" or "-es", and guessing at
 * English plurals is how a check starts reporting things that are not words.
 */
const patterns = WORDS.map((word) => ({
  word,
  re: new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`, 'i'),
}));

const found = [];
let scanned = 0;
let skipped = 0;
for (const root of SCAN_ROOTS) {
  for (const file of walk(root)) {
    const where = surfacePath(file);
    if (where !== null && HIDDEN_FILES.has(where)) {
      skipped += 1;
      continue;
    }
    scanned += 1;
    const source = stripComments(readFileSync(file, 'utf8'));
    for (const text of readableText(source)) {
      if (ALLOWED.some((a) => text.includes(a))) continue;
      const hit = patterns.find(({ re }) => re.test(text));
      if (!hit) continue;
      found.push({ file: relative(PIGGLES, file).split('\\').join('/'), word: hit.word, text });
    }
  }
}

const unique = [...new Set(found.map((f) => f.text))].sort();

if (process.argv.includes('--update')) {
  writeFileSync(DEBT_FILE, `${unique.join('\n')}\n`, 'utf8');
  console.log(`Wrote ${String(unique.length)} known string(s) to ${relative(PIGGLES, DEBT_FILE)}`);
  process.exit(0);
}

const debt = existsSync(DEBT_FILE)
  ? new Set(
      readFileSync(DEBT_FILE, 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith('#'))
    )
  : new Set();

const fresh = found.filter((f) => !debt.has(f.text));
const gone = [...debt].filter((d) => !unique.includes(d));

if (fresh.length > 0) {
  console.error(
    `\n${String(fresh.length)} new string(s) put a word on screen that a shop owner\n` +
      'should not have to learn.\n\n' +
      'Say it in words instead, or if the term is genuinely unavoidable, define it in\n' +
      'the same breath and add it to ALLOWED with that reason.\n'
  );
  for (const f of fresh) console.error(`  [${f.word}] ${f.file}\n      ${f.text.slice(0, 150)}`);
  console.error('');
  process.exit(1);
}

if (gone.length > 0) {
  console.log(`\n${String(gone.length)} known string(s) are gone. Run --update to bank it:`);
  for (const g of gone) console.log(`  - ${g.slice(0, 150)}`);
}

console.log(
  `check:plain-words — ${String(scanned)} file(s) read, ` +
    `${String(skipped)} skipped as screens this brand hides, ` +
    `${String(unique.length)} known plain-word debt, no new jargon ` +
    `(${String(WORDS.length)} words watched).`
);
