// Fails when a console asks to open a pane that is not registered.
//
// ── What this is for ─────────────────────────────────────────────────────────
//
// `ctx.open('commerce.order.detail', { id })` is how every screen in the console
// reaches another screen. The first argument is a plain string, so a wrong one
// compiles, lints, passes every test, and renders a button that does nothing a
// person can name. There is no stack trace and no red: the pane simply does not
// arrive, which looks like a slow click.
//
// Found by nearly shipping one. A new "Left on ORDER-123" link on the batch
// screen — the thing a recall exists to answer — was written as
// `commerce.orders.detail`. The registered key is `commerce.order.detail`,
// singular. Typecheck was clean. The only way to catch it was to click it.
// [[feedback_absent_behaves_like_fine]]
//
// ── What it looks for ────────────────────────────────────────────────────────
//
// Every `open('<literal>'` / `openSurface('<literal>'` / `createSurface: '<lit>'`
// in a console, checked against the `key: '<literal>'` values in that same
// console's own registry catalog. A console is checked against ITSELF: the two
// are separate builds and neither may import from the other, so a key that
// exists only in the other console is still wrong here.
//
// A key built at runtime (`open(surface.key)`, a template literal) is invisible
// to this and is meant to be — it is not a literal anybody can typo. What it
// catches is the shape that actually shipped: somebody typing a name from
// memory.
//
// Zero dependencies on purpose: CI runs it with bare Node, no install.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

import { stripComments } from './lib/strip-comments.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Both consoles, each with the folder its registry keys are declared in.
 *  A tree added outside this list is invisible here, which is why the counts are
 *  printed rather than a bare tick. [[feedback_structural_checks_go_blind]] */
const CONSOLES = [
  { root: 'sparx/apps/workbench', catalog: 'lib/surfaces' },
  { root: 'piggles/apps/workbench', catalog: 'lib/surfaces' },
];

/**
 * Keys a console may open that its catalog does not declare, with the reason.
 *
 * A name here without a reason beside it is how this check stops meaning
 * anything.
 */
const ALLOWED = {};

/** `key: 'some.surface.key'` — how the catalog declares one. */
const KEY_DECL = /\bkey:\s*'([a-z][\w-]*(?:\.[\w-]+)+)'/g;

/** The three ways a console names a pane to open, all with a literal. */
const OPEN_CALL = /\b(?:open|openSurface)\(\s*'([a-z][\w-]*(?:\.[\w-]+)+)'/g;
const CREATE_SURFACE = /\bcreateSurface:\s*'([a-z][\w-]*(?:\.[\w-]+)+)'/g;

function die(lines) {
  console.error('');
  for (const line of lines) console.error(line);
  console.error('');
  process.exit(1);
}

const slash = (p) => relative(repoRoot, p).split(/[\\/]/).join('/');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'dist') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.ts') || name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const offenders = [];
let scanned = 0;
let declared = 0;
let asked = 0;

for (const { root, catalog } of CONSOLES) {
  const full = join(repoRoot, root);
  const catalogDir = join(full, catalog);
  for (const [label, dir] of [
    [root, full],
    [`${root}/${catalog}`, catalogDir],
  ]) {
    if (existsSync(dir)) continue;
    die([
      `✖ check:open-targets cannot find ${label}.`,
      '   A scan root that no longer exists reports a clean pass over nothing.',
    ]);
  }

  const files = walk(full);
  const code = new Map(files.map((f) => [f, stripComments(readFileSync(f, 'utf8'))]));
  scanned += files.length;

  // Pass 1 — every key this console's registry declares.
  const keys = new Set();
  for (const [file, src] of code) {
    if (!file.startsWith(catalogDir)) continue;
    for (const [, key] of src.matchAll(KEY_DECL)) keys.add(key);
  }
  if (keys.size === 0) {
    die([
      `✖ check:open-targets found no surface keys in ${root}/${catalog}.`,
      '   Every open() would then read as wrong, so this is a broken check',
      '   rather than a broken console. Fix the pattern, not the callers.',
    ]);
  }
  declared += keys.size;

  // Pass 2 — every literal key a screen asks to open.
  for (const [file, src] of code) {
    const rel = slash(file);
    for (const pattern of [OPEN_CALL, CREATE_SURFACE]) {
      pattern.lastIndex = 0;
      for (const match of src.matchAll(pattern)) {
        const key = match[1];
        asked += 1;
        if (keys.has(key)) continue;
        const line = src.slice(0, match.index).split('\n').length;
        const where = `${rel}:${line}`;
        if (Object.hasOwn(ALLOWED, where)) continue;
        // Name the nearest real key, because a typo is almost always adjacent to
        // one and "no such surface" alone sends somebody reading the whole
        // catalog.
        const near = [...keys]
          .filter((k) => k.split('.')[0] === key.split('.')[0])
          .sort((a, b) => Math.abs(a.length - key.length) - Math.abs(b.length - key.length))
          .filter((k) => k.replaceAll('s', '') === key.replaceAll('s', ''))[0];
        offenders.push({ where, key, near: near ?? null });
      }
    }
  }
}

if (offenders.length > 0) {
  die([
    `✖ ${String(offenders.length)} pane(s) opened by a name nothing registers:`,
    '',
    ...offenders.map(
      (o) => `   ${o.where}  ${o.key}${o.near === null ? '' : `   did you mean ${o.near}?`}`
    ),
    '',
    '   The first argument to open() is a plain string, so a wrong one compiles',
    '   and lints. At runtime the pane simply never arrives: no error, no red,',
    '   just a control that looks like it did not register the click.',
    '',
    '   Use the key exactly as the catalog declares it, or add the line to',
    '   ALLOWED with the reason it is not in this console.',
  ]);
}

console.log(
  `✓ check:open-targets — every pane opened by name exists (${String(scanned)} files, ` +
    `${String(declared)} registered surfaces, ${String(asked)} open sites, ` +
    `${String(Object.keys(ALLOWED).length)} named exceptions).`
);
