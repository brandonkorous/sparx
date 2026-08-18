// A Save is always the primary action. Nothing else may hold it.
//
// ── WHY THIS IS A CHECK AND NOT A CONVENTION ────────────────────────────────
//
// PaneToolbar's `controls` slot is RELOCATABLE: on a narrow pane its contents
// move into an overflow popover so the bar stays one honest row. That is correct
// for filters, selects and secondary actions, and catastrophic for a Save — it
// puts the one control a person is reaching for behind an extra tap they have no
// reason to know about, on the device where they can see least.
//
// It is a check because the failure is INVISIBLE at the width anyone develops
// at. A Save in `controls` looks perfect on a desktop pane and only goes wrong
// below 672px. The slot migration put a Save, Send or Publish into `controls` in
// 16 surfaces at once and every one of them looked fine.
//
// ── WHAT COUNTS, AND THE DISTINCTION THAT COST A REVISION ───────────────────
//
// The first cut treated Publish and Send as commit actions, and over-fired: on
// a broadcast, a bootcamp and a report schedule they sit BESIDE a Save that is
// already correctly in `primary`, and there they are lifecycle — a state change
// on a saved record, not the act of persisting an edit. DESIGN.md is explicit
// that lifecycle belongs in the surface's chrome and may be secondary.
//
// So the vocabulary is in two tiers:
//
//   COMMIT     Save / Create / Add — unambiguous. Always `primary`, no
//              exceptions, because these persist work that is otherwise lost.
//   LIFECYCLE  Publish / Send / Submit / Update — flagged ONLY when the toolbar
//              has no `primary` at all, which means nothing is holding the
//              commit and this button is it.
//
// A destructive or reversing action (Unpublish, Cancel schedule) is neither.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SURFACES = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'apps',
  'workbench',
  'surfaces'
);

/** Persists work that is otherwise lost. Always `primary`. */
const COMMIT_TEXT = /^\s*(Save|Save [a-z ]+|Create|Create [a-z ]+|Add [a-z][a-z ]*)\s*$/;

/** A state change on a saved record. Only a problem when nothing holds `primary`. */
const LIFECYCLE_TEXT = /^\s*(Publish|Publish now|Send|Send [a-z ]+|Submit|Update)\s*$/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/**
 * The `controls={ … }` regions of a file.
 *
 * Brace-matched rather than regexed to a closing line: a control's own JSX is
 * full of braces, and a line-anchored match stops at the first nested one.
 */
function controlsRegions(source) {
  const regions = [];
  let index = source.indexOf('controls={');
  while (index !== -1) {
    let depth = 0;
    let cursor = index + 'controls='.length;
    const start = cursor;
    for (; cursor < source.length; cursor += 1) {
      const ch = source[cursor];
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    regions.push(source.slice(start, cursor + 1));
    index = source.indexOf('controls={', cursor);
  }
  return regions;
}

/**
 * Every text a `<Button>` in this region can render.
 *
 * Two scanning traps, both of which let a real Save through:
 *
 * 1. The opening tag is scanned rather than regexed. `<Button[^>]*>` looks right
 *    and is wrong the moment a prop holds an arrow function: `onClick={() => {`
 *    contains a `>`, so the match ends mid-attribute and the button's text is
 *    never read. That is how a Save in product-detail sat in `controls` while
 *    this check reported clean.
 *
 * 2. A label is often an EXPRESSION, not a literal:
 *      <Button>{saving ? 'Saving…' : 'Save'}</Button>
 *    Stripping `{…}` reduced that to the empty string, so the button had no text
 *    to test and passed. That is how report-builder's Save sat in `controls`.
 *    Every string literal inside the children is therefore a candidate in its
 *    own right — a button that renders "Save" down ANY branch is a commit
 *    action, whichever branch is live.
 */
function buttonTexts(region) {
  const texts = [];
  let at = region.indexOf('<Button');
  while (at !== -1) {
    let depth = 0;
    let quote = null;
    let cursor = at + '<Button'.length;
    for (; cursor < region.length; cursor += 1) {
      const ch = region[cursor];
      if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'" || ch === '`') quote = ch;
      else if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      else if (ch === '>' && depth === 0) break;
    }
    const close = region.indexOf('</Button>', cursor);
    if (close !== -1) {
      const children = region.slice(cursor + 1, close).replace(/<[^>]*>/g, '');
      // The bare text, with expressions removed…
      texts.push(children.replace(/\{[^{}]*\}/g, '').replace(/\s+/g, ' '));
      // …and each branch of every expression, on its own.
      for (const [, literal] of children.matchAll(/['"`]([^'"`]*)['"`]/g)) {
        texts.push(literal.replace(/\s+/g, ' '));
      }
    }
    at = region.indexOf('<Button', cursor);
  }
  return texts;
}

const failures = [];
for (const file of walk(SURFACES)) {
  const source = readFileSync(file, 'utf8');
  if (!source.includes('controls={')) continue;
  // A toolbar with no `primary` at all has nothing holding its commit action,
  // so a lifecycle verb in `controls` IS the commit there.
  const hasPrimary = source.includes('primary={');
  for (const region of controlsRegions(source)) {
    for (const text of buttonTexts(region)) {
      if (COMMIT_TEXT.test(text) || (!hasPrimary && LIFECYCLE_TEXT.test(text))) {
        failures.push({ file: relative(process.cwd(), file), label: text.trim() });
        break;
      }
    }
  }
}

if (failures.length > 0) {
  console.error(
    `\n${String(failures.length)} surface(s) put a commit action in PaneToolbar's relocatable \`controls\` slot.\n` +
      'On a pane under 672px those move into the overflow popover, so the action a\n' +
      'person came to press is hidden behind a tap they have no reason to expect.\n\n' +
      'Move it to `primary` — that slot is always rendered, at every width.\n'
  );
  for (const failure of failures) {
    console.error(`  ${failure.label.padEnd(16)} ${failure.file.split('\\').join('/')}`);
  }
  console.error('');
  process.exit(1);
}

console.log('check:piggles-toolbars — every commit action is in `primary`.');
