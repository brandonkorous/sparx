#!/usr/bin/env node
// A PANE DECIDING FOR ITSELF WHY IT COULD NOT LOAD.
//
// `paneLoadReason` in lib/api-error.ts is the one place that answers it, and it
// answers three ways, each with a persona issue behind it:
//
//     404       → missing      issue 286: a 404 came back in milliseconds and the
//                              screen said the server could not be reached, over a
//                              Try again that could only ever fail.
//     5xx       → failed       issue 467: the server WAS reached. It answered, and
//                              its answer was that it had failed. "Check your
//                              connection" is wasted effort on a fault that is ours.
//     400, 422  → missing      issue 726: the address is wrong, which is a 404
//                              wearing a different number.
//
// 43 call sites wrote the TWO-case version by hand:
//
//     reason={gone ? 'missing' : 'unreachable'}
//
// where `gone` is `isNotFound(error)`, a 404-only test. Every one of them was
// still answering issue 286 and neither of the other two, so a purchase order
// opened from a link with a truncated id read "This is a problem reaching the
// server" over a dead Try again, and a 500 read the same.
//
// `<PaneLoadError>` already takes both sets of words — `title`/`description` for
// the reachable case and `missingTitle`/`missingDescription` for the gone one —
// and works the reason out from `error` itself. So a pane hands it the error and
// the words, and never the verdict. [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// ── What is still allowed ───────────────────────────────────────────────────
//
// A LITERAL `reason="missing"`. That is a pane that genuinely knows, with no
// error to read: no id in the address, a record the layout points at that this
// business cannot see. There is nothing for `paneLoadReason` to decide there.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..').split('\\').join('/');
const ROOTS = [`${ROOT}/piggles/apps/workbench`, `${ROOT}/sparx/apps/workbench`];

for (const path of ROOTS) {
  if (!existsSync(path)) {
    console.error(`check:load-error-reason — ${path} is not there. The tree has moved.`);
    process.exit(1);
  }
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry !== 'node_modules' && entry !== '.next') walk(path, out);
    } else if (entry.endsWith('.tsx')) out.push(path);
  }
  return out;
}

let found = 0;
const failures = [];

for (const root of ROOTS) {
  for (const path of walk(root)) {
    const file = path.split('\\').join('/');
    // The component defines the prop; it is not a caller.
    if (file.endsWith('/components/pane-load-error.tsx')) continue;
    const src = readFileSync(path, 'utf8');
    for (const m of src.matchAll(/<PaneLoadError\b/g)) {
      found++;
      const block = src.slice(m.index, src.indexOf('/>', m.index) + 2);
      const reason = /reason=\{([^}]*)\}/.exec(block);
      if (!reason) continue;
      failures.push({
        where: `${file.slice(ROOT.length + 1)}:${String(src.slice(0, m.index).split('\n').length)}`,
        what: reason[1].replace(/\s+/g, ' ').trim().slice(0, 60),
      });
    }
  }
}

if (found === 0) {
  console.error(
    'check:load-error-reason — found no load-error panes at all. The scan resolved nothing.'
  );
  process.exit(1);
}

if (failures.length > 0) {
  console.error(`\n${String(failures.length)} pane(s) decide for themselves why a load failed:\n`);
  for (const f of failures) {
    console.error(`  ${f.where}`);
    console.error(`      reason={${f.what}}`);
  }
  console.error(
    '\nPass `error` and both sets of words instead. The header of this file says why.\n'
  );
  process.exit(1);
}

console.log(
  `${String(found)} panes say why they could not load, and every one of them asks the one place that knows.`
);
