// Fails when a component is given a color name the app never registered, which
// renders as grey and looks like somebody chose grey.
//
// WHAT A BUSINESS OWNER SAW. Three people in the till's customer picker:
//
//     Orla Beaumont   [Wholesale]     <- grey
//     Tamsin Vale     [Wholesale]     <- grey
//     Priya Nandakumar
//
// The two on agreed prices wore a badge the same color as everything else on
// the screen, because `customerTypeMeta` returned `color: 'b2b'` and the
// registered name is `module-b2b`. Silica emits `badge-b2b`, no such class
// exists, and the component falls back to its default. Nothing is thrown,
// nothing is logged, the badge renders. [[feedback_absent_behaves_like_fine]]
//
// WHY THE COMPILER CANNOT DO THIS. `SilicaColor` is `… | (string & {})`, so
// every string is assignable and autocomplete shows about eight of the real
// names. A typo, a stale name and a module hue written without its prefix are
// all the same to TypeScript. The registered list lives in CSS, in each app's
// `@plugin '@wizeworks/silicaui'` block, so CSS is what this reads.
//
// WHAT IT CAN AND CANNOT SEE. Two unambiguous shapes: `color="x"` on a JSX
// element, and `color: 'x'` in an object literal that feeds one. It cannot see
// a name assembled at runtime (`` `module-${slug}` ``), which is the sanctioned
// way to write a dynamic hue and is deliberately out of scope. A literal that
// is NOT a silica color — a chart series, a canvas fill — goes in ALLOWED with
// its reason rather than being guessed at. [[feedback_codemod_diff_your_own_sweep]]
//
// Zero dependencies on purpose: CI runs it with bare Node, no install.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Both consoles, each with its OWN registered list — piggles registers 39
 *  names and sparx 28, so a name legal in one is not automatically legal in the
 *  other. An app added outside this list is invisible here, which is why the
 *  counts are printed rather than a bare tick.
 *  [[feedback_structural_checks_go_blind]] */
const APPS = [
  { root: 'piggles/apps/workbench', css: 'piggles/apps/workbench/app/globals.css' },
  { root: 'sparx/apps/workbench', css: 'sparx/apps/workbench/app/globals.css' },
];

/**
 * Literals that are not silica color names, with the reason.
 *
 * Keyed by `<path under the app root>:<value>`. A name here without a reason
 * beside it is how this check stops meaning anything.
 */
const ALLOWED = {};

function die(lines) {
  console.error(lines.join('\n'));
  process.exit(1);
}

/** The names the app's Tailwind plugin block registers. */
function registeredColors(cssPath) {
  const full = join(repoRoot, cssPath);
  if (!existsSync(full)) {
    die([
      `✖ check:colors cannot find ${cssPath}.`,
      '   The registered list is the whole question this check asks, so a missing',
      '   stylesheet is a failure rather than an empty pass.',
    ]);
  }
  const css = readFileSync(full, 'utf8');
  const at = css.indexOf("@plugin '@wizeworks/silicaui'");
  if (at < 0) {
    die([
      `✖ check:colors found no @plugin '@wizeworks/silicaui' block in ${cssPath}.`,
      '   Without it every color name below would read as unregistered, or none',
      '   would. Either way the answer would be about this parser, not the code.',
    ]);
  }
  const open = css.indexOf('{', at);
  const close = css.indexOf('}', open);
  const block = css.slice(open + 1, close);
  const keyAt = block.indexOf('colors:');
  if (keyAt < 0) die([`✖ check:colors found no \`colors:\` key in ${cssPath}'s plugin block.`]);
  const names = block
    .slice(keyAt + 'colors:'.length)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (names.length < 8) {
    die([
      `✖ check:colors parsed only ${String(names.length)} color names from ${cssPath}.`,
      '   That is too few to be the real list, so the parse is wrong rather than',
      '   the code. Fix the parse before trusting a pass.',
    ]);
  }
  return new Set(names);
}

const JSX_COLOR = /\bcolor="([a-z0-9-]+)"/g;
const OBJECT_COLOR = /\bcolor:\s*'([a-z0-9-]+)'/g;

function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const offenders = [];
let scanned = 0;
let literals = 0;
let registeredTotal = 0;

for (const app of APPS) {
  const appRoot = join(repoRoot, app.root);
  if (!existsSync(appRoot)) {
    die([
      `✖ check:colors cannot find ${app.root}.`,
      '   A scan root that no longer exists reports a clean pass over nothing.',
    ]);
  }
  const allowed = registeredColors(app.css);
  registeredTotal += allowed.size;

  for (const file of sourceFiles(appRoot)) {
    scanned += 1;
    const source = readFileSync(file, 'utf8');
    const rel = relative(repoRoot, file).replaceAll('\\', '/');
    const short = relative(appRoot, file).replaceAll('\\', '/');
    const lines = source.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue;
      for (const pattern of [JSX_COLOR, OBJECT_COLOR]) {
        pattern.lastIndex = 0;
        let m;
        while ((m = pattern.exec(line)) !== null) {
          const value = m[1];
          literals += 1;
          if (allowed.has(value)) continue;
          if (Object.hasOwn(ALLOWED, `${short}:${value}`)) continue;
          offenders.push({ rel, line: i + 1, value, app: app.root });
        }
      }
    }
  }
}

if (offenders.length > 0) {
  die([
    `✖ ${String(offenders.length)} color name(s) that no app registers:`,
    '',
    ...offenders.map((o) => `   ${o.rel}:${String(o.line)}  color "${o.value}"  (${o.app})`),
    '',
    '   Silica emits one class per REGISTERED name. An unregistered one emits',
    '   nothing, the component falls back to grey, and the screen looks like a',
    '   deliberate choice nobody made.',
    '',
    '   The commonest cause is a module hue written without its prefix: the name',
    "   is `module-b2b`, not `b2b`. The full list is each app's own",
    "   `@plugin '@wizeworks/silicaui' { colors: … }` block in app/globals.css.",
    '',
    '   If the literal is NOT a silica color — a chart series, a canvas fill —',
    '   add it to ALLOWED with the reason.',
  ]);
}

console.log(
  `✓ check:colors — ${String(literals)} color literals across ${String(scanned)} files, ` +
    `every one a registered name (${String(registeredTotal)} registered across ${String(APPS.length)} apps` +
    `${Object.keys(ALLOWED).length > 0 ? `, ${String(Object.keys(ALLOWED).length)} named exceptions` : ''}).`
);
