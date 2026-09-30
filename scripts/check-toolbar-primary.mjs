// A Save is always the unfoldable action. Nothing else may hold it.
//
// LIVES AT THE ROOT, not under piggles/. It scans BOTH consoles, and a file under
// piggles/ that names a sparx path is exactly what check:boundaries exists to
// stop: the two apps are separate, and either has to be deletable without
// breaking the other. This check belongs to the platform, so it sits with the
// platform's other checks.
//
// TWO TOOLBARS ARE COVERED, because both fold. `PaneToolbar` (a list surface) keeps
// its commit in `primary`; the builders (`TreeBuilder` / `EmailBuilder` /
// `ThemeBuilder`) keep theirs in `save`. Everything else either slot's owner passes
// — `controls` as nodes, `actions` as values — may be folded into a popover.
//
// ── WHY THIS IS A CHECK AND NOT A CONVENTION ────────────────────────────────
//
// A relocatable slot is correct for filters, selects and secondary actions, and
// catastrophic for a Save — it puts the one control a person is reaching for behind
// an extra tap they have no reason to know about, on the device where they can see
// least.
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

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * BOTH consoles, because both have this toolbar and both fold it.
 *
 * This check lived in `piggles/scripts/` and computed its scan root relative to
 * its OWN location, so it could only ever see one of the two consoles - while
 * `sparx/apps/workbench/components/pane-toolbar.tsx` carries the rule in its own
 * header and the line "Enforced by scripts/check-toolbar-primary.mjs".
 * It was not. Pointing it at sparx on 2026-09-19 found 21 commit actions in a
 * relocatable slot, nine of them a plain Save.
 *
 * A check does not have to scan NOTHING to be useless. Scanning half the
 * platform and printing green is the same failure at half the volume.
 * [[feedback_structural_checks_go_blind]]
 */
const TREES = ['piggles/apps/workbench/surfaces', 'sparx/apps/workbench/surfaces'];

const missingTrees = TREES.filter((t) => !existsSync(join(ROOT, t)));
if (missingTrees.length > 0) {
  console.error('check:toolbars - these scan roots do not exist:');
  for (const t of missingTrees) console.error(`  ${t}`);
  console.error('\nUpdate TREES, or this check scans less than it claims and passes.');
  process.exit(1);
}

/**
 * What sparx was already carrying the first time this check could see it.
 *
 * Pinned, not waved through. The check FAILS on any offender that is not on this
 * list, in either console, and it ALSO fails when a file here stops offending and
 * the line is left behind - so the list can only shrink, and cannot rot into a
 * list of things that used to be true.
 *
 * Every entry is a real defect: a Save behind an extra tap below 672px. None of
 * them are argued to be fine. They are layout-entangled lifts (a commit button
 * nested inside conditionals and `ml-auto` flex rows) in a console that could not
 * be opened and looked at when they were found, and a Save toolbar broken by a
 * blind refactor is worse than one that folds.
 *
 * Measured 2026-09-19. Delete a line when you fix it.
 */
const SPARX_DEBT = new Set([
  'sparx/apps/workbench/surfaces/automations/automation-editor.tsx',
  'sparx/apps/workbench/surfaces/b2b/invoice-detail.tsx',
  'sparx/apps/workbench/surfaces/builder/saved-piece-detail.tsx',
  'sparx/apps/workbench/surfaces/cms/content-detail.tsx',
  'sparx/apps/workbench/surfaces/commerce/fitment-list.tsx',
  'sparx/apps/workbench/surfaces/commerce/order-detail.tsx',
  'sparx/apps/workbench/surfaces/commerce/product-configurator.tsx',
  'sparx/apps/workbench/surfaces/commerce/product-detail.tsx',
  'sparx/apps/workbench/surfaces/commerce/product-fitment.tsx',
  'sparx/apps/workbench/surfaces/commerce/product-translations.tsx',
  'sparx/apps/workbench/surfaces/crm/customers-list.tsx',
  'sparx/apps/workbench/surfaces/email/sequence-detail.tsx',
  'sparx/apps/workbench/surfaces/finance/expense-detail.tsx',
  'sparx/apps/workbench/surfaces/finance/recurring-costs.tsx',
  'sparx/apps/workbench/surfaces/funnels/campaign.tsx',
  'sparx/apps/workbench/surfaces/inventory/count-detail.tsx',
  'sparx/apps/workbench/surfaces/inventory/purchase-order-detail.tsx',
  'sparx/apps/workbench/surfaces/inventory/transfer-detail.tsx',
  'sparx/apps/workbench/surfaces/social/composer.tsx',
  'sparx/apps/workbench/surfaces/staff/schedule.tsx',
]);

/** Persists work that is otherwise lost. Always `primary`. */
const COMMIT_TEXT = /^\s*(Save|Save [a-z ]+|Create|Create [a-z ]+|Add [a-z][a-z ]*)\s*$/;

/** A state change on a saved record. Only a problem when nothing holds `primary`. */
const LIFECYCLE_TEXT = /^\s*(Publish|Publish now|Send|Send [a-z ]+|Submit|Update)\s*$/;

/** Repo-relative and forward-slashed, so a path reads the same on every machine
 *  and matches SPARX_DEBT wherever the check is run from. */
function rel(file) {
  return relative(ROOT, file).split(sep).join('/');
}

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

