#!/usr/bin/env node
// A SCREEN WHOSE BODY CALLS IT SOMETHING ELSE.
//
// Piggles renames the shared console's screens in `lib/console/vocabulary.ts`:
// sparx names things by category, Piggles names them by what you are doing.
// "Checkout sessions" becomes "Half-finished checkouts". "Price lists" becomes
// "Special prices". Forty-nine of the renames are more than one word long.
//
// The rename reaches the tab, the nav and the launcher. It does NOT reach the
// sentences inside the pane, because those are typed into the component and pass
// through nothing. So a shop owner opens a pane titled **Half-finished
// checkouts** and reads, in its own body:
//
//     Loading checkout sessions…
//     No checkout sessions
//
// Two names for one thing, on one screen, and the second one is the word the
// rename exists to keep away from her. [[feedback_a_copy_edit_breaks_identity_lookups]]
//
// ── IT USED TO COMPARE A FILE WITH ITS OWN SCREEN ONLY ──────────────────────
//
// The first version matched every renamed title against every file, which said
// the scheduling waiting list was using Stock's word and that "printed on
// purchase orders" was a screen reference. So it was narrowed to the file that
// IMPLEMENTS the surface, tied together through the catalog's import line.
//
// That caught the 99 sentences of issue 719 and left the other half standing.
// A DETAIL pane is its own surface with its own key, and only the LIST is
// renamed, so `price-list-detail.tsx` said "price list" sixteen times under a
// tab reading Special prices and this check never looked at it. Nor at a pane
// that names a DIFFERENT screen: Your own columns headed a section "Purchase
// orders" while the menu item says Orders to suppliers. 89 sentences in 39
// files, none of them its own screen. Issue 723.
//
// So it reads every surface file against every renamed name, and the two false
// positives that forced the narrowing are now ruled out by structure rather
// than by a list:
//
//   • A PHRASE THAT IS STILL A LIVE PIGGLES NAME is never wrong. "Waiting list"
//     is what the Bookings diary calls its queue, and "Bills to pay" is Money's
//     own screen - vocabulary.ts says both out loud, which is WHY the stock ones
//     were renamed. If some screen in this console is called it today, it is a
//     word this console uses.
//   • A RENAME THAT ONLY CHANGES PUNCTUATION is not a rename. "People &
//     equipment" became "People and equipment".
//
// It reads `.ts` as well as `.tsx`, because a label map is copy: the section
// heading "Purchase orders" on Your own columns lives in `onboarding-data.ts`,
// two files away from the pane that draws it, and a .tsx-only scan walked past
// it while fixing the sentence underneath. Sentences are read up to 400
// characters, because the one that DEFINES a thing is the longest on the pane
// and was the one being missed.
//
// The denominator is printed for the same reason as before: a scan that resolves
// no files would otherwise pass in silence.
// [[feedback_structural_checks_go_blind]]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKBENCH = resolve(HERE, '..', 'apps', 'workbench');
const CATALOG = join(WORKBENCH, 'lib', 'surfaces', 'catalog');
const SURFACES = join(WORKBENCH, 'surfaces');
const VOCABULARY = join(WORKBENCH, 'lib', 'console', 'vocabulary.ts');

/**
 * Words that are somebody else's product, not ours to rename.
 *
 * Google's console is called Search Console on Google's own screens, so a
 * sentence telling somebody to go and look there has to say what they will see.
 * Keyed by the surface it is allowed on, so it cannot spread.
 */
const OTHER_COMPANIES = [['seo.search-console', 'Search Console']];

/**
 * Words a STANDARD owns, on the one screen that has to teach the standard.
 *
 * "Record type" is what RFC 1035 calls the kind of a DNS entry, and the domain
 * screen has to say it because that is the word on the registrar's form the
 * reader is about to open. It is not the CRM's Things you track wearing a
 * different name. Keyed by file, so it cannot spread to a screen that IS talking
 * about ours.
 */
/**
 * Where a renamed screen's word is ORDINARY ENGLISH on that same screen.
 *
 * `[file, word]`. A one-word rename is a name inside the file that draws it —
 * except where the word is also the plain verb or noun for what is happening,
 * and no plainer word exists. "Could not finish re-scoring" is the action, not
 * the screen; "profit" is the word for the number on a screen called What you
 * kept; "for approval" is what holding an order IS.
 */
const NOT_OUR_WORD = [
  ['surfaces/domains/domain-detail.tsx', 'record type'],
  // The verb for working a number out again. There is no plainer one.
  ['surfaces/crm/scoring.tsx', 'scoring'],
  // The screen is "What you kept"; the number on it is a profit, and calling
  // it anything else would be avoiding the word a business owner uses.
  ['surfaces/finance/profit.tsx', 'profit'],
  // "Hold an order for approval" is what the setting does. The screen it leads
  // to is named correctly elsewhere in the same sentence.
  ['surfaces/b2b/approvals.tsx', 'approval'],
  ['surfaces/social/approvals.tsx', 'approval'],
  // The act of connecting an account, not the screen that lists them.
  ['surfaces/social/connections.tsx', 'connection'],
];

