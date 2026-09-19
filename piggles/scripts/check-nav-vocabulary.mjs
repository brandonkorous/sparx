// Comb the Piggles UI for sparx's vocabulary.
//
// ── WHY THIS IS A CHECK AND NOT A ONE-OFF GREP ──────────────────────────────
//
// Piggles' surfaces are a FORK of sparx's, so every new screen arrives wearing
// sparx's words by default and keeps them until somebody notices. "Modules" sat
// in the rail on a product with no module pricing. Both leaks were caught by
// looking, which does not scale and does not survive the next screen anybody
// adds.
//
// ── IT CHECKS WHAT RENDERS, NOT WHAT IS TYPED ───────────────────────────────
//
// A raw catalog title is not what a person reads: `lib/console/vocabulary.ts`
// overrides it, and a surface in `hiddenSurfaces` is never rendered at all. A
// checker that reads the source alone reports leaks that were fixed long ago and
// misses the ones that are live, so this resolves every string the way the app
// does before testing it.
//
// ── FIVE SEAMS, ALL FAILING THE SAME WAY ────────────────────────────────────
//
//   1. NAV — surface titles and section headings, overridden in vocabulary.ts.
//   2. IN-SCREEN COPY — `productCopy('key', 'sparx's wording')`, overridden in
//      copy.ts. The fallback IS sparx's sentence, so a new call with no override
//      renders sparx's words with nothing marking it wrong.
//   3. PLAIN CATALOGS — a data file whose object literals are rendered straight to
//      the screen. Neither seam above can see one: no surface title to override, no
//      productCopy call to intercept. The onboarding switchboard is the whole of the
//      first screen a new business meets, and it sat outside this check while it
//      reported green, carrying CMS, CRM, headless, API, MCP and thirteen other
//      companies named outright (issue 362).
//   4. THE TAB A SURFACE NAMES ITSELF — `ctx.setTitle('…')`. Seam 1 already calls
//      a surface's title a `pane tab`, and it was reading the name the tab was
//      SUPPOSED to have. A surface can write its own, and that string never meets
//      vocabulary.ts: a settings tab read "How the CRM behaves" — a banned word,
//      on screen — while this check resolved the same surface to "How this app
//      behaves" and passed it.
//   5. ORDINARY SCREEN COPY — a sentence typed straight into JSX. The four seams
//      above all read a string that passes through SOMETHING: a catalog entry, a
//      copy key, a title slot. A sentence in a text node passes through nothing,
//      and nothing was reading it. Thirty were live when this was added, and one
//      of them was on the very surface seam 4 was written for: seam 4 took the
//      `setTitle('How the CRM behaves')` out, and the leave-guard five lines
//      below it went on asking whether to discard "your changes to how the CRM
//      behaves" (issue 466). Fixing a leak and leaving its neighbour is the
//      shape this whole file exists to stop.
//
// ── AND IT BANS OTHER COMPANIES' NAMES ──────────────────────────────────────
//
// Root CLAUDE.md: shipped artifacts describe patterns in our own words rather than
// naming competitors. The switchboard's `replaces` line existed to name them, one
// per app, on a first-run screen. Checked only in the catalogs, where the strings
// are known to be prose — a surface title will never say "Shopify".

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKBENCH = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'workbench');
const read = (p) => readFileSync(join(WORKBENCH, p), 'utf8');

// Some of what a Piggles screen renders is not IN the Piggles console. The
// ready-made compatibility lists are a shared package, and every one of the
// fourteen described itself to a shop owner as "<Something> fitment: A -> B,
// narrowable by C" on a screen this console titles "What fits what" — five uses
// of the banned word on one pane, with this guard reporting clean, because it
// only ever read files under `apps/workbench`.
const PIGGLES = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readRepo = (p) => readFileSync(join(REPO, p), 'utf8');

