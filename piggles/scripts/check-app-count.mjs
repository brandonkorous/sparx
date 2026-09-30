#!/usr/bin/env node
// A SPELLED APP COUNT TYPED INTO A SENTENCE.
//
// The Piggles marketing site said "fifteen apps" in forty-two places and the
// registry held SIXTEEN. Both were written in the same commit, so the number was
// never right at any point in the product's life:
//
//     /apps          "Fifteen apps. One subscription. No upgrade buttons."
//                    …over a grid of sixteen tiles a visitor can count.
//     /pricing       "If it is one of the fifteen, it is in the price."
//     /terms         "One subscription gives you every one of the fifteen apps."
//
// The last of those is a TERM OF THE SUBSCRIPTION, undercounting what the
// customer is buying, in the document that says what they are buying.
//
// ── WHY A CHECK AND NOT JUST A FIX ──────────────────────────────────────────
//
// The count is a fact about the registry. A spelled number typed into a
// sentence is a COPY of that fact, and it goes stale the moment somebody adds
// an app — which is exactly what happened, silently, with every check green,
// because no guard in the repo reads a number and compares it to anything.
//
// `answer-receipt.tsx` had the same shape one level down: a private list of
// number words that stopped at 'fifteen', so the one row that can name every
// app at once fell off the end and printed the numeral `16` on a page whose own
// comment says a numeral there reads as a second figure.
//
// The fix in both cases is to DERIVE it (`APP_COUNT_WORD` in @piggles/config).
// This is the half that stops the next one being typed.
// [[feedback_never_present_absence_as_measurement]]
//
// ── WHAT COUNTS ─────────────────────────────────────────────────────────────
//
// A spelled number immediately before "app" or "apps", in a sentence, across
// the four trees that talk about the product: the marketing site, the account
// app, the console and the shared packages. Comments are stripped first,
// because a comment explaining why the old wording went is a note to us, not a
// sentence on a screen.
//
// It is NOT an error to spell a number that is right. "Six groups" is a
// different fact and is not checked. What fails is a spelled number that claims
// to be the TOTAL and is not: "all <word> apps", "the <word> apps", "of <word>
// apps", and "<word> apps" at the start of a sentence. Plus "the other <word>",
// which claims to be the total MINUS ONE and is compared against that.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PIGGLES = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SCAN_ROOTS = [
  join(PIGGLES, 'apps', 'web'),
  join(PIGGLES, 'apps', 'account'),
  join(PIGGLES, 'apps', 'workbench'),
  join(PIGGLES, 'packages'),
];

for (const root of SCAN_ROOTS) {
  if (!existsSync(root)) {
    console.error(`check:app-count — scan root is missing: ${root}`);
    console.error('Point this at its new home; carrying on would scan nothing.');
    process.exit(1);
  }
}

// The registry, read as TEXT rather than imported, so this stays a pure-Node
// check with no build step — the same reason every other guard here does.
const REGISTRY = join(PIGGLES, 'packages', 'config', 'src', 'apps.ts');
if (!existsSync(REGISTRY)) {
  console.error(`check:app-count — the app registry is missing: ${REGISTRY}`);
  process.exit(1);
}
const APP_COUNT = (readFileSync(REGISTRY, 'utf8').match(/^ {4}id: '[a-z_-]+',$/gm) ?? []).length;

// The denominator, asserted. A registry that parsed to nothing would let every
// sentence through and print green.
if (APP_COUNT < 2) {
  console.error(`check:app-count — read ${String(APP_COUNT)} app(s) out of the registry.`);
  console.error('The id pattern no longer matches. Fix that before trusting this.');
  process.exit(1);
}

const WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
];
const RIGHT = WORDS[APP_COUNT] ?? String(APP_COUNT);
const NUMBER = WORDS.join('|');

/**
 * The shapes that claim to be the TOTAL.
 *
 * THE NUMBER HAS TO TOUCH THE WORD "app". The first draft of this accepted
 * "all <word>" on its own, to catch "All fifteen, from the first day" \u2014 and it
 * flagged "Give all three measurements", "one of the two answers" and nine
 * other sentences that have nothing to do with apps. A guard that cries about
 * a stock count is a guard somebody switches off.
 *
 * So it is deliberately NARROW. Four phrasings in the old copy escape it
 * ("all fifteen, from the first day", "one of the fifteen", "See the fifteen",
 * "See the fifteen apps" is caught but "See the fifteen" is not). Those are
 * derived now, and a check that never fires wrongly is worth more than one that
 * catches every phrasing and is ignored. [[feedback_a_test_that_cannot_go_red]]
 */
const CLAIMS = [
  new RegExp(String.raw`\b(?:all|the|of) (${NUMBER}) apps?\b`, 'gi'),
  new RegExp(String.raw`(?:^|[.!?"'\u2018\u201c>{\`] *)(${NUMBER}) apps\b`, 'gi'),
];

