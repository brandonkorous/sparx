#!/usr/bin/env node
// The dependency invariant, enforced.
//
// Replaces check-piggles-isolation.mjs, whose rationale said this:
//
//     What is ALLOWED, deliberately: `@sparx/*` package imports. Those are
//     libraries under packages/, not the sparx application.
//
// That defended the right boundary for the question it was asked — "does Piggles
// import sparx's app code?" — and the wrong one for the question that matters:
// **can sparx be deleted without affecting Piggles?** Under the second, a package
// named `@sparx/db` that Piggles cannot boot without is an unanswered question,
// not a pass. So the app-crossing rules below are carried over verbatim, and a
// third rule counts the scope usage and refuses to let it grow.
//
// Plan, phases and the baseline's meaning: piggles/docs/migration/.
//
// Pure Node, no dependencies, same family as check:events / check:routes /
// check:docker. Runs in CI and in the pre-push guard.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['node_modules', '.next', '.turbo', 'dist', '.git', 'coverage']);
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.json']);
const BASELINE = path.join(ROOT, 'piggles/docs/migration/sparx-usage-baseline.json');

/** A reference from one app's tree into the other's. Carried over unchanged. */
const PIGGLES_TO_SPARX = [
  // The alias that started it.
  /@workbench\//,
  // Any path, relative or otherwise, that lands in an app directory.
  /['"`][^'"`\n]*\.\.\/apps\/(workbench|web|site|market|admin)\//,
  /['"`]apps\/(workbench|web|site|market|admin)\//,
];

const SPARX_TO_PIGGLES = [/@piggles\//, /['"`][^'"`\n]*piggles\/(apps|packages)\//];

/** The scope itself, in an import or a dependency key — the thing being retired. */
const SPARX_SCOPE = /@sparx\/[a-z0-9-]+/g;

/**
 * The two that may NEVER appear, at any count, with no baseline escape.
 *
 * The ratchet below is the right instrument for the other thirty-odd packages:
 * they are brand-blind platform code, the rename is mechanical, and every new
 * Piggles pane legitimately reaches for the query layer and the API client — so
 * a hard ban there would fire constantly and get switched off by the second
 * afternoon.
 *
 * These two are a different thing. `@sparx/brand` is sparx's marks, mascot and
 * token VALUES; `@sparx/ui` is its compositions. Piggles has `@piggles/brand`,
 * `@piggles/mascot` and `@piggles/ui` of its own, so there is no honest reason
 * to reach for either — and being able to baseline one away is exactly how the
 * five sparx-mark render sites survived the fork unnoticed. A count is not a
 * defence when the correct number is zero.
 */
const BANNED_PACKAGES = new Set(['@sparx/brand', '@sparx/ui']);

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (EXTENSIONS.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

/** Strip comments, so prose ABOUT the boundary never trips the check on it. */
function code(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => (/^\s*(\/\/|\*|#)/.test(line) ? '' : line.replace(/([^:'"`])\/\/.*$/, '$1')))
    .join('\n');
}

const rel = (file) => path.relative(ROOT, file).replace(/\\/g, '/');

function scan(root, patterns, label) {
  const problems = [];
  for (const file of walk(path.join(ROOT, root))) {
    const source = code(fs.readFileSync(file, 'utf8'));
    source.split('\n').forEach((line, index) => {
      if (patterns.some((pattern) => pattern.test(line))) {
        problems.push(`${rel(file)}:${index + 1}: ${line.trim().slice(0, 120)}`);
      }
    });
  }
  if (problems.length) {
    console.error(`\n✖ ${label} — ${problems.length} reference(s):\n`);
    for (const problem of problems) console.error('   ' + problem);
  }
  return problems.length;
}

/**
 * Count `@sparx/*` usage in piggles' CODE, per package.
 *
 * Two exclusions, both load-bearing:
 *
 *   · Comments are stripped, so a paragraph explaining WHY a dependency is being
 *     retired does not count as one. Otherwise documenting the migration would
 *     push the number up and the ratchet would punish the write-up.
 *   · `piggles/docs/` is skipped entirely. It holds this migration's own notes —
 *     including the baseline file, which names every package and would therefore
 *     count itself, incrementing all 21 counts on the first re-run.
 */
const isCounted = (file) => !rel(file).startsWith('piggles/docs/');

function countScopeUsage() {
  const counts = {};
  const banned = [];
  for (const file of walk(path.join(ROOT, 'piggles')).filter(isCounted)) {
    const source = code(fs.readFileSync(file, 'utf8'));
    source.split('\n').forEach((line, index) => {
      for (const match of line.matchAll(SPARX_SCOPE)) {
        counts[match[0]] = (counts[match[0]] ?? 0) + 1;
        if (BANNED_PACKAGES.has(match[0])) {
          banned.push(`${rel(file)}:${index + 1}: ${line.trim().slice(0, 120)}`);
        }
      }
    });
  }
  return { counts, banned };
}

/** The hard half: zero tolerance, no baseline, no argument. */
function checkBanned(banned) {
  if (banned.length === 0) return 0;
  console.error(`\n✖ piggles/ reaches for another brand's identity — ${banned.length}:\n`);
  for (const line of banned) console.error('   ' + line);
  console.error(
    `\n   Piggles has @piggles/brand, @piggles/mascot and @piggles/ui.\n` +
      `   There is no --update-baseline for this one.\n`
  );
  return banned.length;
}

/**
 * The soft half — a ratchet over the brand-blind packages.
 *
 * Not a ban, because a ban on `@sparx/query` would fail on day one of a
 * migration that takes weeks and be switched off by the second afternoon: every
 * new Piggles pane legitimately reaches for the data layer, so the number rises
 * whenever anybody builds anything. What a ratchet buys is a floor — the total
 * cannot drift UP unnoticed while thirty things are in flight.
 *
 * `--update-baseline` rewrites the file. Legitimate after a phase lands, or when
 * concurrent work adds a surface. NOT legitimate as a way to make red go green:
 * if you cannot name the capability an increment bought, undo the import.
 *
 * The packages where the correct answer is zero are handled by `checkBanned`
 * instead, and deliberately cannot be baselined at all.
 */
function checkRatchet(counts, update, banned) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  // A regenerate must not persist a snapshot taken while a brand leak is in the
  // tree: the file would then record the leak as the accepted floor, and the
  // next run would pass the ratchet while the ban still failed. Refuse to write
  // and let the ban be the only thing the operator sees.
  if (update && banned.length > 0) {
    console.error('   Baseline NOT written — fix the leak above, then regenerate.\n');
    return 0;
  }

  if (update || !fs.existsSync(BASELINE)) {
    const payload = {
      note: 'Ratchet for piggles/docs/migration phase A0. Counts of `@sparx/*` references under piggles/, comments excluded. These may only go DOWN. Regenerate with `pnpm check:boundaries --update-baseline` after a phase lands.',
      total,
      packages: Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))),
    };
    fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
    fs.writeFileSync(BASELINE, JSON.stringify(payload, null, 2) + '\n');
    console.log(`✓ baseline written — ${total} @sparx/* reference(s) under piggles/`);
    return 0;
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const risen = [];
  const added = [];
  for (const [pkg, count] of Object.entries(counts)) {
    const was = baseline.packages[pkg];
    if (was === undefined) added.push(`${pkg} (${count}) — a NEW dependency on the retiring scope`);
    else if (count > was) risen.push(`${pkg}: ${was} → ${count}`);
  }

  if (added.length || risen.length) {
    console.error(`\n✖ @sparx/* usage under piggles/ has grown:\n`);
    for (const line of [...added, ...risen]) console.error('   ' + line);
    return added.length + risen.length;
  }

  const fell = Object.entries(baseline.packages).filter(
    ([pkg, was]) => (counts[pkg] ?? 0) < was
  ).length;
  console.log(
    `✓ @sparx/* under piggles/: ${total} (baseline ${baseline.total})` +
      (fell
        ? ` — ${fell} package(s) below baseline; run --update-baseline to lock the gain in`
        : '')
  );
  return 0;
}

const update = process.argv.includes('--update-baseline');
const { counts, banned } = countScopeUsage();

let failures = 0;
failures += scan('piggles', PIGGLES_TO_SPARX, 'piggles/ reaches into a sparx APP');
failures += scan('apps', SPARX_TO_PIGGLES, 'apps/ reaches into piggles/');
// The ban runs even under --update-baseline. A brand leak is never something a
// regenerate should be able to absorb, and the whole reason this rule exists is
// that five of them survived the fork by being invisible.
failures += checkBanned(banned);
failures += checkRatchet(counts, update, banned);

// Rules 1, 3 and 4 from wizeworks/CLAUDE.md — no import from wizeworks/ into a
// brand tree, no literal hex under wizeworks/, no brand name in a user-facing
// string there — are DORMANT until phase A4 creates that tree. They are not
// written yet on purpose: a check that scans a directory which does not exist
// passes vacuously, and a vacuous pass is indistinguishable from a real one.

if (failures > 0) {
  console.error(
    '\nPiggles and sparx are separate applications, and the platform belongs to\n' +
      'neither. Either product must be deletable without breaking the other.\n' +
      '\nNeither may import the other’s app code — if both need the same fix,\n' +
      'make it twice; that cost is smaller than the coupling.\n' +
      '\nAnd `@sparx/*` is a RETIRING scope: those packages are brand-blind platform\n' +
      'code that was named before there was a second brand, and they are being\n' +
      'renamed to `@wizeworks/*`. Do not add a new dependency on it from piggles/.\n' +
      'See piggles/docs/migration/.\n'
  );
  process.exit(1);
}

console.log('✓ boundaries hold');