/**
 * BANNED_IN_PRODUCT_COPY, READ FROM @piggles/config, plus the brand name itself —
 * the one word that is not jargon but is still the wrong product.
 *
 * It used to be a hand-typed copy of that list under a comment claiming it came
 * from there. It did not, and the two drifted: `fitment` was added to the
 * lexicon — the file a copy reviewer greps — and this checker went on passing,
 * because its own twelve words had never heard of it. A list that says where it
 * comes from and does not go there is worse than one that admits it is local.
 *
 * Parsed rather than imported because this is a plain .mjs script with no build
 * step, and it throws rather than falling back: a vocabulary guard running on an
 * empty word list reports every screen clean.
 */
const LEXICON = 'packages/config/src/lexicon.ts';
const BANNED = (() => {
  let src;
  try {
    src = readFileSync(join(PIGGLES, LEXICON), 'utf8');
  } catch {
    // A stack trace is loud but says nothing. Name the file and what happens
    // without it, the way the moved-declaration throw below does.
    throw new Error(
      `check:nav-vocabulary — cannot read ${LEXICON}. That file is the banned-word ` +
        `list this guard checks every screen against; without it there is nothing ` +
        `to check and every screen reports clean. Fix the path, do not delete it.`
    );
  }
  const from = src.search(/export const BANNED_IN_PRODUCT_COPY = \[/);
  if (from < 0) {
    throw new Error(
      `check:nav-vocabulary — BANNED_IN_PRODUCT_COPY is not in ${LEXICON}. It has ` +
        `moved or been renamed; point this at its new home. Carrying on would check ` +
        `every screen against an empty word list and report them all clean.`
    );
  }
  // COMMENTS STRIPPED FIRST. The entry explaining why a word is banned quotes
  // that word, so a naive scan reads it twice and reports every hit twice —
  // which is how this line came to be written.
  const body = src.slice(from, src.indexOf('\n] as const;', from)).replace(/^\s*\/\/.*$/gm, '');
  const words = [...body.matchAll(/'((?:[^'\\]|\\.)+)'/g)].map((m) => m[1]);
  if (words.length < 10) {
    throw new Error(
      `check:nav-vocabulary — only ${String(words.length)} banned words parsed out of ` +
        `${LEXICON}. That is below the floor; the shape of the list has changed.`
    );
  }
  // Not in the lexicon because it is not jargon — it is the other product's name.
  return [...words, 'sparx'];
})();

/** Other companies, banned in the catalogs (root CLAUDE.md). Not the whole market:
 *  the ones this fork actually arrived carrying, plus the obvious neighbours, so a
 *  copy pass that reinstates one is caught rather than merely discouraged. */
const COMPETITORS = [
  'Shopify',
  'Webflow',
  'Squarespace',
  'Wix',
  'BigCommerce',
  'WooCommerce',
  'Storyblok',
  'Contentful',
  'Sanity',
  'HubSpot',
  'Salesforce',
  'Klaviyo',
  'Mailchimp',
  'Zapier',
  'Calendly',
  'Acuity',
  'Spocket',
  'FreshBooks',
  'QuickBooks',
  'Xero',
  'inFlow',
  'Katana',
  'Intercom',
  'Zendesk',
];

/**
 * `'key': 'Name',` pairs out of a Record literal.
 *
 * THROWS when the named export is not in the file it was told to read, rather
 * than returning an empty Map. Silence there does not read as "no renames" — it
 * reads as "every section still wears sparx's name", so the check reports
 * failures for renames that were made correctly and are sitting one file away.
 * That is exactly what happened when PIGGLES_SECTIONS moved to its own module:
 * `'What sparx does' → 'How Piggles is set up'` was already written, and this
 * still failed CI naming the surfaces it had renamed.
 */