/**
 * "the other fourteen" \u2014 the count MINUS the one being talked about.
 *
 * `/apps/[app]` closed twice with this, and it was wrong by two: hand-derived
 * from a total that was itself hand-typed and wrong. A second hand-derived
 * number in the same sentence is a second chance to go stale, so it gets its
 * own comparison against `APP_COUNT - 1` rather than being folded into the
 * shapes above, where it would have been checked against the wrong figure.
 *
 * "one" and "two" are DROPPED from this shape. "the other one" and "the other
 * two" are ordinary English about ordinary things — a test says "fills an empty
 * box even when the other one was typed over" — and flagging those would make
 * this a check about grammar rather than about the app count.
 */
const OTHERS = new RegExp(
  String.raw`\bthe other (${NUMBER.replace(/^zero\|one\|two\|/, '')})\b`,
  'gi'
);
const RIGHT_OTHERS = WORDS[Math.max(APP_COUNT - 1, 0)] ?? String(APP_COUNT - 1);

/**
 * Sentences that count a SUBSET on purpose, and are right.
 *
 * EMPTY, and that is the finding. The one candidate was The Day's closing beat,
 * "Eight apps before six o'clock" — a count of the apps THE STORY touched, not
 * of how many exist, so it looked like a legitimate exemption.
 *
 * It was not. The sentence beside it said "The other seven", and eight plus
 * seven is fifteen. A subset count and a remainder count, both typed by hand,
 * both adding up to a total the product has never had. Both are counted from
 * `BEATS` now.
 *
 * That is the lesson worth keeping: the first thing this check wanted to
 * forgive was the thing most worth reading. An exemption is a claim that a
 * number is right for a reason the check cannot see, and it needs checking by
 * hand before it is written down. [[feedback_check_the_gate_before_accepting_it]]
 */
const SUBSET = [];

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
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((line) => (line.trim().startsWith('//') || line.trim().startsWith('*') ? '' : line))
    .join('\n');
}

const found = [];
let scanned = 0;
let claims = 0;
let derived = 0;
for (const root of SCAN_ROOTS) {
  for (const file of walk(root)) {
    scanned += 1;
    const source = stripComments(readFileSync(file, 'utf8'));
    derived += (source.match(/\bAPP_COUNT_WORD(?:_CAP)?\b/g) ?? []).length;
    const lines = source.split('\n');
    lines.forEach((line, i) => {
      OTHERS.lastIndex = 0;
      let o;
      while ((o = OTHERS.exec(line)) !== null) {
        claims += 1;
        if (o[1].toLowerCase() === RIGHT_OTHERS) continue;
        found.push({
          file: relative(PIGGLES, file).split('\\').join('/'),
          line: i + 1,
          said: o[1],
          right: RIGHT_OTHERS,
          text: line.trim().slice(0, 130),
        });
      }
      for (const re of CLAIMS) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(line)) !== null) {
          claims += 1;
          if (m[1].toLowerCase() === RIGHT) continue;
          if (SUBSET.some((s) => line.includes(s))) continue;
          found.push({
            file: relative(PIGGLES, file).split('\\').join('/'),
            line: i + 1,
            said: m[1],
            right: RIGHT,
            text: line.trim().slice(0, 130),
          });
        }
      }
    });
  }
}

// THE DENOMINATOR THAT MATTERS IS THE DERIVED ONE.
//
// Once the sweep is done there is nothing left for this check to compare, and
// "0 sentences, all correct" is the same green line a broken scan prints. What
// proves it is still doing its job is that the sentences moved to the CONSTANT
// and stayed there — so if the derived uses vanish, somebody has typed the
// number back in a shape this file does not recognise, and that is a failure.
// [[feedback_structural_checks_go_blind]]
if (scanned === 0 || derived < 20) {
  console.error(
    `check:app-count — read ${String(scanned)} file(s) and found ${String(derived)} use(s) ` +
      `of APP_COUNT_WORD.`
  );
  console.error('The sentences that name the app count have stopped deriving it.');
  console.error('Either the scan is pointed at the wrong tree, or the count was typed back in.');
  process.exit(1);
}

if (found.length > 0) {
  console.error(
    `\n${String(found.length)} sentence(s) count the apps by hand, and there are ${String(APP_COUNT)}.\n\n` +
      `Import the count instead of typing it:\n` +
      `  import { APP_COUNT_WORD, APP_COUNT_WORD_CAP } from '@piggles/config';\n\n` +
      `A number typed into a sentence is a copy of a fact that lives in the\n` +
      `registry, and it goes stale the first time somebody adds an app.\n`
  );
  for (const f of found) {
    console.error(`  said "${f.said}", should be "${f.right}"  ${f.file}:${String(f.line)}`);
    console.error(`      ${f.text}`);
  }
  console.error('');
  process.exit(1);
}

console.log(
  `check:app-count — ${String(APP_COUNT)} apps in the registry. ` +
    `${String(derived)} sentence(s) take the count from it, ` +
    `${String(claims)} spell it out, and all of them agree. ` +
    `${String(scanned)} file(s) read.`
);
