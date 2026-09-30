#!/usr/bin/env node
/**
 * Fails if a mutation that RUNS something calls itself a save.
 *
 * ---------------------------------------------------------------------------
 * The problem this exists for
 * ---------------------------------------------------------------------------
 *
 * When a write fails, the console shows a toast that stays until dismissed,
 * because the screen still shows the change as though it landed. That toast can
 * name the thing: `WriteMeta.writing` is read by write-failure-reporter.tsx and
 * turns "That didn't save" into "Couldn't save your invoice".
 *
 * MEASURED 2026-09-19: 712 mutations in the piggles console and 699 in sparx.
 * The number that set `writing` was ZERO. In both. The named branch had never
 * run once, and the generic fallback looked like the design rather than the
 * thing that happens when nobody filled the field in.
 *
 * The other half was worse. 14 of those mutations do not save anything of hers
 * at all - re-running the stock check, recomputing reorder points, previewing a
 * file, re-scoring pages. Two things followed from that going unmarked:
 *
 *   - the status bar's "Saved just now" clock moved for them. That clock is the
 *     answer to "did my work make it?", so a check she ran after a save that
 *     silently failed answered it yes.
 *   - their failure read "That didn't save", which sends a person looking for
 *     lost work that was never at risk.
 *
 * `WriteMeta.running` is that half: a verb phrase in her words, so the toast
 * reads "Couldn't check your stock" and the Saved clock stays where it was.
 *
 * ---------------------------------------------------------------------------
 * The rule
 * ---------------------------------------------------------------------------
 *
 * A `useMutation` whose request path ends in an ACTION verb must set
 * `meta: { running: '...' }`.
 *
 * The verbs are the ones that name work rather than a record: preview,
 * preview-count, recompute, reindex, refresh-promises, checkout, credentials/
 * test. Two nouns join them - reconciliation and runs - because they name the
 * JOB rather than a record, and the first draft of this check went green over
 * both, one of which was the mutation the whole thing was written for. A path
 * ending in a noun for a THING (`/v1/commerce/products`) is a save and is not
 * this check's business.
 *
 * Deliberately scoped to the MUTATION BLOCK, not the file. A surface file holds
 * a dozen hooks and most of them are ordinary saves; a file-level rule would go
 * green as soon as any one of them was named.
 *
 * Deliberately NOT a rule that every mutation must set `writing`. 1,411 of them
 * do not, each needs a human sentence, and a check nobody can make green is a
 * check somebody turns off. That sweep is issue 705.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** The trees this scans. Each one is ASSERTED to exist: a check that silently
 *  scans nothing after a directory move prints a green tick over no work at
 *  all, which is worse than no check. */
const TREES = ['piggles/apps/workbench', 'sparx/apps/workbench'];

const missing = TREES.filter((t) => !existsSync(join(ROOT, t)));
if (missing.length > 0) {
  console.error('check-running-meta: these scan roots do not exist:');
  for (const t of missing) console.error(`  ${t}`);
  console.error('\nThe paths moved. Update TREES, or this check scans nothing and passes.');
  process.exit(1);
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'dist' || name === '.turbo') {
      continue;
    }
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) yield full;
  }
}

/** A request path that names WORK rather than a record.
 *
 *  The verb list is the honest part of this rule and the reason it is written
 *  as a suffix: `…/recompute` is work whoever adds it next, while
 *  `…/products` is a record. The two entries after the verbs are paths that
 *  name work WITHOUT a verb - a noun for the job itself - and they are here
 *  because the first draft of this check went green over both of them,
 *  including the very mutation it was written for. A rule that cannot catch its
 *  own worked example is not a rule yet. */
const ACTION_PATH = new RegExp(
  "'/v1/[^']*/(?:" +
    [
      'preview',
      'preview-count',
      'recompute',
      'reindex',
      'refresh-promises',
      'checkout',
      'credentials/test',
    ].join('|') +
    '|' +
    ['reconciliation', 'runs'].join('|') +
    ")'"
);

/** The body of one `useMutation({ ... })`, by brace depth. Ends at its own
 *  closing brace, so the next hook in the file is never read as part of it. */
function mutationBlocks(src) {
  const blocks = [];
  for (const open of src.matchAll(/useMutation(?:<[^>]*>)?\(\{/g)) {
    let depth = 1;
    let i = open.index + open[0].length;
    while (i < src.length && depth > 0) {
      const ch = src[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      i += 1;
    }
    blocks.push({ at: open.index, body: src.slice(open.index, i) });
  }
  return blocks;
}

let scanned = 0;
let mutations = 0;
let actions = 0;
const offences = [];

for (const tree of TREES) {
  const base = join(ROOT, tree);
  for (const file of walk(base)) {
    const rel = relative(base, file).split(sep).join('/');
    scanned += 1;
    const src = readFileSync(file, 'utf8');
    if (!src.includes('useMutation')) continue;
    for (const block of mutationBlocks(src)) {
      mutations += 1;
      if (!ACTION_PATH.test(block.body)) continue;
      actions += 1;
      if (/\brunning:\s*'/.test(block.body)) continue;
      const line = src.slice(0, block.at).split('\n').length;
      const path = ACTION_PATH.exec(block.body)?.[0] ?? '?';
      offences.push({ where: `${tree}/${rel}:${line}`, path });
    }
  }
}

console.log(
  `check-running-meta: ${String(scanned)} files, ${String(mutations)} mutations, ` +
    `${String(actions)} of them actions, across ${String(TREES.length)} consoles.`
);

if (offences.length > 0) {
  console.error(`\n${String(offences.length)} action mutation(s) with no name to fail under:\n`);
  for (const o of offences) {
    console.error(`  ${o.where}`);
    console.error(`      ${o.path}`);
  }
  console.error(
    "\nAdd `meta: { running: '<verb phrase in her words>' }` so the failure toast\n" +
      'reads "Couldn\'t check your stock" instead of "That didn\'t save", and so the\n' +
      'status bar does not tell her work was saved when none of hers was.\n'
  );
  process.exit(1);
}

console.log('Every action mutation names what it was doing.');