function pairs(src, file, start) {
  // Anchored on the DECLARATION, not on the bare name: a plain indexOf matches
  // any identifier the name is a prefix of, so renaming PIGGLES_SECTIONS to
  // PIGGLES_SECTIONS_V2 would sail straight past a guard looking for the short
  // form — which is how the first version of this guard passed its own test.
  const from = src.search(new RegExp(`const\\s+${start}\\b`));
  if (from < 0) {
    throw new Error(
      `check:nav-vocabulary — ${start} is not in ${file}. It has moved or been ` +
        `renamed; point this at its new home. Carrying on would compare every name ` +
        `against nothing and call correct renames leaks.`
    );
  }
  const body = src.slice(from, src.indexOf('\n};', from));
  return new Map(
    [...body.matchAll(/^\s*'?([\w.&' -]+?)'?:\s*'((?:[^'\\]|\\.)*)',/gm)].map((m) => [m[1], m[2]])
  );
}

const VOCAB_FILE = 'lib/console/vocabulary.ts';
// Section headings live in their own module — vocabulary.ts is the ~220 SURFACE
// names, which is long enough on its own.
const SECTION_FILE = 'lib/console/section-names.ts';
const surfaceNames = pairs(read(VOCAB_FILE), VOCAB_FILE, 'PIGGLES_SURFACES');
const sectionNames = pairs(read(SECTION_FILE), SECTION_FILE, 'PIGGLES_SECTIONS');
const hidden = new Set(
  [...read('lib/console/product.tsx').matchAll(/^ {2}'([\w.*-]+)',$/gm)].map((m) => m[1])
);

/** `hiddenSurfaces` takes a trailing wildcard (`partner.*` hides the whole
 *  reseller programme), so membership is not a plain `Set.has`. */
function isHidden(key) {
  if (hidden.has(key)) return true;
  for (const entry of hidden) {
    if (entry.endsWith('.*') && key.startsWith(entry.slice(0, -1))) return true;
  }
  return false;
}

// Every surface the catalog registers, with the title and section it renders.
const rendered = [];
/** Files that ONLY back surfaces Piggles hides, so seam 5 can skip them: their
 *  words are sparx's on purpose, and there is no Piggles screen to rename them
 *  into. Built from the catalog's own imports rather than a hand-kept list,
 *  which would go stale the first time a file moved. */
const hiddenFiles = new Set();
const shownFiles = new Set();
const dir = 'lib/surfaces/catalog';
for (const file of readdirSync(join(WORKBENCH, dir)).filter((n) => n.endsWith('.ts'))) {
  const src = read(`${dir}/${file}`);
  const componentFile = new Map();
  for (const m of src.matchAll(
    /import\s*\{\s*([A-Za-z0-9_]+)\s*\}\s*from\s*'\.\.\/\.\.\/\.\.\/([^']+)'/g
  )) {
    componentFile.set(m[1], m[2]);
  }
  // Split on the object boundary so a key is paired with its own title/section.
  for (const block of src.split(/\n {2}\{\n/).slice(1)) {
    const key = /^\s*key:\s*'([^']+)'/m.exec(block)?.[1];
    if (!key) continue;
    const component = /^\s*component:\s*([A-Za-z0-9_]+),/m.exec(block)?.[1];
    const rel = component ? componentFile.get(component) : undefined;
    if (rel !== undefined) {
      const path = /\.tsx?$/.test(rel) ? rel : `${rel}.tsx`;
      (isHidden(key) ? hiddenFiles : shownFiles).add(path);
    }
    if (isHidden(key)) continue;
    const title = surfaceNames.get(key) ?? /^\s*title:\s*'([^']+)'/m.exec(block)?.[1];
    const rawSection = /^\s*section:\s*'([^']+)'/m.exec(block)?.[1];
    const listed = !/^\s*listed:\s*false/m.test(block);
    if (title)
      rendered.push({ key, file, listed, kind: listed ? 'nav row' : 'pane tab', text: title });
    if (rawSection) {
      rendered.push({
        key,
        file,
        listed,
        kind: 'section',
        text: sectionNames.get(rawSection) ?? rawSection,
      });
    }
  }
}

