// Fails when a big number is painted an alarm color no matter what it says, so
// a zero shouts about a problem that did not happen.
//
// What a business owner saw on "Things that do not add up":
//
//     1                 0                   0
//     Sales refused     Promised anyway     Sold below zero
//
// amber, blue, red. The color was pinned to the KIND of event rather than to
// whether any had occurred, so two of the three were alarms about nothing and
// the eye went to the red one — the number saying nothing had gone wrong.
//
// The rule was already written down twice. On the receivables card:
//
//     The one figure allowed to shout. Everything else on this surface stays
//     neutral so that this reads as urgent rather than decorative.
//
// and 150 lines above those three stats, in the same file, a fourth count
// already guarded itself with `openDrifts > 0 ? 'text-danger …' : '…'`.
// Six screens never got the message. [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// This is RULE #4 read forwards. Color IS the design, so spending it on a zero
// is what leaves nothing for the number that matters.
//
// WHAT THIS CHECK CAN AND CANNOT SEE. It reads one unambiguous shape: an alarm
// ink written as a LITERAL class beside `text-2xl`. It cannot tell a problem
// counter from a PARTITION — "Healthy / Running low / Sold out" are three
// slices of one total, and their colors are a legend rather than an alarm — so
// those are named in ALLOWED with their reason rather than guessed at. A check
// that guesses reports working code as broken, and I have swept a false
// positive before. [[feedback_codemod_diff_your_own_sweep]]
//
// Zero dependencies on purpose: CI runs it with bare Node, no install.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Both consoles. A tree added outside this list is invisible here, which is why
 *  the file count is printed rather than a bare tick.
 *  [[feedback_structural_checks_go_blind]] */
const ROOTS = ['sparx/apps/workbench', 'piggles/apps/workbench'];

/**
 * Figures whose color is not an alarm, with the reason.
 *
 * Keyed by `<file>:<the literal class>`. A name here without a reason beside it
 * is how this check stops meaning anything.
 */
const ALLOWED = {
  'surfaces/inventory/reports.tsx:text-success text-2xl font-semibold tabular-nums':
    'Healthy / Running low / Sold out is a PARTITION of one total: the three ' +
    'colors are a legend, and a slice reading 0 still labels its band',
  'surfaces/inventory/reports.tsx:text-warning text-2xl font-semibold tabular-nums':
    'the Running low slice of the same partition',
  'surfaces/inventory/reports.tsx:text-danger text-2xl font-semibold tabular-nums':
    'the Sold out slice of the same partition, and the write-off total beneath ' +
    'it, which is money rather than a count of incidents',
  'surfaces/inventory/bom-detail.tsx:text-warning text-2xl':
    'holds the SKU that runs out first, not a count; when there is none it ' +
    'reads an em dash under "Nothing is holding you back"',
  'surfaces/invoicing/ar-summary.tsx:text-danger text-2xl tabular-nums':
    'already guarded — the whole block only renders when overdue.count > 0, ' +
    'and its comment is where this rule was first written down',
  'surfaces/invoicing/ar-summary.tsx:text-success text-2xl':
    'renders the word "None", not a number',
  'surfaces/inventory/performance.tsx:text-info text-2xl font-semibold tabular-nums':
    'Units in / Units out / Net is a legend, not an alarm: blue labels the ' +
    'inbound band and the block only renders when something moved',
};

const ALARM = '(?:danger|error|warning|success|info)';
/** `className="… text-danger … text-2xl …"` — a literal, both parts present. */
const LITERAL_CLASS = /className="([^"]*)"/g;
const HAS_ALARM = new RegExp(`\\btext-${ALARM}\\b`);
const HAS_BIG = /\btext-2xl\b/;

function die(lines) {
  console.error('');
  for (const line of lines) console.error(line);
  console.error('');
  process.exit(1);
}

// ── the module itself ────────────────────────────────────────────────────────
//
// Everything below rests on `countInk` actually dropping the color at zero. If
// somebody "simplifies" it to always return the ink, every call site still
// reads as fixed and every screen shouts again.
// [[feedback_a_test_that_cannot_go_red]]
for (const root of ROOTS) {
  const rel = `${root}/lib/count-ink.ts`;
  const full = join(repoRoot, rel);
  if (!existsSync(full)) {
    die([
      `✖ check:count-ink cannot find ${rel}.`,
      '   It is the module every guarded figure below depends on.',
    ]);
  }
  const source = readFileSync(full, 'utf8');
  if (!/count > 0 \? ink : ''/.test(source)) {
    die([
      `✖ ${rel} no longer drops the color at zero.`,
      '   `count > 0 ? ink : \'\'` is the whole rule. Returning the ink either way',
      '   puts every guarded figure back to shouting about nothing, and every',
      '   call site still reads as correct.',
    ]);
  }
  if (/soft|muted|opacity|\/\d\d/.test(source.replace(/^\s*(\/\/|\*|\/\*).*$/gm, ''))) {
    die([
      `✖ ${rel} fades the zero instead of leaving it plain.`,
      '   A zero is still a figure she is meant to READ. Fading it breaks RULE #3',
      '   to fix RULE #4.',
    ]);
  }
}

// ── the call sites ───────────────────────────────────────────────────────────
const offenders = [];
let scanned = 0;
let figures = 0;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'dist') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!name.endsWith('.tsx')) continue;
    const rel = relative(repoRoot, full).split('\\').join('/');
    const short = rel.replace(/^(?:sparx|piggles)\/apps\/workbench\//, '');
    scanned += 1;
    const source = readFileSync(full, 'utf8');
    const lines = source.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (line.trimStart().startsWith('//')) continue;
      LITERAL_CLASS.lastIndex = 0;
      let m;
      while ((m = LITERAL_CLASS.exec(line)) !== null) {
        const value = m[1];
        if (!HAS_ALARM.test(value) || !HAS_BIG.test(value)) continue;
        figures += 1;
        if (Object.hasOwn(ALLOWED, `${short}:${value}`)) continue;
        offenders.push({ rel, line: i + 1, value });
      }
    }
  }
}

for (const root of ROOTS) {
  const full = join(repoRoot, root);
  if (!existsSync(full)) {
    die([
      `✖ check:count-ink cannot find ${root}.`,
      '   A scan root that no longer exists reports a clean pass over nothing.',
    ]);
  }
  walk(full);
}

if (offenders.length > 0) {
  die([
    `✖ ${String(offenders.length)} big figure(s) wear an alarm color whatever they say:`,
    '',
    ...offenders.map((o) => `   ${o.rel}:${String(o.line)}  "${o.value}"`),
    '',
    '   A zero is not a problem, so it should not be painted like one. Two zeros',
    '   in alarm colors beside a 1 send the eye to the wrong number.',
    '',
    '     import { countClass } from \'../../lib/count-ink\';',
    "     <Text className={countClass(n, 'text-2xl font-semibold tabular-nums', 'text-danger')}>",
    '',
    '   If the color is a LEGEND rather than an alarm — one slice of a partition,',
    '   a word rather than a count, a block that only renders when there is',
    '   something to report — add it to ALLOWED with the reason.',
  ]);
}

console.log(
  `✓ check:count-ink — ${String(figures)} big colored figures across ${String(scanned)} files, ` +
    `each either guarded or a named legend (${String(Object.keys(ALLOWED).length)} named).`
);