for (const path of [CATALOG, SURFACES, VOCABULARY]) {
  if (!existsSync(path)) {
    console.error(`check:screen-names — ${path} is not there. The tree has moved.`);
    process.exit(1);
  }
}

/**
 * Piggles' name for a surface, by key.
 *
 * Only PIGGLES_SURFACES. The same file also holds PIGGLES_CREATE_LABELS, keyed
 * the same way, and reading the whole file let a create label overwrite the
 * name: Orders to suppliers came back as "New order", so every breach in a
 * purchase order file was reported against a button instead of a tab.
 */
function pigglesTitles() {
  const src = readFileSync(VOCABULARY, 'utf8');
  const from = src.indexOf('PIGGLES_SURFACES');
  const to = src.indexOf('PIGGLES_CREATE_LABELS');
  if (from === -1 || to === -1 || to < from) {
    console.error('check:screen-names — vocabulary.ts no longer holds the two maps it had.');
    process.exit(1);
  }
  const out = new Map();
  for (const m of src.slice(from, to).matchAll(/'([a-z0-9.\-]+)':\s*'([^']+)'/g))
    out.set(m[1], m[2]);
  return out;
}

/** The shared catalog's name for a surface, and the file that draws it. */
function catalogEntries() {
  const byComponent = new Map();
  const entries = [];
  for (const file of readdirSync(CATALOG)) {
    if (!file.endsWith('.ts')) continue;
    const src = readFileSync(join(CATALOG, file), 'utf8');
    for (const m of src.matchAll(/import \{ (\w+) \} from '([^']+)'/g)) byComponent.set(m[1], m[2]);
    for (const m of src.matchAll(
      /key: '([a-z0-9.\-]+)',\s*\n\s*title: '([^']+)',[\s\S]*?component: (\w+),/g
    )) {
      const rel = byComponent.get(m[3]);
      if (!rel) continue;
      const resolved = resolve(CATALOG, `${rel}.tsx`);
      entries.push({
        key: m[1],
        sparx: m[2],
        file: existsSync(resolved) ? resolved : resolve(CATALOG, `${rel}.ts`),
      });
    }
  }
  return entries;
}

/**
 * Comments blanked IN PLACE, so every line keeps its number.
 *
 * The note explaining a rename quotes the old name on purpose — the sample-data
 * pane's header says "one screen with two names" and names both. Reading that as
 * copy makes the guard demand that its own explanation be rewritten into
 * nonsense. Same move as check-nav-vocabulary.mjs.
 */
function withoutComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/gm, (m, lead) => lead + ' '.repeat(m.length - lead.length));
}

/** Every quoted string and text node in a file, with its line. */
function copyStrings(raw) {
  const src = withoutComments(raw);
  const out = [];
  // Backticks too. Every sentence with a VALUE in it is a template literal, and
  // that is most of the ones that count things: "2 purchase orders still have no
  // date anybody can give" was invisible to a scan that only knew quotes.
  //
  // The JSX branch allows a NEWLINE inside the text node, and that is the whole
  // difference between reading 3,939 of them and reading 9,250. Prettier wraps
  // any label that does not fit beside its tag onto its own line:
  //
  //     <Button …>
  //       Retire this price list
  //     </Button>
  //
  // so the text begins with a newline, and a branch that stopped at one never
  // started. It read only the labels short enough to sit beside the tag, which
  // is the half least likely to name a screen. `<`, `>`, `{` and `}` still end
  // the node, so it is a text node and never a span of code.
  for (const m of src.matchAll(
    /'([^'\n]{8,400})'|"([^"\n]{8,400})"|`([^`]{8,400})`|>([^<>{}]{8,400})</g
  )) {
    // `${…}` inside a template literal is an EXPRESSION, not words a person
    // reads. `Where the number for ${movement.variantSku} stands now` was
    // reported as naming the Movements screen, because the identifier in the
    // hole is called `movement`. Blank the holes, keep the sentence.
    const text = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? '')
      .replace(/\$\{[^}]*\}/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!/[a-z] [a-z]/i.test(text)) continue;
    out.push({ text, line: src.slice(0, m.index).split('\n').length });
  }
  return out;
}

const piggles = pigglesTitles();
const entries = catalogEntries();

/** Every .tsx under surfaces/, because a screen can be named from anywhere. */
function surfaceFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) surfaceFiles(path, out);
    else if ((path.endsWith('.tsx') || path.endsWith('.ts')) && !path.endsWith('.test.ts'))
      out.push(path);
  }
  return out;
}

/** Punctuation and case removed, so "People & equipment" meets "People and equipment". */
function samePhrase(a, b) {
  const flat = (v) =>
    v
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  return flat(a) === flat(b);
}

