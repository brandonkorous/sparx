#!/usr/bin/env node
// A DATE TYPED INTO A BOX, AND THE FORM SAVED AS THOUGH THE BOX WERE EMPTY.
//
// A native date box is three cells — day, month, year — and it reports a value
// only when ALL THREE hold something. Half fill it in and `value` is the empty
// string while the digits stay on screen. That is the same thing the control
// says when nobody has touched it, so the two states a form must tell apart
// look identical from the one property every caller reads.
//
// MEASURED 2026-09-19 on the wholesale price pane, and again 2026-09-22 on the
// invoice due date, by asking the box itself:
//
//     { value: "", badInput: true }
//
// On the invoice the Save button stayed grey and the footer said "Saved just
// now", so the screen reported success over a date that had been thrown away.
// There were 82 `<Input type="date">` call sites across the two consoles and
// none of them asked. Issue 741.
// [[feedback_the_empty_control_is_the_untested_one]]
//
// ── What this checks ────────────────────────────────────────────────────────
//
// Nothing outside `components/day-input.tsx` may render a date box directly.
// `DayInput` is the one that asks `validity.badInput`, draws the sentence when
// the box is half typed, and hands both halves to the caller. A second date box
// built by hand is the defect coming back, and it comes back silently — the
// screen looks right, the typing is simply gone.
//
// There is NO allow-list, and there is deliberately no pinned baseline: the
// migration was finished in the same pass, so this guard is born green with
// nothing to exempt. A guard that ships red is a guard that gets switched off.
// [[feedback_structural_checks_go_blind]]

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..').split('\\').join('/');
const ROOTS = [`${ROOT}/piggles/apps/workbench`, `${ROOT}/sparx/apps/workbench`];
const OWNER = '/components/day-input.tsx';

for (const path of ROOTS) {
  if (!existsSync(path)) {
    console.error(`check:day-boxes — ${path} is not there. The tree has moved.`);
    process.exit(1);
  }
  if (!existsSync(`${path}${OWNER}`)) {
    console.error(`check:day-boxes — ${path}${OWNER} is not there. Nothing owns the date box.`);
    process.exit(1);
  }
}

/** Comments discuss the native control on purpose; the code must not use it. */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, '');
}

// The guard above only says nobody built their own. This says the one everybody
// now uses still does the job — otherwise a later edit could quietly turn
// `DayInput` back into a plain date box and every call site would go silent
// again with this check printing green. [[feedback_a_test_that_cannot_go_red]]
const MUST_DO = [
  { pattern: /validity\.badInput/, job: 'ask the box whether it is half typed' },
  { pattern: /\bHALF_A_DAY\b/, job: 'say the sentence when it is' },
  { pattern: /onValueChange\(\s*[\w.]+\s*,/, job: 'hand both halves to the caller' },
  { pattern: /onBlur=/, job: 'report again on blur, since a half-typed box fires no change' },
];

for (const root of ROOTS) {
  // Its own header DESCRIBES `onValueChange(value, incomplete)` in prose, so a
  // check that read the whole file stayed green while the code had stopped
  // passing the second argument. Read the code only.
  // [[feedback_a_test_that_cannot_go_red]]
  const owner = stripComments(readFileSync(`${root}${OWNER}`, 'utf8'));
  for (const { pattern, job } of MUST_DO) {
    if (!pattern.test(owner)) {
      console.error(`check:day-boxes — ${root}${OWNER} no longer does one thing: ${job}.`);
      process.exit(1);
    }
  }
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry !== 'node_modules' && entry !== '.next') walk(path, out);
    } else if (entry.endsWith('.tsx')) out.push(path);
  }
  return out;
}

let scanned = 0;
let dayInputs = 0;
const failures = [];

for (const root of ROOTS) {
  for (const path of walk(root)) {
    const file = path.split('\\').join('/');
    scanned += 1;
    const src = readFileSync(path, 'utf8');
    // Counted so the number printed below is the real tally of places the
    // consoles ask for a date, not just the leftovers this found.
    dayInputs += [...src.matchAll(/<DayInput\b/g)].length;
    if (file.endsWith(OWNER)) continue;
    const code = stripComments(src);
    for (const m of code.matchAll(/type="date"/g)) {
      failures.push(
        `${file.slice(ROOT.length + 1)}:${String(code.slice(0, m.index).split('\n').length)}`
      );
    }
  }
}

if (scanned === 0) {
  console.error('check:day-boxes — scanned no files at all. The scan resolved nothing.');
  process.exit(1);
}
if (dayInputs === 0) {
  console.error(
    'check:day-boxes — found no <DayInput> anywhere. Either the component was renamed or this guard is now scanning the wrong tree.'
  );
  process.exit(1);
}

if (failures.length > 0) {
  const many = failures.length > 1;
  console.error(
    many
      ? `\n${String(failures.length)} date boxes are built by hand:\n`
      : '\nA date box is built by hand:\n'
  );
  for (const f of failures) console.error(`  ${f}`);
  console.error(
    '\nUse DayInput from components/day-input.tsx. A bare date box tells a form nothing about a half-typed date, so the typing is dropped in silence. The header of this file says why.\n'
  );
  process.exit(1);
}

console.log(
  `${String(dayInputs)} date boxes across the two consoles, and every one of them says so when it is half typed.`
);
