// The column that absorbs the slack must have a floor of its own.
//
// ── THE GRID THIS EXISTS FOR ────────────────────────────────────────────────
//
// `inventory/stock-grid.tsx` is a spreadsheet: an item column, then five
// number columns a person types into. The number columns each carry a hard
// `min-w-28` floor, with a comment explaining why — a dropped width clips "312"
// to "3", a figure that is wrong rather than merely small.
//
// The item column carried `w-full` and no floor at all. `w-full` in a table is
// not "be wide"; it is "you take whatever is left", so that column is the one
// that PAYS when the row is crowded. With every sibling floored and itself
// unfloored, it paid the entire shortfall.
//
// Measured on a real account of 74 rows, the item column rendered at 64px —
// about two characters — at EVERY pane width from 320 up to 900. Those 74 rows
// carried 9 distinct titles between them, so the product code was the only
// thing telling them apart, and the code read "AS…". Eleven rows of one
// overshirt, identical on screen, each with an editable on-hand quantity.
//
// ── WHY A CHECK AND NOT A TEST ──────────────────────────────────────────────
//
// Nothing else could see it. Typecheck, lint and every unit test pass on a
// crushed column, because a column width is a cascade resolved by the browser
// at a width nobody develops at. A screenshot of a wide pane looks perfect. The
// only other way to catch it is to measure a rendered table, which is what
// found it, and that is not something a pre-push hook can do.
//
// ── THE RULE ────────────────────────────────────────────────────────────────
//
// In a file where ANY table column has a floor, the `w-full` column must
// declare one too.
//
// A floor is a declared `min-w-<n>`, OR `whitespace-nowrap`. The second half was
// added the same day, after the first version reported green over the reorder
// worklist, which had the identical failure built out of nowrap alone: five
// always-on `whitespace-nowrap` cells and one unfloored give-cell, and the name
// column went 229px at a 400px pane down to 64px at 800px. Nowrap IS a floor — a
// cell that may not wrap cannot be narrower than its widest line — it is simply
// one nobody had to type.
//
// `min-w-0` is not a floor. It is the opposite: explicit permission to shrink
// below the content, which is how a flex child is allowed to truncate. Counting
// it as a floor would fire on nine innocent files.
//
// The floor the consoles use is `min-w-56`: 224px, less 32px of cell padding,
// leaves 192px, which holds the longest product code on a real account (185px)
// on one line. The check does not require that exact value — a naming column
// holding something short may reasonably floor lower — only that some floor is
// declared.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Both consoles. The rule is about table layout, so it holds identically. */
const ROOTS = [
  join(REPO, 'piggles', 'apps', 'workbench', 'surfaces'),
  join(REPO, 'sparx', 'apps', 'workbench', 'surfaces'),
];

// Resolved from the repo root and asserted, never counted in `..`s: a check
// that scans a directory which has moved reports zero problems in green.
for (const root of ROOTS) {
  if (!existsSync(root)) {
    console.error(`check:column-floor — scan root is missing: ${root}`);
    console.error('The surfaces tree has moved. Fix this path; a check that scans');
    console.error('nothing passes every time.');
    process.exit(1);
  }
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (entry.name.endsWith('.tsx')) out.push(path);
  }
  return out;
}

/** Every `<th …>` / `<td …>` opening tag's className in a file. */
function columnClasses(source) {
  const found = [];
  for (const [, className] of source.matchAll(/<t[hd][^>]*className="([^"]*)"/g)) {
    found.push(className);
  }
  return found;
}

