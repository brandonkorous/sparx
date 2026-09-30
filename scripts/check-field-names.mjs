// Fails when a form control has no name a person can hear.
//
// WHAT A BUSINESS OWNER MET. Loom and Larder's own record in the console, the
// Discount box on the terms she buys on:
//
//     Discount
//     [ 0                 ] %
//
// The word "Discount" above it is a `<FieldLabel>`, and Base UI wires a label to
// its control by id — but ONLY when the control is the direct child of
// `<FieldControl render={…}>`. Put a `<div className="max-w-40">` in between for
// sizing and the wiring stops: no id, no aria-labelledby, no name at all. The
// only clue left is a placeholder, which disappears the moment she types.
//
// MEASURED 2026-09-20 on that one screen: 6 of 13 controls with no accessible
// name. Across both consoles: 33 controls, on credit limits, discounts, gift
// card amounts, deal likelihood and every schema-built date field.
//
// THE FIX IS USUALLY TO DELETE THE WRAPPER. A sizing class belongs on the
// control, where the Field can still see it; that leaves no second copy of the
// label to drift out of step with the first. A wrapper that holds something
// else too (a "%" or a "$" beside the box) has to stay, and the control inside
// it carries its own `aria-label`.
//
// WHAT THIS CHECK CAN AND CANNOT SEE. It looks at the first JSX tag inside a
// `render={…}` and, when that is a plain `div`/`span`, at the control beneath
// it. It cannot follow a control through a component of ours, and it does not
// try. `NumberField`'s own `label` prop counts as a name, because that is
// exactly what silica documents it as.
//
// Zero dependencies on purpose: CI runs it with bare Node, no install.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Where console forms live. A tree added outside this list is invisible here,
 *  which is why the counts are printed rather than a bare tick.
 *  [[feedback_structural_checks_go_blind]] */
const ROOTS = ['piggles/apps/workbench', 'sparx/apps/workbench'];

const CONTROL =
  /<(Input|Textarea|Select|NativeSelect|MultiSelect|Combobox|Autocomplete|SearchInput|TagInput|MoneyInput|MoneyTextInput|DayInput|DateInput|DateTimeInput|TimeInput|PhoneInput|PasswordInput|NumberField)\b/;

/** `label` is silica's own accessible-label prop on NumberField; `aria-label`
 *  is the general one. Either is a name. */
const NAMED = /\s(aria-label|label)[=\s]/;

function die(lines) {
  console.error(lines.join('\n'));
  process.exit(1);
}

function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', 'dist'].includes(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (entry.name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const offenders = [];
let scanned = 0;
let renders = 0;
let wrapped = 0;

for (const root of ROOTS) {
  const full = join(repoRoot, root);
  if (!existsSync(full)) {
    die([
      `✖ check:field-names cannot find ${root}.`,
      '   A scan root that no longer exists reports a clean pass over nothing.',
    ]);
  }
  for (const file of sourceFiles(full)) {
    scanned += 1;
    const rel = relative(repoRoot, file).split(sep).join('/');
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      if (!/\brender=\{/.test(lines[i])) continue;
      renders += 1;
      // The first JSX tag after `render={`.
      let j = i;
      let first = null;
      for (; j < Math.min(lines.length, i + 6); j += 1) {
        const text = j === i ? (lines[i].split('render={')[1] ?? '') : lines[j];
        const m = /<([A-Za-z][\w.]*)/.exec(text);
        if (m) {
          first = m[1];
          break;
        }
      }
      if (first !== 'div' && first !== 'span') continue;
      wrapped += 1;
      for (let k = j; k < Math.min(lines.length, j + 25); k += 1) {
        const m = CONTROL.exec(lines[k]);
        if (!m) continue;
        let attrs = '';
        for (let a = k; a < Math.min(lines.length, k + 20); a += 1) {
          attrs += lines[a] + '\n';
          if (/\/>/.test(lines[a])) break;
        }
        if (!NAMED.test(attrs)) offenders.push({ rel, line: k + 1, tag: m[1] });
        break;
      }
    }
  }
}

if (offenders.length > 0) {
  die([
    `✖ ${String(offenders.length)} form control(s) inside a wrapper have no name a person can hear:`,
    '',
    ...offenders.map((o) => `   ${o.rel}:${String(o.line)}  ${o.tag}`),
    '',
    '   Base UI wires a <FieldLabel> to its control only when the control is the',
    '   direct child of <FieldControl render={…}>. A <div> in between for sizing',
    '   breaks it, and the control ends up with no id, no aria-labelledby and no',
    '   name — the placeholder is all that is left, and that vanishes on the',
    '   first keystroke.',
    '',
    '   Prefer DELETING the wrapper and putting its class on the control:',
    '     <FieldControl render={<Input className="max-w-40" … />} />',
    '   If the wrapper holds something else too (a "%" or a "$" beside the box),',
    '   keep it and give the control its own aria-label matching the FieldLabel.',
  ]);
}

console.log(
  `✓ check:field-names — ${String(wrapped)} wrapped control(s) inside a render prop ` +
    `(of ${String(renders)} across ${String(scanned)} files), every one of them named.`
);