/**
 * Whether the new name still CONTAINS the old one as a whole phrase.
 *
 * A rename that only adds words did not take the old phrase away, at either
 * end. "What matters" became "What matters most", and "Requests" became "Help
 * requests" — in both, the old word is part of the new name, so a sentence
 * saying "request" is saying this console's own word.
 *
 * This used to test the FRONT only, which was right for the first shape and
 * wrong for the second: it flagged "No open requests" on a pane called Help
 * requests, and "No duplicates found" on Possible duplicates.
 */
function containsPhrase(name, part) {
  const flat = (v) =>
    v
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  return ` ${flat(name)} `.includes(` ${flat(part)} `);
}

/** What each screen is called in Piggles TODAY: the override, else the shared name. */
const liveNames = new Set(entries.map((e) => piggles.get(e.key) ?? e.sparx));

/** The renamed screens, and the file that draws each one. */
const renamedList = [];
for (const entry of entries) {
  const mine = piggles.get(entry.key);
  if (mine === undefined) continue;
  // A ONE-WORD name is checked only inside its OWN surface file (see
  // `ownFileOnly` below). Platform-wide it would match ordinary prose all day:
  // "Site", "Media", "Reports", "Tasks" and "Inbox" are all real renames and
  // all real English. Inside the file that DRAWS that screen, the word is the
  // screen's name and nothing else.
  //
  // Skipping them outright was a hole bigger than the coverage: MEASURED
  // 2026-09-25, 56 renamed panes have a one-word sparx name and 51 have a
  // longer one, so the majority of the renames were invisible here. "Active
  // segments" sat on the pane called Groups of customers, "Search broadcasts"
  // on Email campaigns, "Loading payouts" on Money paid to you.
  if (samePhrase(mine, entry.sparx)) continue;
  // A phrase some OTHER screen is still called is a word this console uses.
  if ([...liveNames].some((live) => samePhrase(live, entry.sparx))) continue;
  // A rename that ADDED words did not take the old phrase away — it is the
  // start of the new name. "What matters" became "What matters most", so
  // "Describe what matters, not 'image of'" is this console's own words and
  // always was. Only a rename that REPLACES a phrase keeps one away.
  if (containsPhrase(mine, entry.sparx)) continue;
  renamedList.push({ key: entry.key, sparx: entry.sparx, mine, file: entry.file });
}

/** The name, and its singular. A toolbar's ARIA landmark read "Purchase order
 *  list controls" and a needle built from the plural walked straight past it. */
function needleFor(name) {
  const forms = [name];
  if (/s$/i.test(name) && !/ss$/i.test(name)) forms.push(name.slice(0, -1));
  return new RegExp(
    forms
      .map((f) => `\\b${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}\\b`)
      .join('|'),
    'i'
  );
}

const renamed = renamedList.map((r) => ({
  ...r,
  needle: needleFor(r.sparx),
  own: needleFor(r.mine),
  /** A one-word name is only a NAME inside the file that draws that screen. */
  ownFileOnly: r.sparx.trim().split(/\s+/).length < 2,
}));

let checked = 0;
const failures = [];

for (const path of surfaceFiles(SURFACES)) {
  const file = path.replace(/\\/g, '/');
  const where = file.split('/apps/workbench/')[1] ?? file;
  const src = readFileSync(path, 'utf8');
  for (const { text, line } of copyStrings(src)) {
    checked++;
    for (const r of renamed) {
      if (r.ownFileOnly && resolve(r.file) !== resolve(path)) continue;
      if (!r.needle.test(text)) continue;
      // The Piggles name can CONTAIN the sparx one — "What matters" became
      // "What matters most" — and then every correct sentence matches it too.
      if (r.own.test(text)) continue;
      if (OTHER_COMPANIES.some(([, w]) => new RegExp(`\\b${w}\\b`, 'i').test(text))) continue;
      if (
        NOT_OUR_WORD.some(
          ([f, w]) => where.replace(/\\/g, '/') === f && new RegExp(`\\b${w}\\b`, 'i').test(text)
        )
      )
        continue;
      failures.push({
        where: `${where}:${String(line)}`,
        sparx: r.sparx,
        mine: r.mine,
        text: text.length > 90 ? `${text.slice(0, 87)}…` : text,
      });
    }
  }
}

if (renamed.length === 0 || checked === 0) {
  console.error(
    'check:screen-names — resolved no renamed surfaces to a file. The catalog shape has changed.'
  );
  process.exit(1);
}

if (failures.length > 0) {
  console.error(
    `\n${String(failures.length)} sentence(s) call a screen by the name Piggles renamed away:\n`
  );
  for (const f of failures) {
    console.error(`  ${f.where}`);
    console.error(`      "${f.text}"`);
    console.error(`      this screen is "${f.mine}" in Piggles, not "${f.sparx}"`);
  }
  console.error('\nUse the name the tab uses. The header of this file says why.\n');
  process.exit(1);
}

console.log(
  `${String(renamed.length)} renamed screens, ${String(checked)} sentences across every surface, and every one calls a screen what its tab calls it.`
);
