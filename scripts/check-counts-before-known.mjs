// Fails when a pane toolbar prints a COUNT it has not taken yet.
//
// The shape:
//
//   const rows = data?.items ?? [];
//   …
//   <PaneToolbar
//     status={<Text>{rows.length === 0 ? 'No mailbox connected yet' : …}</Text>}
//
// While the query is in flight `rows` is empty, so the bar states a confident
// ZERO over a pane that is still loading: "0 messages", "No dashboards yet",
// "No mailbox connected yet". On a FAILED read it states it forever, over a
// body that is explaining the server could not be reached — the same defect the
// activity feed already fixed inside its content region and not in its bar.
//
// A count is a measurement, and an absence must never wear a measurement's
// clothes. [[feedback_never_present_absence_as_measurement]]
//
// MEASURED 2026-09-25, when this was written: 225 toolbars carry a status slot,
// 43 of them print a count off an array with a `?? []` fallback, and 41 of those
// were unguarded. Both consoles.
//
// ── WHAT COUNTS AS GUARDED ──────────────────────────────────────────────────
//
// Three things, and the third is why this check is not just a grep:
//
//   `statusReady={!q.isPending}`   the bar keeps its counsel until it knows
//   the status block reads a       a pane that decides for itself, like
//   pending flag itself            crm/duplicates' "Checking…"
//   the count is only shown        `rows.length > 0 ? <Badge/> : null` states
//   when it is above zero          nothing at zero, so it states nothing wrong
//
// That last one is a real and common pattern — five panes use it — and reporting
// it would be pushing correct code to change. A scan that cannot tell a right
// answer from a wrong one is worse than no scan.
//
// Zero dependencies on purpose: CI runs it with bare Node, no install.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

function repoRoot() {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  die(['✖ counts: repo root not found (no pnpm-workspace.yaml above this script)']);
}

function die(lines) {
  console.error(lines.join('\n'));
  process.exit(1);
}

const ROOT = repoRoot();
const CONSOLES = [
  join(ROOT, 'piggles', 'apps', 'workbench', 'surfaces'),
  join(ROOT, 'sparx', 'apps', 'workbench', 'surfaces'),
];

function files(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files(full, out);
    else if (full.endsWith('.tsx') && !full.includes('.test.')) out.push(full);
  }
  return out;
}

/** The `status={…}` attribute of a PaneToolbar, by brace matching. */
function statusAttr(source) {
  const at = source.indexOf('status={');
  if (at < 0) return null;
  let depth = 0;
  for (let i = at + 'status='.length; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(at, i + 1);
    }
  }
  // An unbalanced attribute means the parse failed, not that the file is fine.
  return null;
}

const COUNT = /\b(\w+)\.length\b/g;
const PENDING_IN_BLOCK = /isPending|isLoading|!ready\b|ready \?/;
/** `rows.length > 0 ? … : null` — nothing is claimed when there is nothing. */
const ONLY_WHEN_SOME = /\b\w+\.length\s*>\s*0\s*\?/;

let scanned = 0;
let counting = 0;
let guarded = 0;
const offenders = [];

for (const root of CONSOLES) {
  // A scan root that stopped existing is how a check goes blind and prints a
  // tick over nothing. [[feedback_structural_checks_go_blind]]
  if (!existsSync(root)) die([`✖ counts: scan root missing: ${root}`]);
  for (const file of files(root)) {
    const source = readFileSync(file, 'utf8');
    if (!source.includes('<PaneToolbar')) continue;
    const block = statusAttr(source);
    if (!block) continue;
    scanned += 1;

    const counted = [...block.matchAll(COUNT)].map((m) => m[1]);
    if (counted.length === 0) continue;
    // Only arrays that START EMPTY can lie. A count off a number the server
    // sent, or off a constant list, is known the moment it is rendered.
    const canBeEmpty = counted.some((name) =>
      new RegExp(`(const|let)\\s+${name}\\b[^=\\n]*=\\s*[^;]*\\?\\?\\s*\\[\\]`, 's').test(source)
    );
    if (!canBeEmpty) continue;
    counting += 1;

    if (
      source.includes('statusReady=') ||
      PENDING_IN_BLOCK.test(block) ||
      ONLY_WHEN_SOME.test(block)
    ) {
      guarded += 1;
      continue;
    }
    offenders.push({
      rel: relative(ROOT, file).split('\\').join('/'),
      counted: [...new Set(counted)].join(', '),
    });
  }
}

if (scanned < 150) {
  die([
    `✖ counts: only ${String(scanned)} toolbars with a status slot were found.`,
    '',
    '   There were 225 when this check was written. Either the trees moved or',
    '   the parse is broken. Fix it rather than believing the tick.',
  ]);
}
if (counting < 30) {
  die([
    `✖ counts: only ${String(counting)} of them print a count off an array that starts empty.`,
    '',
    '   There were 43. The shape this check exists for has stopped being',
    '   recognised, which is not the same as it having stopped happening.',
  ]);
}

if (offenders.length > 0) {
  die([
    offenders.length === 1
      ? '✖ counts: 1 toolbar states a count before the read has landed'
      : `✖ counts: ${String(offenders.length)} toolbars state a count before the read has landed`,
    '',
    ...offenders.map(
      (o) =>
        `  ${o.rel}\n` +
        `     status prints ${o.counted}.length, which is [] until the query answers,\n` +
        `     so the bar says zero over a pane that is still loading — and keeps\n` +
        `     saying it if the read fails.\n` +
        `     Add statusReady={!<query>.isPending} (and statusFailed) to <PaneToolbar>.`
    ),
  ]);
}

console.log(
  `✓ counts: ${String(counting)} toolbars print a count that starts empty, and all ` +
    `${String(guarded)} of them wait until it is known (${String(scanned)} status slots across both consoles).`
);
