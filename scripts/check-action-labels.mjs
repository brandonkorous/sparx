// Fails when a control's only name is hidden at narrow widths, leaving it with
// no name at all.
//
// The shape:
//
//   <Button onClick={pause}>
//     <Icon glyph={faPause} aria-hidden />
//     <span className="hidden @lg:inline">Pause</span>
//   </Button>
//
// `hidden` is `display: none`, which removes the element from the ACCESSIBILITY
// TREE, not merely from the paint. The icon beside it is `aria-hidden` on
// purpose, because an icon is decoration. So below `@lg` that button has no
// accessible name: a screen reader announces "button", and a phone shows a bare
// glyph. Nothing errors, nothing logs, and it is invisible at the width the
// developer is working at.
//
// Measured 2026-09-18: 87 labels written this way across the two consoles, 35 of
// them on a control with nothing else to fall back on. Three sat side by side on
// one toolbar — Turn on / Pause / Sync now — so a phone showed three unlabeled
// circles, one of which pauses a business's stock feed.
//
// The fix is `<ActionLabel>`, which uses `sr-only` / `not-sr-only` instead: the
// text is parked off-screen but STAYS IN THE TREE, and comes back when there is
// room. This check holds the line.
//
// WHAT COUNTS AS A NAME, and why the list is this long. The first version of
// this scan knew only `<Button>` and reported `<ToggleGroupItem aria-label=…>`
// as nameless; the second missed a paired short form and reported a button that
// says "Create" on a phone. A check that knows some of the spellings reports the
// rest as faults, so every real way of naming a control is listed here:
//
//   aria-label on the control              the explicit name
//   title= on the control                  a name and a tooltip
//   a <Tooltip> wrapping it                the same, composed
//   a paired `@md:hidden` short form       it says "Create" where "Set this
//                                          build up" will not fit
//   the class on the CONTROL itself        the whole control is hidden at that
//                                          width, deliberately; there is nothing
//                                          left on screen to name
//
// [[feedback_absent_behaves_like_fine]] [[feedback_structural_checks_go_blind]]
//
// Zero dependencies on purpose: CI runs it with bare Node, no install.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Both consoles. A tree added outside this list is invisible here, which is why
 *  the file count is printed rather than a bare tick. */
const ROOTS = ['sparx/apps/workbench', 'piggles/apps/workbench'];

/** The component that does it correctly — it explains the pattern in prose, so
 *  its own examples must not be read as call sites. */
const SKIP = ['components/action-label.tsx'];

const HIDDEN = /className="[^"]*\bhidden @?(?:sm|md|lg|xl):inline\b[^"]*"/;
const SHORT_FORM = /className="@?(?:sm|md|lg|xl):hidden"/;
const OPENS_TAG = /^\s*<[A-Za-z]/;
const TAG_NAME = /^\s*<([A-Za-z][\w.]*)/;

function die(lines) {
  console.error('');
  for (const line of lines) console.error(line);
  console.error('');
  process.exit(1);
}

function indentOf(line) {
  return line.length - line.trimStart().length;
}

/**
 * The opening tag of the element wrapping line `i`, as [start, end].
 *
 * By INDENT, not by a list of component names: prettier formats every file in
 * these trees, so the element that encloses a line is the nearest one above it
 * opening a tag at a shallower indent. A name list is a thing to fall out of
 * date; indentation is not.
 */
function enclosing(lines, i) {
  const want = indentOf(lines[i]);
  for (let j = i - 1; j >= 0 && j > i - 60; j -= 1) {
    const line = lines[j];
    if (line.trim() === '') continue;
    if (indentOf(line) < want && OPENS_TAG.test(line)) {
      for (let k = j; k < lines.length && k < j + 40; k += 1) {
        const s = lines[k].trimEnd();
        if (s.endsWith('>') && !s.endsWith('=>')) return [j, k];
      }
      return [j, j];
    }
  }
  return null;
}

const offenders = [];
let scannedFiles = 0;
let labels = 0;

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
    if (SKIP.some((s) => rel.endsWith(s))) continue;
    scannedFiles += 1;
    const lines = readFileSync(full, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!HIDDEN.test(line) || line.trimStart().startsWith('//')) continue;
      labels += 1;

      // The class on anything but a <span> is the CONTROL hiding itself.
      const opens = TAG_NAME.exec(line);
      if (opens && opens[1] !== 'span') continue;

      const span = enclosing(lines, i);
      if (span === null) continue;
      const [start, end] = span;
      const tag = lines.slice(start, end + 1).join('\n');
      if (tag.includes('aria-label') || /\btitle=/.test(tag)) continue;
      if (
        lines
          .slice(Math.max(0, start - 4), start + 1)
          .join('\n')
          .includes('Tooltip')
      )
        continue;
      if (SHORT_FORM.test(lines.slice(Math.max(0, i - 2), i + 3).join('\n'))) continue;
      if (HIDDEN.test(tag)) continue;

      offenders.push({
        rel,
        line: i + 1,
        text: line.trim(),
        control: TAG_NAME.exec(lines[start])?.[1] ?? '?',
      });
    }
  }
}

