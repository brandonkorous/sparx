// Fails when a console exports a piece of UI that nothing renders.
//
// ── What this is for ───────────────────────────────────────────────────────
//
// A component with no caller is not harmless dead code here. It reads as
// FINISHED — it has props, styling, a doc comment saying what it is for — so
// the next person to ask "does the console do X?" reads the file, finds X, and
// stops. The screen that needed it goes on not having it, and every static
// check stays green, because a component nothing imports compiles perfectly.
//
// Two shipped examples, both found by clicking rather than by any check:
//
//   GenerateBarcodesButton  "the 'give these items a barcode' action, as a
//                            button any list can drop in" — no list dropped it
//                            in. A shop with 108 items and zero barcodes was
//                            offered a button that opened a list with no way to
//                            pick anything, while the endpoint behind the dead
//                            button took 500 ids at a time.
//   MissingBarcodeCount     "the number that decides whether a warehouse can go
//                            scan-first at all" — rendered nowhere, so that
//                            number appeared on no screen in either console.
//   ListHistoryOnly         written for rule-driven lists, where every one of
//                            the platform's 1,342 membership events lives. The
//                            panel shipped only on hand-picked lists, which
//                            have none.
//
// [[feedback_screen_over_a_function_nobody_calls]]
//
// ── What it can and cannot see ─────────────────────────────────────────────
//
// It reads one unambiguous shape: `export function Xxx(` in a `surfaces/` file,
// with a capital first letter, where the name appears in NO other file in the
// same console and at most once in its own. That is deliberately narrow.
//
// It does NOT try to judge whether a component is "used enough", and it does not
// look outside its console — the two consoles are separate builds and neither
// may import from the other, so a name used only in the other one is still
// orphaned here.
//
// A surface component reached through the registry is NOT an orphan: the catalog
// files import it by name, so it is found like anything else.
//
// Zero dependencies on purpose: CI runs it with bare Node, no install.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

// Shared with check:api-hrefs. A comment that mentions a name is not a use of
// it, and knowing which `/*` is inside a comment IS the parse — see the
// module's own header for the two ways this check got that wrong.
import { stripComments } from './lib/strip-comments.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Both consoles. A tree added outside this list is invisible here, which is why
 *  the file count is printed rather than a bare tick.
 *  [[feedback_structural_checks_go_blind]] */
const ROOTS = ['sparx/apps/workbench', 'piggles/apps/workbench'];

/**
 * Exports that genuinely have no caller in their own console, with the reason.
 *
 * A name here without a reason beside it is how this check stops meaning
 * anything. "We might want it later" is not a reason — delete it and let git
 * hold it, because a file in the tree is a claim that the console does this.
 */
const ALLOWED = {};

const EXPORTED = /^export function ([A-Z]\w*)\s*\(/gm;

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
let exports_ = 0;

for (const root of ROOTS) {
  const full = join(repoRoot, root);
  if (!existsSync(full)) {
    die([
      `✖ check:orphan-surfaces cannot find ${root}.`,
      '   A scan root that no longer exists reports a clean pass over nothing.',
    ]);
  }

  // Read the WHOLE console, not just its surfaces: a surface component is
  // usually referenced from lib/surfaces/catalog, which is not under surfaces/.
  const files = walk(full);
  const sources = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]));
  // What USES are counted in: the same files with their comments taken out.
  const code = new Map([...sources].map(([f, src]) => [f, stripComments(src)]));
  scanned += files.length;

  for (const [file, src] of sources) {
    const rel = slash(file);
    if (!rel.includes('/surfaces/')) continue;
    if (!file.endsWith('.tsx')) continue;
    EXPORTED.lastIndex = 0;
    let m;
    while ((m = EXPORTED.exec(src)) !== null) {
      const name = m[1];
      exports_ += 1;
      const word = new RegExp(`\\b${name}\\b`);
      let elsewhere = false;
      for (const [other, osrc] of code) {
        if (other === file) continue;
        if (word.test(osrc)) {
          elsewhere = true;
          break;
        }
      }
      if (elsewhere) continue;
      // Used inside its own file counts: a component can legitimately be
      // exported for a test and rendered by its own module.
      const selfUses = ((code.get(file) ?? '').match(new RegExp(`\\b${name}\\b`, 'g')) ?? [])
        .length;
      if (selfUses > 1) continue;
      if (Object.hasOwn(ALLOWED, `${rel}:${name}`)) continue;
      offenders.push({ rel, name });
    }
  }
}

if (offenders.length > 0) {
  die([
    `✖ ${String(offenders.length)} exported component(s) that nothing renders:`,
    '',
    ...offenders.map((o) => `   ${o.rel}  ${o.name}`),
    '',
    '   A component with no caller reads as finished and is not. The screen that',
    '   needed it still does not have it, and nothing else will ever say so:',
    '   dead UI compiles, lints and typechecks perfectly.',
    '',
    '   Either render it where it was written to go, or delete it and let git',
    '   hold it. If it is genuinely meant to sit unused, add it to ALLOWED with',
    '   the reason.',
  ]);
}

console.log(
  `✓ check:orphan-surfaces — every one of ${String(exports_)} exported surface components ` +
    `is rendered somewhere (${String(scanned)} files, ${String(Object.keys(ALLOWED).length)} named exceptions).`
);
