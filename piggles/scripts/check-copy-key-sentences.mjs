#!/usr/bin/env node
// A copy key may not hold half a sentence.
//
// ── WHAT THIS GUARDS ────────────────────────────────────────────────────────
//
// `productCopy(key, fallback)` returns a string, and `lib/console/copy.ts` can
// replace it with this brand's own wording. When the JSX then appends more
// prose AFTER the call, the key holds only a fragment:
//
//     {productCopy('crm.mailbox.checkNote',
//       'Piggles checks connected mailboxes every few minutes. Use the refresh
//        button on a row to check')}{' '}
//     one right now.
//
// Whoever writes the override sees a copy key and writes a WHOLE sentence,
// because a whole sentence is what a copy key looks like. The tail then glues
// onto the end of it, and the mailboxes pane read:
//
//     We look for new email every few minutes. The refresh button on a row
//     checks that one right now, if you cannot wait. one right now.
//
// The AI prompt editor had the same shape with no `{' '}` at all, so its two
// sentences ran together without even a space. Neither typechecks wrong,
// neither lints, and neither is visible until somebody reads the screen.
//
// ── THE RULE ────────────────────────────────────────────────────────────────
//
// Everything a reader sees as one message goes in ONE key. If a sentence needs
// to follow the copy, it belongs inside the key and inside the fallback, not
// beside them.
//
// A JSX ELEMENT after the call is fine — a link, a badge, a bold name. This
// only flags bare PROSE, which is the thing an override silently duplicates.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');

/** Fail loudly rather than scanning nothing — [[feedback_structural_checks_go_blind]]. */
function mustExist(path, what) {
  if (!existsSync(path)) {
    console.error(`✗ check:copy-key-sentences — ${what} is not at ${path}`);
    process.exit(1);
  }
  return path;
}

const ROOTS = [
  mustExist(join(REPO, 'piggles', 'apps', 'workbench'), 'the Piggles workbench'),
  mustExist(join(REPO, 'sparx', 'apps', 'workbench'), 'the sparx workbench'),
];

const SKIP = new Set(['node_modules', '.next', 'dist', '.turbo', 'coverage']);

function* tsxFiles(dir) {
  for (const name of readdirSync(dir).sort()) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* tsxFiles(path);
    else if (name.endsWith('.tsx')) yield path;
  }
}

// Bare prose: letters, spaces and ordinary punctuation, and nothing that looks
// like code — no `<`, `{`, `}`, `(`, `)`, `=`, backtick or quote.
const PROSE = /^[A-Za-z][A-Za-z0-9',.\-: ]*[.,:]?$/;

const failures = [];
let scanned = 0;
let calls = 0;

for (const root of ROOTS) {
  for (const path of tsxFiles(root)) {
    scanned += 1;
    const lines = readFileSync(path, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      if (!lines[i].includes('productCopy(')) continue;
      calls += 1;
      // Find the line that closes the JSX expression.
      for (let j = i; j < Math.min(i + 14, lines.length); j += 1) {
        if (!lines[j].includes(')}')) continue;
        const tail = lines[j]
          .split(')}')[1]
          .replace(/\{' '\}/g, '')
          .trim();
        const next = (lines[j + 1] ?? '').trim();
        const prose = tail !== '' ? tail : next;
        const at = tail !== '' ? j + 1 : j + 2;
        if (prose !== '' && PROSE.test(prose)) {
          failures.push({ path: relative(REPO, path).replaceAll('\\', '/'), at, prose });
        }
        break;
      }
    }
  }
}

if (scanned === 0 || calls === 0) {
  console.error(
    `✗ check:copy-key-sentences — scanned ${scanned} file(s) and found ${calls} productCopy call(s); the scan went blind`
  );
  process.exit(1);
}

if (failures.length > 0) {
  console.error('✗ check:copy-key-sentences — a copy key holds half a sentence\n');
  for (const f of failures) {
    console.error(`  ${f.path}:${f.at}`);
    console.error(`    prose after the key: "${f.prose}"`);
    console.error('    Move it inside the key AND inside the fallback.\n');
  }
  console.error(
    `${failures.length} of ${calls} productCopy call(s) are followed by prose a brand override would duplicate.`
  );
  process.exit(1);
}

console.log(
  `✓ check:copy-key-sentences — ${calls} productCopy call(s) across ${scanned} file(s) each hold their whole message.`
);