// ── the component itself ─────────────────────────────────────────────────────
//
// Everything below rests on `ActionLabel` actually keeping the text in the
// accessibility tree. If somebody "simplifies" it back to `hidden`, all 35 call
// sites break at once and every one of them still reads as fixed — this check
// included, because it only ever looks at the call sites. So the component is
// asserted too. [[feedback_a_test_that_cannot_go_red]]
//
// Not a unit test: this console's vitest seat is `environment: 'node'` with no
// jsdom and no component rendering, by a decision written down in its config.
// The rule is a pair of string literals, and this is where the rest of the rule
// already lives.
for (const root of ROOTS) {
  const rel = `${root}/components/action-label.tsx`;
  const full = join(repoRoot, rel);
  if (!existsSync(full)) {
    die([
      `✖ check:action-labels cannot find ${rel}.`,
      '   It is the component every call site below depends on. Without it there',
      '   is nothing holding the names in the accessibility tree.',
    ]);
  }
  // Its own classes are bare strings in a map, NOT a `className="…"` attribute,
  // so the call-site pattern above cannot read them. Asserting the four literals
  // one by one is also what keeps the map from being rewritten as a template —
  // Tailwind reads source text, and an interpolated class is never generated.
  const source = readFileSync(full, 'utf8').replace(/^\s*(\/\/|\*|\/\*).*$/gm, '');
  for (const bp of ['sm', 'md', 'lg', 'xl']) {
    if (!source.includes(`'sr-only @${bp}:not-sr-only'`)) {
      die([
        `✖ ${rel} no longer spells out \`'sr-only @${bp}:not-sr-only'\`.`,
        '   That pair is the whole mechanism: `sr-only` parks the text off-screen',
        '   while LEAVING IT IN THE TREE, and `not-sr-only` paints it again when',
        '   there is room. Without it every control using ActionLabel is nameless',
        '   and every call site still reads as correct.',
        '   It must be a literal, not built from the prop — Tailwind reads source',
        '   text, so an interpolated class name is never generated at all.',
      ]);
    }
  }
  if (/\bhidden @(?:sm|md|lg|xl):/.test(source)) {
    die([
      `✖ ${rel} uses \`hidden\` again.`,
      '   `hidden` is `display: none`, which removes the element from the',
      '   accessibility tree. That is the defect this component exists to fix.',
    ]);
  }
}

for (const root of ROOTS) {
  const full = join(repoRoot, root);
  if (!existsSync(full)) {
    die([
      `✖ check:action-labels is looking for ${root} and it is not there.`,
      '   A check that scans nothing prints a tick. Point it at the new location',
      '   rather than leaving it blind.',
    ]);
  }
  walk(full);
}

if (scannedFiles === 0) {
  die([
    '✖ check:action-labels found no .tsx files to read at all.',
    '   Either the trees moved or the walk is broken. Fix it rather than',
    '   believing the tick.',
  ]);
}

if (offenders.length > 0) {
  die([
    offenders.length === 1
      ? '✖ action labels: 1 control loses its name at narrow widths'
      : `✖ action labels: ${String(offenders.length)} controls lose their names at narrow widths`,
    '',
    ...offenders.map(
      (o) =>
        `  ${o.rel}:${String(o.line)}\n` +
        `     <${o.control}> has no aria-label, no title and no tooltip, and this is\n` +
        `     its only name: ${o.text}\n` +
        `     \`hidden\` removes it from the accessibility tree. Use <ActionLabel>.`
    ),
  ]);
}

console.log(
  `✓ action labels: ${String(labels)} width-dependent labels, all named ` +
    `(${String(scannedFiles)} files scanned).`
);
