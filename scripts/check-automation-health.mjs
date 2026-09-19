// Fails when a screen badges an automation with the stored status word and
// nothing else, so a rule that has never once worked wears a green "On".
//
// The stored word is `active | paused | draft | error`. Nothing on the platform
// writes `error` — issue 540 counted 2,411 automations and found zero — and the
// engine's own comment says why: "A single failed run does NOT flip the
// automation's own status to `error`; that pause-on-repeated-failure policy is a
// later (UI) slice." It never landed. So `automationState('active')` answers
// "On", in success green, for a rule whose every run has failed.
//
// `automationHealth(status, runCount, errorCount)` reads the two counters that
// are already on the row and already fetched, and returns "Some failures" or
// "Not working" when they disagree with the word.
//
// This check exists because fixing it ONCE was not enough. 540 fixed the list
// and the read-only view of a managed rule. It then went on shipping on:
//
//   the EDITOR          the screen an owner reaches by clicking her own rule
//   the RECIPE CARD     "Chase an invoice a week overdue", green On, 8 of its
//                       last 8 runs failed, 8 late invoices unchased
//   the REPORT ROW      a green "On" badge beside its own amber "50% ok"
//
// Five screens draw this one fact. [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// Zero dependencies on purpose: CI runs it with bare Node, no install.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Both consoles. A tree added outside this list is invisible here, which is why
 *  the file count is printed rather than a bare tick.
 *  [[feedback_structural_checks_go_blind]] */
const ROOTS = ['sparx/apps/workbench/surfaces/automations', 'piggles/apps/workbench/surfaces/automations'];

/**
 * Screens that name the SWITCH rather than the health, with the reason.
 *
 * Add to this only when the badge genuinely answers "is it switched on", and
 * something else on the same screen answers "is it working". A name here with no
 * reason beside it is how this check stops meaning anything.
 */
const SWITCH_ONLY = {
  'flow-canvas.tsx':
    'the rule node reads "On · loop-guard depth 3", which is the switch; the ' +
    'editor drawing it puts the health banner directly above the canvas',
};

const CALLS_STATE = /\bautomationState\s*\(/;
const CALLS_HEALTH = /\bautomationHealth\s*\(/;
/** The file that DEFINES the helper is not a screen that shows a badge. */
const DEFINES_STATE = /\bfunction automationState\s*\(/;

function die(lines) {
  console.error('');
  for (const line of lines) console.error(line);
  console.error('');
  process.exit(1);
}

// ── the module itself ────────────────────────────────────────────────────────
//
// Everything below rests on `automationHealth` actually reading the counters. If
// somebody "simplifies" it to look at the status word alone, every call site
// still reads as fixed and every screen goes back to lying at once — this check
// included, because it only ever looks for the call.
// [[feedback_a_test_that_cannot_go_red]]
for (const root of ROOTS) {
  const rel = `${root}/automation-health.ts`;
  const full = join(repoRoot, rel);
  if (!existsSync(full)) {
    die([
      `✖ check:automation-health cannot find ${rel}.`,
      '   It is the module every screen below depends on to tell the truth about',
      '   whether a rule is working.',
    ]);
  }
  const source = readFileSync(full, 'utf8');
  for (const counter of ['runCount', 'errorCount']) {
    if (!source.includes(counter)) {
      die([
        `✖ ${rel} no longer reads \`${counter}\`.`,
        '   The two counters are the whole mechanism: the stored status word can',
        '   only ever say "On", because nothing on the platform writes `error`.',
        '   Without them every screen goes back to a green badge over a rule that',
        '   has never worked, and every call site still reads as correct.',
      ]);
    }
  }
  if (!/status !== 'active'/.test(source)) {
    die([
      `✖ ${rel} no longer leaves a paused or draft rule alone.`,
      '   A rule that is switched off is not failing — it is not trying. Its old',
      '   failures are history, and badging them as news is a different lie.',
    ]);
  }
}

// ── the call sites ───────────────────────────────────────────────────────────
const offenders = [];
let scanned = 0;
let badging = 0;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'dist') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!name.endsWith('.tsx') || name.endsWith('.test.tsx')) continue;
    const rel = relative(repoRoot, full).split('\\').join('/');
    scanned += 1;
    const source = readFileSync(full, 'utf8');
    if (!CALLS_STATE.test(source) || DEFINES_STATE.test(source)) continue;
    badging += 1;
    if (Object.hasOwn(SWITCH_ONLY, name)) continue;
    if (CALLS_HEALTH.test(source)) continue;
    offenders.push(rel);
  }
}

for (const root of ROOTS) {
  const full = join(repoRoot, root);
  if (!existsSync(full)) {
    die([
      `✖ check:automation-health cannot find ${root}.`,
      '   A scan root that no longer exists reports a clean pass over nothing.',
    ]);
  }
  walk(full);
}

if (offenders.length > 0) {
  die([
    `✖ ${String(offenders.length)} screen(s) badge an automation with the stored status word alone:`,
    '',
    ...offenders.map((rel) => `   ${rel}`),
    '',
    '   `automationState(status)` answers "is it switched on". For a rule whose',
    '   every run has failed it answers "On", in success green, because nothing',
    '   on the platform ever writes the `error` status the red badge waits for.',
    '',
    '   Read the counters beside it:',
    '',
    "     import { automationHealth } from './automation-health';",
    '     const health = automationHealth(status, runCount, errorCount);',
    '     <Badge color={health ? health.tone : state.tone} …>',
    '       {health ? health.label : state.label}',
    '     </Badge>',
    '',
    '   If the badge really is about the switch and something else on the same',
    '   screen carries the health, add the file to SWITCH_ONLY with the reason.',
  ]);
}

console.log(
  `✓ check:automation-health — ${String(badging)} of ${String(scanned)} automation screens badge a rule's state, ` +
    `each reading the run counters (${String(Object.keys(SWITCH_ONLY).length)} named exception per console).`
);
