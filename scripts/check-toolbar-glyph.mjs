#!/usr/bin/env node
// A TOOLBAR BUTTON WITH NO WORD ON IT.
//
// `controls` RELOCATES. Under 672px the pane toolbar folds away and everything
// in `controls` is re-rendered, VERBATIM, inside the overflow popover. Two files
// already say what that costs:
//
//   components/pane-toolbar-overflow.tsx
//     "A menu has no position to read and no hover on a touch screen, so an
//      unlabelled glyph is a button with no meaning."
//
//   surfaces/scheduling/calendar-toolbar.tsx
//     "a popover row holding one bare chain glyph and no words is a button with
//      no meaning on a device that cannot hover."
//
// Both are right, and both were written next to code that kept doing it. On
// Devi's purchase order the overflow read: a bare printer glyph, then "Close",
// then "Refresh this list", then "Copy a link to this". One of the four had no
// name. [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// `primary` and the children spill do not relocate, but they lose nothing by
// carrying a name and a phone cannot hover over them either, so they are held to
// the same rule.
//
// ── WHAT TO DO INSTEAD ──────────────────────────────────────────────────────
//
// Declare it as a VALUE in `actions`. `ToolbarActionButtons` gives it icon +
// label in a wide bar, and `ToolbarActionRows` gives it a full-width labelled
// row in the popover — which is the whole reason the slot exists. Destructive
// ones take `tone: 'danger'` and keep their color in both shapes.
//
// If it genuinely must stay bespoke JSX, put a word inside the button: an
// `<ActionLabel>` (piggles) or a `<span className="hidden @2xl:inline">`.
//
// ── WHAT IT LOOKS FOR ───────────────────────────────────────────────────────
//
// A `<Button>` inside a `<PaneToolbar>` whose children are an icon and nothing
// else. Deliberately narrow: "could this ever draw a word?" needs a type
// checker, but "is every child an icon?" needs only a scan and has no false
// positives. A button whose children hold any other expression is left alone,
// so this UNDER-reports rather than blocking a push over a guess.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SCAN_ROOTS = [
  join(ROOT, 'piggles', 'apps', 'workbench', 'surfaces'),
  join(ROOT, 'sparx', 'apps', 'workbench', 'surfaces'),
];

/**
 * A stepper that brackets its own label.
 *
 * `[<] 15 – 21 Sep [>]` is one control, and the date sits BETWEEN the two
 * arrows inside the same wrapper, so it relocates into the popover as a row
 * that says what it steps. The arrows carry no name because the thing they move
 * is right there. Keyed by file and accessible name so it cannot spread to a
 * lone glyph in the same file.
 */
const BRACKETS_ITS_OWN_LABEL = [
  ['surfaces/staff/schedule.tsx', 'Previous week'],
  ['surfaces/staff/schedule.tsx', 'Next week'],
  ['surfaces/staff/timesheets.tsx', 'Previous month'],
  ['surfaces/staff/timesheets.tsx', 'Next month'],
];

/**
 * A pair of arrows inside a run about time, beside a `Today` button and a
 * Day/Week toggle, under a bar whose `status` slot is the date itself.
 *
 * The same reasoning as above with the label one slot further away. Listed
 * rather than silently skipped, because if that date ever leaves the bar these
 * two become nameless.
 */
const TIME_RUN = [
  ['surfaces/scheduling/calendar-toolbar.tsx', 'Previous'],
  ['surfaces/scheduling/calendar-toolbar.tsx', 'Next'],
  ['surfaces/scheduling/calendar.tsx', 'Previous'],
  ['surfaces/scheduling/calendar.tsx', 'Next'],
];

const EXEMPT = [...BRACKETS_ITS_OWN_LABEL, ...TIME_RUN];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/**
 * Skip a comment starting at `i`, or return `i` when there is none.
 *
 * Not optional. JSX allows `//` and block comments BETWEEN attributes, the
 * comments in these files are prose, and prose has apostrophes — so a scanner
 * that does not know what a comment is reads `the narrow bar's popover` as the
 * start of a string, swallows the rest of the tag looking for the closing quote,
 * misses the `>`, and goes on to scan the whole component as if it were still
 * inside the toolbar. That reported table-row buttons as toolbar buttons.
 */
function skipComment(src, i) {
  if (src[i] !== '/') return i;
  if (src[i + 1] === '/') {
    const nl = src.indexOf('\n', i);
    return nl === -1 ? src.length : nl;
  }
  if (src[i + 1] === '*') {
    const end = src.indexOf('*/', i + 2);
    return end === -1 ? src.length : end + 2;
  }
  return i;
}

/** End (exclusive) of the balanced `{ … }` that starts at `open`. */
function closeBrace(src, open) {
  let depth = 0;
  let quote = null;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    const afterComment = skipComment(src, i);
    if (afterComment !== i) {
      i = afterComment - 1;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return src.length;
}

/** End of a JSX open tag, stepping over `{…}` attribute values and strings. */
function openTagEnd(src, start) {
  let quote = null;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    const afterComment = skipComment(src, i);
    if (afterComment !== i) {
      i = afterComment - 1;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      continue;
    }
    if (c === '{') {
      i = closeBrace(src, i) - 1;
      continue;
    }
    if (c === '>') return { end: i + 1, selfClosing: src[i - 1] === '/' };
  }
  return { end: src.length, selfClosing: false };
}

