// Fails when a console surface deletes something without asking first.
//
// WHAT A BUSINESS OWNER SAW. The Orders-to-approve screen has one row per
// spending limit, and on that row a switch and a trash can sit a thumb-width
// apart:
//
//     Over $5,000.00                              ( ) [bin]
//     Every customer
//
// The switch turns the limit off and can be turned back on. The bin removes it
// for good, with no question asked, no toast, and no way back. The limit is the
// only thing standing between a wholesale customer and an order of any size
// going straight through, so the two controls beside each other do opposite
// amounts of damage and look equally casual.
//
// THE HOUSE RULE. Every delete or overwrite goes behind `useConfirm`, naming
// what is being lost. 30+ surfaces already do it; this check is the floor under
// the ones written next.
//
// WHAT THIS CHECK CAN AND CANNOT SEE. It looks for a mutation whose NAME says
// it destroys something (`deleteRule.mutate(`, `removeFoo.mutateAsync(`) in a
// file that never imports `useConfirm`. It cannot tell which call the confirm
// guards, so a file that imports it passes. That is deliberately loose: a check
// that guesses reports working code as broken, and the shape it does catch —
// a whole surface with a destructive action and no confirm anywhere in it — is
// the one that has actually shipped. [[feedback_codemod_diff_your_own_sweep]]
//
// Zero dependencies on purpose: CI runs it with bare Node, no install.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Where console screens live. A tree added outside this list is invisible
 *  here, which is why the file count is printed rather than a bare tick.
 *  [[feedback_structural_checks_go_blind]] */
const ROOTS = [
  'piggles/apps/workbench/surfaces',
  'piggles/apps/workbench/components',
  'sparx/apps/workbench/surfaces',
  'sparx/apps/workbench/components',
];

/** A mutation whose name says it takes something away. */
const DESTRUCTIVE = /\b((?:delete|remove|destroy)[A-Z]\w*)\.mutate(?:Async)?\(/;

/**
 * Files whose destructive-looking calls are fine without a confirm, each with
 * the reason it is fine.
 *
 * Keyed by repo-relative PATH rather than path-and-line, because a line number
 * goes stale on the next edit above it and a check nobody can keep green stops
 * being read. The cost is that a SECOND unconfirmed delete added to an allowed
 * file would pass, so the reason has to describe the file, not one call.
 * A name here without a reason beside it is how this check stops meaning
 * anything.
 */
const ALLOWED = {
  'piggles/apps/workbench/surfaces/cms/media-picker.tsx':
    'Its one destructive call takes a picture OUT of an album. The picture is ' +
    'not deleted and the button beside it puts it straight back, so there is ' +
    'nothing lost to warn about.',
  'sparx/apps/workbench/surfaces/cms/media-picker.tsx':
    'Its one destructive call takes a picture OUT of an album. The picture is ' +
    'not deleted and the button beside it puts it straight back, so there is ' +
    'nothing lost to warn about.',
};

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
const seen = new Set();
let scanned = 0;
let calls = 0;

for (const root of ROOTS) {
  const full = join(repoRoot, root);
  if (!existsSync(full)) {
    die([
      `✖ check:confirm cannot find ${root}.`,
      '   A scan root that no longer exists reports a clean pass over nothing.',
    ]);
  }
  for (const file of sourceFiles(full)) {
    scanned += 1;
    const rel = relative(repoRoot, file).split(sep).join('/');
    const source = readFileSync(file, 'utf8');
    const guarded = source.includes('useConfirm');
    const lines = source.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const trimmed = line.trimStart();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
      const match = DESTRUCTIVE.exec(line);
      if (!match) continue;
      calls += 1;
      if (Object.hasOwn(ALLOWED, rel)) {
        seen.add(rel);
        continue;
      }
      if (guarded) continue;
      offenders.push({ key: `${rel}:${String(i + 1)}`, name: match[1], text: trimmed });
    }
  }
}

/** An allowance over a file that no longer has a destructive call is a
 *  permission nobody is watching. [[feedback_structural_checks_go_blind]] */
const stale = Object.keys(ALLOWED).filter((key) => !seen.has(key));
if (stale.length > 0) {
  die([
    `✖ ${String(stale.length)} entr(ies) in ALLOWED no longer have a destructive call:`,
    '',
    ...stale.map((key) => `   ${key}`),
    '',
    '   The call moved or went away. Delete the entry — an allowance that',
    '   matches nothing silently covers whatever is written there next.',
  ]);
}

if (offenders.length > 0) {
  die([
    `✖ ${String(offenders.length)} surface(s) delete something with no confirm anywhere in the file:`,
    '',
    ...offenders.map((o) => `   ${o.key}  ${o.name}  "${o.text}"`),
    '',
    '   A delete is the one action on a screen that cannot be undone, and the',
    '   control for it is usually a small icon beside a harmless one. Put it',
    '   behind `useConfirm` from lib/confirm, naming what stops happening:',
    '',
    "     const ok = await confirm({ title: 'Remove the limit over $5,000.00?',",
    "       description: 'No order will be held for sign-off on size alone.',",
    "       confirmLabel: 'Remove the limit', cancelLabel: 'Keep it', color: 'danger' });",
    '     if (!ok) return;',
    '',
    '   If this call genuinely takes nothing away, add it to ALLOWED with the',
    '   reason it is safe.',
  ]);
}

console.log(
  `✓ check:confirm — ${String(calls)} destructive mutation(s) across ${String(scanned)} console ` +
    `screens, every one of them in a file that asks first ` +
    `(${String(Object.keys(ALLOWED).length)} allowed, with reasons).`
);