// ── Seam 2: productCopy('key', 'sparx's wording') ──────────────────────────
//
// The fallback is what renders when copy.ts has no Piggles override for the key,
// so a fallback carrying sparx's vocabulary is a live leak the moment somebody
// adds the call without the override.
// KEYS only, and matched line-by-line: a copy entry routinely wraps its sentence
// onto the next line, and a key/value parser that needs both on one line reports
// the wrapped ones as missing — a checker that cries wolf gets switched off.
const overrides = new Set(
  [...read('lib/console/copy.ts').matchAll(/^\s*'([\w.-]+)':/gm)].map((m) => m[1])
);
const CALL =
  /productCopy(?:With)?\(\s*'([\w.-]+)'\s*,\s*(?:'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`)/g;

// ── Seam 4: ctx.setTitle('…'), the tab a surface names itself ──────────────
//
// A pane's tab has two possible authors and only ONE of them passes through
// vocabulary.ts. The catalog title does. `ctx.setTitle` does not — it is the
// operator's rename slot, so whatever a surface hands it lands on the tab
// verbatim and outranks every rename above.
//
// Fifty-two surfaces handed it their own catalog name. Four Social tabs read
// "Inbox", "Approvals", "Cadence" and "Connections" while the rail, the launcher
// and the command palette called the same four screens "Comments and replies",
// "Posts waiting on you", "How often you post" and "Your social accounts" — and
// a settings tab read "How the CRM behaves", the banned word, on screen, while
// THIS CHECK resolved that same surface to "How this app behaves" and passed it.
// The seam above already labels a surface `pane tab`; it was reading the name the
// tab was supposed to have rather than the one it had.
//
// The controller now discards a title equal to the surface's own, so restating a
// name can no longer reach a tab. A DIFFERENT constant still can, unread by
// vocabulary.ts, and that is what this scans for. A non-literal argument names a
// RECORD — the business's own words, never ours — and is skipped.
const SET_TITLE = /ctx\.setTitle\(\s*'((?:[^'\\]|\\.)*)'\s*\)/g;

// ── Seam 5: ORDINARY SCREEN COPY ───────────────────────────────────────────
//
// The four seams above all read a string that passes through something — a
// catalog entry, a copy key, a title slot. A sentence typed straight into JSX
// passes through nothing at all, and nothing was reading it.
//
// So a shop owner with seven sites pressed "Add a site" and was told "Adding
// another site needs the Builder module"; the command palette she opens twenty
// times a day said "Type to search across every module"; and the leave-guard on
// a settings pane asked whether to discard "your changes to how the CRM
// behaves" — the same banned word, on the same surface, that seam 4 was written
// for (persona issue 466). Every one of them passed this check.
//
// WHAT COUNTS AS COPY. A JSX text node, or a prop/field whose value a person
// reads. NOT: class lists, copy keys, or a `productCopy` fallback (seam 2 owns
// those, and double-reporting one is how a check gets ignored). The narrowness
// is the point — a checker that flags `className="bg-module"` is a checker
// somebody switches off.
const TEXT_PROPS =
  'title|label|description|placeholder|heading|subtitle|caption|hint|helper|message|' +
  'confirmLabel|cancelLabel|emptyLabel|actionLabel|createLabel|tooltip|summary|note|prompt|body';