/** Piggles draws icons through `<Icon>`; sparx uses lucide components. */
function iconNames(src) {
  const names = new Set(['Icon']);
  const re = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*'lucide-react'/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    for (const part of m[1].split(',')) {
      const name = part
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim();
      if (name && /^[A-Z]/.test(name)) names.add(name);
    }
  }
  return names;
}

/** The children of the `<Button>` whose open tag ends at `from`. */
function buttonChildren(region, from) {
  let depth = 1;
  let i = from;
  while (i < region.length) {
    const nextOpen = region.indexOf('<Button', i);
    const nextClose = region.indexOf('</Button>', i);
    if (nextClose === -1) return region.slice(from);
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      i = nextOpen + '<Button'.length;
      continue;
    }
    depth--;
    if (depth === 0) return region.slice(from, nextClose);
    i = nextClose + '</Button>'.length;
  }
  return region.slice(from);
}

/** True when the children are an icon and nothing else at all. */
function iconAndNothingElse(children, icons) {
  let sawIcon = false;
  let i = 0;
  while (i < children.length) {
    const c = children[i];
    if (c === '<') {
      const tag = openTagEnd(children, i);
      const name = /^<\s*([A-Za-z][\w.]*)/.exec(children.slice(i, tag.end))?.[1] ?? '';
      if (!tag.selfClosing || !icons.has(name)) return false;
      sawIcon = true;
      i = tag.end;
      continue;
    }
    if (c === '{') {
      const end = closeBrace(children, i);
      // A comment is not content. Any other expression might draw a word, so
      // this button is left alone.
      if (!/^\{\s*\/\*/.test(children.slice(i, end))) return false;
      i = end;
      continue;
    }
    if (!/\s/.test(c)) return false;
    i++;
  }
  return sawIcon;
}

/** Which toolbar slot an offset falls in. */
function slotAt(src, toolbarStart, offset) {
  for (const slot of ['primary', 'controls', 'status', 'search', 'refresh', 'views']) {
    let idx = src.indexOf(`${slot}={`, toolbarStart);
    while (idx !== -1 && idx <= offset) {
      const end = closeBrace(src, idx + slot.length + 1);
      if (offset < end) return slot;
      idx = src.indexOf(`${slot}={`, end);
    }
  }
  return 'children';
}

let toolbars = 0;
let buttons = 0;
const exempted = [];
const failures = [];

for (const root of SCAN_ROOTS) {
  // A check that hard-codes a path is one refactor away from scanning nothing
  // and printing green. [[feedback_structural_checks_go_blind]]
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    console.error(`check:toolbar-glyph — scan root missing: ${root}`);
    process.exit(1);
  }
  for (const file of walk(root)) {
    const src = readFileSync(file, 'utf8');
    const icons = iconNames(src);
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    let tb = src.indexOf('<PaneToolbar');
    while (tb !== -1) {
      toolbars++;
      const open = openTagEnd(src, tb);
      const closing = src.indexOf('</PaneToolbar>', open.end);
      const extentEnd = open.selfClosing ? open.end : closing === -1 ? src.length : closing;
      const region = src.slice(tb, extentEnd);
      let at = region.indexOf('<Button');
      while (at !== -1) {
        buttons++;
        const bOpen = openTagEnd(region, at);
        if (!bOpen.selfClosing && iconAndNothingElse(buttonChildren(region, bOpen.end), icons)) {
          const tag = region.slice(at, bOpen.end);
          const found = /aria-label=(?:"([^"]+)"|\{([\s\S]*?)\})/.exec(tag);
          const label = (found?.[1] ?? found?.[2] ?? '(no accessible name either)')
            .replace(/\s+/g, ' ')
            .trim();
          const line = src.slice(0, tb + at).split('\n').length;
          if (EXEMPT.some(([f, l]) => rel.endsWith(f) && label.includes(l)))
            exempted.push(`${rel}:${String(line)}  ${label}`);
          else
            failures.push({
              where: `${rel}:${line}`,
              slot: slotAt(src, tb, tb + at),
              label,
            });
        }
        at = region.indexOf('<Button', bOpen.end);
      }
      tb = src.indexOf('<PaneToolbar', extentEnd);
    }
  }
}

if (toolbars === 0 || buttons === 0) {
  console.error('check:toolbar-glyph — scanned nothing. The scan roots have moved.');
  process.exit(1);
}

if (failures.length > 0) {
  console.error(
    `\n${String(failures.length)} toolbar button(s) render as an icon with no words:\n`
  );
  for (const f of failures) {
    console.error(`  ${f.where}`);
    console.error(`      slot: ${f.slot}   name: ${f.label}`);
  }
  console.error("\nDeclare it in `actions` (label + icon, `tone: 'danger'` when destructive),");
  console.error('or put a word inside the button. The header of this file says why.\n');
  process.exit(1);
}

console.log(
  `${String(toolbars)} pane toolbars, ${String(buttons)} buttons, and every one of them has a word on it.`
);
console.log(
  `${String(exempted.length)} stepper arrow(s) exempted, each one bracketing its own label:`
);
for (const e of exempted) console.log(`  ${e}`);