/**
 * The regions of a given `prop={…}`, brace-matched.
 *
 * Brace-matched rather than regexed to a closing line: a control's own JSX is full
 * of braces, and a line-anchored match stops at the first nested one.
 */
function propRegions(source, prop) {
  const open = `${prop}={`;
  const regions = [];
  let index = source.indexOf(open);
  while (index !== -1) {
    let depth = 0;
    let cursor = index + prop.length + 1;
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
    index = source.indexOf(open, cursor);
  }
  return regions;
}

/** The source with every `prop={…}` region cut out of it. */
function without(source, prop) {
  let out = source;
  for (const region of propRegions(out, prop)) out = out.split(region).join('');
  return out;
}

/**
 * Every label a foldable ACTION VALUE in this file can carry.
 *
 * A toolbar that takes its secondary actions as values rather than nodes fails in a
 * different shape than a list toolbar does: not `<Button>Save</Button>` in the wrong
 * slot, but `{ label: 'Save', … }` in an array the bar is allowed to fold. Same
 * consequence exactly.
 *
 * ── WHY THE WHOLE FILE, AND NOT THE `actions={…}` REGION ───────────────────
 *
 * Because scanning that region found NOTHING, and said so in green. Every pane here
 * builds its list in a hook and passes it by reference — `actions={actions}` — so
 * the region is four characters long and the array is somewhere else entirely. A
 * planted Save survived the check, which is the failure this file exists to catch,
 * committed in the checker itself.
 *
 * So: the whole file, minus the slots that are ALLOWED to hold a commit —
 * `primary`, `primaryAction`, `save`. A "Add a customer" in `primaryAction` is
 * correct and must not fail; the same words in `actions` are the bug.
 *
 * Every literal on the `label:` line counts, ternary branches included — an action
 * reading "Save" down ANY branch is a commit action, whichever branch is live.
 */
function foldableLabels(source) {
  const scanned = ['primary', 'primaryAction', 'save'].reduce(without, source);
  const labels = [];
  for (const [, expression] of scanned.matchAll(/label:\s*([^\n]*)/g)) {
    for (const [, literal] of expression.matchAll(/['"`]([^'"`]*)['"`]/g)) {
      labels.push(literal.replace(/\s+/g, ' '));
    }
  }
  return labels;
}

const failures = [];
const scanned = [];
for (const tree of TREES) {
  for (const f of walk(join(ROOT, tree))) scanned.push(f);
}
if (scanned.length === 0) {
  console.error('check:toolbars - scanned 0 files.');
  process.exit(1);
}
for (const file of scanned) {
  const source = readFileSync(file, 'utf8');
  const hasControls = source.includes('controls={');
  const hasActions = source.includes('actions={');
  if (!hasControls && !hasActions) continue;
  // A toolbar with nothing holding its commit action means a lifecycle verb in a
  // foldable slot IS the commit there. `save={…}` is the builders' name for the
  // same slot `primary={…}` is on a list toolbar.
  const holdsCommit = source.includes('primary={') || source.includes('save={');
  const offend = (text) => COMMIT_TEXT.test(text) || (!holdsCommit && LIFECYCLE_TEXT.test(text));

  for (const region of controlsRegions(source)) {
    for (const text of buttonTexts(region)) {
      if (offend(text)) {
        failures.push({
          file: rel(file),
          label: text.trim(),
          slot: 'controls',
        });
        break;
      }
    }
  }
  if (!hasActions) continue;
  for (const text of foldableLabels(source)) {
    if (offend(text)) {
      failures.push({ file: rel(file), label: text.trim(), slot: 'actions' });
      break;
    }
  }
}

const offending = new Set(failures.map((f) => f.file));

/** A pinned file that no longer offends: somebody fixed it and left the line
 *  here. A debt list nobody prunes stops being a debt list. */
const stale = [...SPARX_DEBT].filter((f) => !offending.has(f));

/** Anything not pinned, in either console. */
const fresh = failures.filter((f) => !SPARX_DEBT.has(f.file));

if (fresh.length > 0) {
  console.error(
    `\n${String(fresh.length)} surface(s) put a commit action in a RELOCATABLE toolbar slot.\n` +
      'On a narrow pane those move into an overflow popover, so the action a person\n' +
      'came to press is hidden behind a tap they have no reason to expect.\n\n' +
      'Move it to `primary` (a list toolbar) or `save` (a builder) - those slots are\n' +
      'always rendered, at every width.\n'
  );
  for (const failure of fresh) {
    console.error(`  ${failure.label.padEnd(16)} ${failure.slot.padEnd(9)} ${failure.file}`);
  }
  console.error('');
  process.exit(1);
}

if (stale.length > 0) {
  console.error(
    `\n${String(stale.length)} file(s) in SPARX_DEBT no longer offend. Delete them from the\n` +
      'list, so it keeps meaning what it says:\n'
  );
  for (const file of stale) console.error(`  ${file}`);
  console.error('');
  process.exit(1);
}

console.log(
  `check:toolbars - ${String(scanned.length)} files across ${String(TREES.length)} consoles; ` +
    'every commit action is unfoldable (`primary` / `save`)' +
    (failures.length > 0 ? `, except ${String(failures.length)} pinned in SPARX_DEBT.` : '.')
);