const JSX_TEXT = />\s*([A-Z][^<>{}\n]{6,160}?)\s*</g;
// A whole SENTENCE in a string literal. The command palette's placeholder lives
// in a ternary inside a JSX expression — `{searching ? '…' : 'Type to search
// across every module — or pick a screen to open.'}` — which is neither a text
// node nor a prop, and is read by everyone who presses ⌘K. Sentence-shaped is
// the test that catches it without dragging in keys and class lists: four words
// or more, opening on a capital.
const SENTENCE = /'([A-Z][^'\\\n]*?(?: [^'\\\n ]+){3,})'|"([A-Z][^"\\\n]*?(?: [^"\\\n ]+){3,})"/g;
const TEXT_PROP = new RegExp(
  String.raw`\b(?:${TEXT_PROPS})\s*[=:]\s*(?:\{\s*)?(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)")`,
  'g'
);
const UTILITY_CLASS =
  /(^| )(text|bg|border|hover|focus|focus-visible|ring|fill|stroke|decoration|outline|divide|placeholder|accent|shadow|group-hover|data-\[|flex|grid|size-|w-|h-|p[xytblr]?-|m[xytblr]?-|gap-|rounded)[-:\d]/;
const COPY_KEY = /^[a-z0-9]+([.-][a-z0-9]+)+$/i;
const seenCopy = new Set();

/**
 * Blocks Piggles does not render, so their words are sparx's on purpose.
 *
 * `hiddenSurfaces` takes whole screens out; `hiddenFeatures` takes a BLOCK out of
 * a screen that otherwise ships, and a block is not something a file scan can
 * see. These two are the marketplace card and the sparx Pay form, both wrapped in
 * `productHidesFeature(...)` at their call site.
 *
 * The exemption is keyed on the FEATURE, not the file, and the key is checked
 * against the real `hiddenFeatures` set below — so the day either block becomes
 * visible in Piggles, this stops exempting it rather than quietly going on.
 */
const HIDDEN_FEATURE_COPY = [
  { file: 'surfaces/commerce/product-channels.tsx', feature: 'commerce.channels.market' },
  { file: 'surfaces/commerce/payment-provider-detail.tsx', feature: 'commerce.payments.sparx_pay' },
];

/**
 * Words a person MUST meet, because somebody else's screen says them.
 *
 * piggles/CLAUDE.md bans jargon and the audience note allows the one exception:
 * a term that is unavoidable gets DEFINED INLINE. These are the three that are.
 * A key is called an API key on the page you copy it from; a signing secret is
 * called that in the gateway's own dashboard; and the automation that calls an
 * outside address defines the word in the same sentence it uses it. Renaming any
 * of them would leave somebody hunting a settings page for a word we invented.
 *
 * Exact strings, so a NEW sentence carrying the same word is still caught.
 */
const DEFINED_INLINE = new Set([
  'Create an API key',
  'new API key',
  'API keys',
  'POST the details to an outside web address (a webhook).',
  'Webhook signing secret',
  'webhook address',
]);

/** Byte ranges of every productCopy fallback — seam 2's, not this one's. */
function copyFallbackRanges(src) {
  const ranges = [];
  for (const m of src.matchAll(/productCopy(?:With)?\(\s*'[\w.-]+'\s*,\s*/g)) {
    const start = m.index + m[0].length;
    const quote = src[start];
    if (quote !== "'" && quote !== '"' && quote !== '`') continue;
    let i = start + 1;
    while (i < src.length && src[i] !== quote) i += src[i] === '\\' ? 2 : 1;
    ranges.push([start, i + 1]);
  }
  return ranges;
}

/** Comments blanked IN PLACE, so a rationale note explaining a banned word is
 *  not itself reported, and every offset stays true. */
function withoutComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (c, p) => p + ' '.repeat(c.length - p.length));
}

function walk(rel) {
  for (const entry of readdirSync(join(WORKBENCH, rel), { withFileTypes: true })) {
    const next = `${rel}/${entry.name}`;
    if (entry.isDirectory()) walk(next);
    // A TEST IS NOT A SCREEN. A test that pins how a word is translated has to
    // quote the untranslated one to do it, and reporting that as screen copy
    // would make the honest fixture the thing that fails the build — which
    // teaches people to write a fixture that is not what the server sends.
    // `check-plain-words` has excluded tests since it was written; this did not.
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      const src = read(next);
      for (const m of src.matchAll(CALL)) {
        const [, key, single, tpl] = m;
        if (overrides.has(key)) continue;
        rendered.push({ key, file: next, listed: true, kind: 'copy', text: single ?? tpl ?? '' });
      }
      for (const m of src.matchAll(SET_TITLE)) {
        rendered.push({
          key: 'ctx.setTitle',
          file: next,
          listed: false,
          kind: 'pane tab',
          text: m[1],
        });
      }

      // Seam 5. Skipped for a surface Piggles never renders — its words are
      // sparx's on purpose and renaming them would be renaming a screen that
      // does not exist here.
      if (hiddenFiles.has(next) || hiddenFeatureFiles.has(next)) continue;
      const code = withoutComments(src);
      const skip = copyFallbackRanges(code);
      const candidates = [];
      for (const m of code.matchAll(JSX_TEXT)) candidates.push([m.index, m[1]]);
      for (const m of code.matchAll(TEXT_PROP)) candidates.push([m.index, m[1] ?? m[2]]);
      for (const m of code.matchAll(SENTENCE)) candidates.push([m.index, m[1] ?? m[2]]);
      for (const [index, text] of candidates) {
        if (!text || !/ /.test(text) || text.includes('/')) continue;
        if (COPY_KEY.test(text) || UTILITY_CLASS.test(text)) continue;
        if (DEFINED_INLINE.has(text)) continue;
        if (skip.some(([a, b]) => index >= a && index < b)) continue;
        // One sentence can match two patterns above (a `title=` prop is also
        // sentence-shaped). Reporting it twice makes the output look longer than
        // the problem is, which is its own way of getting a check ignored.
        // The separator is written as an ESCAPE, never as a literal NUL byte. A raw
        // null byte in the source makes this a BINARY file to grep and ripgrep, so
        // every repo-wide text search silently skips the vocabulary guard - including
        // a search for the rule you are looking for right now.
        const seenKey = `${next}\u0000${text}`;
        if (seenCopy.has(seenKey)) continue;
        seenCopy.add(seenKey);
        rendered.push({ key: 'screen copy', file: next, listed: true, kind: 'copy', text });
      }
    }
  }
}
// A file backing a hidden surface AND a shown one is not hidden. Reconciled
// rather than assumed, because skipping a file that renders is exactly the
// blindness this seam was added to remove.
for (const path of shownFiles) hiddenFiles.delete(path);

// The block-level exemptions, each verified against the REAL hidden-feature set
// so one cannot outlive the thing it describes.
const hiddenFeatures = new Set(
  [
    ...(
      /const hiddenFeatures = new Set\(\[([\s\S]*?)\]\)/.exec(
        read('lib/console/product.tsx')
      )?.[1] ?? ''
    ).matchAll(/'([\w.-]+)'/g),
  ].map((m) => m[1])
);
const hiddenFeatureFiles = new Set();
for (const { file, feature } of HIDDEN_FEATURE_COPY) {
  if (!hiddenFeatures.has(feature)) {
    throw new Error(
      `check:nav-vocabulary — ${file} is exempted because '${feature}' is a hidden ` +
        `feature, and it is not in hiddenFeatures any more. That block now RENDERS in ` +
        `Piggles wearing sparx's words. Remove the exemption and rewrite the copy.`
    );
  }
  hiddenFeatureFiles.add(file);
}
for (const root of ['surfaces', 'components']) walk(root);

// ── Seam 3: plain catalogs rendered straight to the screen ─────────────────
//
// Scanned by NAMED FIELD rather than "every string in the file": these files also
// hold keys, class names and comments, and a checker that flags `key: 'cms'` is a
// checker somebody switches off. Each entry names the declaration it lives in, so
// this fails loudly when one is renamed rather than silently scanning nothing —
// the same rule `pairs()` follows above, and the reason it throws.
const CATALOGS = [
  {
    file: 'lib/onboarding/modules.ts',
    anchor: 'SWITCHBOARD_MODULES',
    fields: ['name', 'desc', 'long', 'replaces'],
    lists: ['feats'],
  },
  {
    file: 'surfaces/onboarding/wizard/wizard-steps.ts',
    anchor: 'STEP_LABEL',
    fields: ['modules', 'template', 'workspace', 'domain', 'payments', 'launch'],
    lists: [],
  },
  {
    file: 'surfaces/onboarding/wizard/wizard-steps.ts',
    anchor: 'HEAD',
    fields: ['title', 'supporting'],
    lists: [],
  },
  {
    // Outside the console — see `readRepo` above. The anchor proves the array is
    // still there; the strings are read from the whole file, because each
    // dictionary is its own `const` above it and only the array knows their
    // names.
    //
    // `indent: 2` is load-bearing. These files are mostly TREES of real-world
    // names — every make, model and engine carries a `name`, three and five
    // levels deep — and scanning those would flag "Ford" as a foreign brand and
    // get the whole check switched off. Two spaces is the dictionary's own
    // fields and nothing below them.
    repo: true,
    file: 'wizeworks/packages/commerce-schemas/src/fitment-dictionaries.ts',
    anchor: 'FITMENT_DICTIONARIES',
    indent: 2,
    fields: ['name', 'description'],
    lists: [],
  },
];

/** The whole declaration body, or a throw naming what moved. */
function declaration(src, file, anchor) {
  const from = src.search(new RegExp(`const\\s+${anchor}\\b`));
  if (from < 0) {
    throw new Error(
      `check:nav-vocabulary — ${anchor} is not in ${file}. It has moved or been ` +
        `renamed; point this at its new home. Carrying on would scan nothing and ` +
        `report the screen clean.`
    );
  }
  const end = src.indexOf('\n];', from);
  return src.slice(from, end < 0 ? src.length : end);
}

const catalogStrings = [];
for (const { file, anchor, fields, lists, repo, indent } of CATALOGS) {
  const src = repo ? readRepo(file) : read(file);
  // `indent` scans the WHOLE file at one depth; without it, the declaration.
  const body = indent ? (declaration(src, file, anchor), src) : declaration(src, file, anchor);
  const depth = indent ? String.raw`^ {${String(indent)}}` : String.raw`^\s*`;
  for (const field of fields) {
    for (const m of body.matchAll(
      new RegExp(depth + String.raw`${field}:\s*'((?:[^'\\]|\\.)*)'`, 'gm')
    )) {
      catalogStrings.push({ key: `${anchor}.${field}`, file, kind: 'catalog', text: m[1] });
    }
  }
  for (const list of lists) {
    for (const block of body.matchAll(new RegExp(String.raw`${list}:\s*\[([^\]]*)\]`, 'g'))) {
      for (const m of block[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)) {
        catalogStrings.push({ key: `${anchor}.${list}`, file, kind: 'catalog', text: m[1] });
      }
    }
  }
}
rendered.push(...catalogStrings.map((s) => ({ ...s, listed: true })));

const hits = [];
for (const item of rendered) {
  for (const word of BANNED) {
    if (new RegExp(String.raw`\b${word}(s|es|'s)?\b`, 'i').test(item.text))
      hits.push({ ...item, word });
  }
  // Another company's name is only checked where the string is known to be prose.
  if (item.kind !== 'catalog') continue;
  for (const brand of COMPETITORS) {
    if (new RegExp(String.raw`\b${brand}\b`, 'i').test(item.text))
      hits.push({ ...item, word: brand });
  }
}

const label =
  `${rendered.length} rendered strings (${catalogStrings.length} from catalogs) · ` +
  `${hidden.size} surfaces hidden from Piggles`;
if (hits.length === 0) {
  console.log(`✓ Piggles nav vocabulary clean (${label})`);
  process.exit(0);
}

console.error(`✗ sparx vocabulary in the Piggles nav (${label})\n`);
for (const h of hits) {
  console.error(`  [${h.word}] ${h.kind.padEnd(8)} "${h.text}"  ${h.key}  (${h.file})`);
}
console.error(
  '\nName it in lib/console/vocabulary.ts, or hide the surface in lib/console/product.tsx.'
);
process.exit(1);