/** A DECLARED floor. `min-w-0` is permission to shrink, so it does not count. */
const declaresFloor = (className) => /\bmin-w-(?!0\b)[[\w./-]+/.test(className);

/** An undeclared one. A cell that may not wrap cannot be narrower than its
 *  widest line, so it holds the row open exactly as a `min-w-` does. */
const hasFloor = (className) => declaresFloor(className) || /\bwhitespace-nowrap\b/.test(className);

const absorbsSlack = (className) => /\bw-full\b/.test(className);

/**
 * ── THE MIRROR OF THE SAME BUG ──────────────────────────────────────────────
 *
 * Everything above is about the give-cell being crushed. The other half is what
 * crushes it back: a cell holding a CONTROL, with no width of its own, sitting
 * beside a `w-full` column. `w-full` takes everything that is left, and an input
 * has no text of its own to hold it open, so the input is what collapses.
 *
 * MEASURED 2026-09-18 on "Send something back to a supplier": the quantity box
 * rendered about 20px wide and showed a sliver of the digit typed into it. The
 * shop owner could not read how many she was sending back. The invoice-entry
 * form beside it had the same two boxes with the same omission, and that one is
 * where a bill gets checked before it is paid.
 *
 * The idiom that works is already in the same folder — receiving writes
 * `className="w-20 text-right tabular-nums"` on the box, recipes write `w-24` —
 * so the rule is: in a file with a give-cell, a control in a table cell declares
 * a width, either on the cell or on itself. `w-full` on the control does not
 * count: filling a cell that is itself zero wide is still zero wide.
 */
const CONTROL = /<(?:Input|MoneyTextInput|MoneyInput|NativeSelect|Textarea|Combobox)\b/;

/** A real width. `max-w-0` and `min-w-0` are permission to shrink, not a width,
 *  and the lookbehind is what keeps `max-w-0` from reading as `w-0`. */
const SIZED = /(?<![\w-])(?:w-(?!full\b)|min-w-(?!0\b))[\w./[\]-]+/;

/** Every `<td …>…</td>` in a file. Table cells do not nest, so the lazy match is
 *  safe here in a way it would not be for a `<div>`. */
function controlCells(source) {
  const out = [];
  for (const [, attrs, inner] of source.matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/g)) {
    if (!CONTROL.test(inner)) continue;
    const cell = /className="([^"]*)"/.exec(attrs)?.[1] ?? '';
    // The control's OWN class list: the first `className="…"` inside the cell.
    const control = /className="([^"]*)"/.exec(inner)?.[1] ?? '';
    if (SIZED.test(cell) || SIZED.test(control)) continue;
    out.push(cell === '' ? '<td> (no class)' : cell);
  }
  return out;
}

const failures = [];
const crushed = [];
let scanned = 0;
let withFloors = 0;

for (const root of ROOTS) {
  for (const file of walk(root)) {
    scanned += 1;
    const source = readFileSync(file, 'utf8');
    // The mirror rule below does not need a floored sibling, only a give-cell,
    // so it is tested before the early return — and it is tested PER TABLE, not
    // per file. A surface with two tables in it (a mapping grid at the top, a
    // row list further down) shares no column widths between them, and reporting
    // the first because the second has a give-cell is a false alarm. This file
    // argues twice that a false alarm is how a check gets switched off.
    for (const chunk of source.split(/<Table\b/).slice(1)) {
      if (!columnClasses(chunk).some(absorbsSlack)) continue;
      for (const className of controlCells(chunk)) {
        crushed.push({ file: relative(REPO, file).split('\\').join('/'), className });
      }
    }
    const classes = columnClasses(source);
    if (!classes.some(hasFloor)) continue;
    withFloors += 1;
    // The absorber must DECLARE its floor. Nowrap is not an option for it: the
    // whole point of a give-cell is that its text truncates.
    const unfloored = classes.filter((c) => absorbsSlack(c) && !declaresFloor(c));
    for (const className of unfloored) {
      failures.push({ file: relative(REPO, file).split('\\').join('/'), className });
    }
  }
}

if (failures.length > 0) {
  console.error(
    `\n${String(failures.length)} table column(s) take the slack with no floor of their own.\n\n` +
      'A sibling column in the same file has a floor of its own — a declared\n' +
      '`min-w-`, or a `whitespace-nowrap` that amounts to the same thing — so these\n' +
      'columns can no longer share a narrow row. `w-full` means "you take what is\n' +
      'left", and what is left is nothing: the column collapses to its padding and\n' +
      'its text becomes an ellipsis. It is almost always the column naming the row.\n\n' +
      'Give it `min-w-56`, the floor the rest of the consoles use, and let the table\n' +
      'scroll sideways instead.\n'
  );
  for (const failure of failures) {
    console.error(`  ${failure.className.padEnd(28)} ${failure.file}`);
  }
  console.error('');
  process.exit(1);
}

if (crushed.length > 0) {
  console.error(
    `\n${String(crushed.length)} table ` +
      `${crushed.length === 1 ? 'cell holds a control' : 'cells hold a control'} with no width of\n` +
      'its own, beside a column that takes all the slack.\n\n' +
      '`w-full` on the naming column means "you take what is left", and an input has\n' +
      'no text to hold itself open, so the input is what collapses: measured at about\n' +
      '20px on a real screen, showing a sliver of the digit typed into it.\n\n' +
      'Put the width on the box, the way receiving and recipes already do:\n' +
      '  className="w-20 text-right tabular-nums"\n'
  );
  for (const one of crushed) {
    console.error(`  ${one.className.padEnd(28)} ${one.file}`);
  }
  console.error('');
  process.exit(1);
}

console.log(
  `check:column-floor — every slack-taking column has a floor, and every control ` +
    `beside one has a width (${String(withFloors)} of ${String(scanned)} surfaces declare column floors).`
);
