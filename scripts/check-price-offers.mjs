// Fails when a second copy of "which workflows hold a price rather than a bill"
// appears anywhere in the tree.
//
// WHAT A BUSINESS OWNER MET (issue 764). She priced up a quote for a shop that
// had rung and asked what forty tees would cost, pressed Preview, and read the
// page the shop would receive:
//
//     Juniper Row Textiles LLC                              INVOICE
//                                                           Unpaid
//     ...
//                                          Balance due     $504.00
//
// A price she had not sent yet, printed as a bill for money nobody owed. A
// wholesale customer on net terms files that in accounts payable.
//
// WHY. A quote and an invoice are the same row on two different workflows, and
// four separate places had to know which was which: the print renderer, the
// unsaved-preview renderer, and each of the two consoles. Only the slug can
// tell them apart — the stage's customer label cannot, because on the quotes
// workflow it holds a STANDING ("Draft", "Quoted") and on the invoice workflow
// it holds a NAME ("Invoice", "Receipt"). Three of the four did not know, so
// each fell through to its invoice default, separately and silently.
//
// WHAT THIS CHECKS. The slugs of the two system price-offer workflows appear as
// a bare string literal in exactly ONE file, the one that defines them:
//
//     wizeworks/packages/crm-schemas/src/builtins/invoicing.ts
//
// Everything else must import `B2B_QUOTE_WORKFLOW_SLUG`,
// `CUSTOMER_ESTIMATE_WORKFLOW_SLUG`, `isPriceOfferWorkflow` or
// `billingDocumentNoun` from `@wizeworks/crm-schemas/builtins`, so the page a
// customer receives and the screen it was typed on cannot disagree about what
// the document is. A new literal fails here rather than shipping as a fifth
// opinion. [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// Tests and sample-data generators are exempt: a fixture naming the slug it is
// seeding is stating a fact about the fixture, not re-deciding the rule.
//
// Zero dependencies on purpose: CI runs it with bare Node, no install.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The one file allowed to spell them out. */
const HOME = 'wizeworks/packages/crm-schemas/src/builtins/invoicing.ts';

/** The literals nobody else may write. */
const SLUGS = ['b2b-quotes', 'customer-estimates'];

/** Where to look. Each must exist — a scan root that moved would make this
 *  check pass over nothing and print green. [[feedback_structural_checks_go_blind]] */
const ROOTS = ['wizeworks', 'piggles', 'sparx'];

const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', '.turbo', 'coverage']);
const CODE = /\.(ts|tsx|mjs|js)$/;

/** Files that may name a slug for a reason that is not a second opinion about
 *  the rule. Each entry says why. */
const EXEMPT = new Map([
  [
    'wizeworks/packages/db/src/sample-data/engine/sales.ts',
    'a sample-data generator naming the workflow it seeds into',
  ],
  [
    'wizeworks/packages/automation-actions/src/seeds/b2b.ts',
    'a seeded automation whose stored trigger condition is the literal slug — it is DATA in a row, not a decision in code',
  ],
]);

function die(lines) {
  console.error(lines.join('\n'));
  process.exit(1);
}

function walk(dir, out) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (CODE.test(entry)) out.push(full);
  }
}

const files = [];
for (const root of ROOTS) {
  const full = join(repoRoot, root);
  if (!existsSync(full)) {
    die([
      `✖ check:price-offers cannot find ${root}/.`,
      '   A scan root that no longer exists reports a clean pass over nothing.',
    ]);
  }
  walk(full, files);
}

if (!existsSync(join(repoRoot, HOME))) {
  die([
    `✖ check:price-offers cannot find ${HOME},`,
    '   which is the one file allowed to name these slugs. It moved or was renamed;',
    '   update this check rather than deleting it.',
  ]);
}

const offenders = [];
for (const file of files) {
  const rel = relative(repoRoot, file).split(sep).join('/');
  if (rel === HOME) continue;
  if (EXEMPT.has(rel)) continue;
  if (rel.includes('/test/') || /\.test\.(ts|tsx)$/.test(rel)) continue;
  if (rel === 'scripts/check-price-offers.mjs') continue;

  const source = readFileSync(file, 'utf8');
  for (const [i, line] of source.split('\n').entries()) {
    // A comment explaining the rule is fine; a literal the code READS is not.
    const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
    for (const slug of SLUGS) {
      if (code.includes(`'${slug}'`) || code.includes(`"${slug}"`)) {
        offenders.push(`   ${rel}:${String(i + 1)}  ${slug}`);
      }
    }
  }
}

if (offenders.length > 0) {
  die([
    `✖ ${String(offenders.length)} place(s) spell out a price-offer workflow slug:`,
    '',
    ...offenders,
    '',
    `   Only ${HOME} may.`,
    '   Import B2B_QUOTE_WORKFLOW_SLUG, CUSTOMER_ESTIMATE_WORKFLOW_SLUG,',
    '   isPriceOfferWorkflow or billingDocumentNoun from',
    "   '@wizeworks/crm-schemas/builtins' instead.",
    '',
    '   A quote and an invoice are the same row on two different workflows, and',
    '   every screen and renderer that tells them apart has to agree. When three',
    '   of them held their own copy of the answer and one of them was stale, a',
    '   quote printed as an unpaid invoice with a balance due on it (issue 764).',
    '',
    '   If this file genuinely is not re-deciding the rule (a fixture, a seeded',
    '   row), add it to EXEMPT in this check WITH the reason.',
  ]);
}

console.log(
  `✓ check:price-offers — ${String(files.length)} file(s) scanned, ` +
    `${String(SLUGS.length)} slug(s) owned by one file, ` +
    `${String(EXEMPT.size)} exemption(s) with a stated reason.`
);
