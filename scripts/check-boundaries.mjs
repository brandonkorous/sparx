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
// named `@wizeworks/db` that Piggles cannot boot without is an unanswered question,
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
const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.turbo',
  'dist',
  '.git',
  'coverage',
  // Runtime media cache (gitignored). It holds downloaded marketplace bundles,
  // so it is full of other people's strings and is not source.
  '.media-tmp',
]);
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.json']);
const BASELINE = path.join(ROOT, 'piggles/docs/migration/sparx-usage-baseline.json');
/** How many sparx sentences Piggles' own console still shows a customer. A
 *  ratchet, not a ban — see `checkOtherBrandProse`. */
const BRAND_LEAK_BASELINE = path.join(ROOT, 'piggles/docs/migration/sparx-prose-baseline.txt');

function readBrandLeakBaseline() {
  try {
    return Number.parseInt(fs.readFileSync(BRAND_LEAK_BASELINE, 'utf8').trim(), 10);
  } catch {
    return 0;
  }
}

/** A reference from one app's tree into the other's. Carried over unchanged. */
const PIGGLES_TO_SPARX = [
  // The alias that started it.
  /@workbench\//,
  // Any path, relative or otherwise, that lands in a sparx tree.
  /['"`][^'"`\n]*\.\.\/sparx\/(apps|packages)\//,
  /['"`]sparx\/(apps|packages)\//,
];

const SPARX_TO_PIGGLES = [/@piggles\//, /['"`][^'"`\n]*piggles\/(apps|packages)\//];

/**
 * RULE 1, live as of the tree move (A4.8).
 *
 * The shared platform may not import from EITHER brand. It was dormant while
 * there was no `wizeworks/` tree to scan, and deliberately unwritten rather than
 * written-and-vacuous — a check that scans a directory which does not exist
 * passes, and that pass is indistinguishable from a real one.
 *
 * This is the rule the whole migration is for. Everything else — the ban, the
 * ratchet, the closure walk — approximates it from one side or the other. Here
 * it is directly: platform code that reaches into a brand is not platform code.
 */
const WIZEWORKS_TO_BRAND = [
  /@piggles\//,
  /@sparx\//,
  /['"`][^'"`\n]*\.\.\/(sparx|piggles)\/(apps|packages)\//,
  /['"`](sparx|piggles)\/(apps|packages)\//,
];

/**
 * Rule 1 exceptions — EMPTY, and the goal is that it stays that way.
 *
 * It briefly held nine files, and what they were is worth remembering because
 * both turned out to be fixable rather than inherent:
 *
 *   · `wizeworks/apps/site`, the tenant site renderer, mounted a fixed
 *     `MadeWithSparx` — so every Piggles business's PUBLIC footer credited
 *     another company and linked their visitors to it. Now `PlatformCredit`,
 *     brand-blind and resolved per tenant from `platform_brand`. It turned out
 *     to need nothing else from `@sparx/brand` at all.
 *   · `wizeworks/apps/admin`, the WizeWorks staff console, took its tokens and
 *     its wordmark from `@sparx/brand` because it had no identity of its own to
 *     wear. It does: the palette locked on 2026-07-30 in
 *     docs/wizeworks/04-brand-and-visual-identity.md, now shipped as
 *     `@wizeworks/brand`. This was never a design decision — it was a lookup
 *     nobody had done.
 *
 * If something has to go back on this list, it goes on by FILE with the reason
 * written beside it. An allowlist, never a softened pattern: "allow
 * @sparx/brand under wizeworks/" would let the next one in silently, where a
 * named file has to be added in a diff somebody reads.
 */
const RULE_1_EXCEPTIONS = new Set([]);

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
 * `@sparx/brand` is a different thing: sparx's marks, mascot and token VALUES.
 * Piggles has `@piggles/brand`, `@piggles/mascot` and `@piggles/ui` of its own,
 * so there is no honest reason to reach for it — and being able to baseline one
 * away is exactly how five sparx-mark render sites survived the fork unnoticed.
 * A count is not a defence when the correct number is zero.
 *
 * It used to be two. The other was sparx's old `ui` package, and it no longer
 * exists under that scope: it was brand-blind apart from four re-exported marks,
 * so the tree move split it into `@wizeworks/ui` (the compositions) with the
 * marks returned to `@sparx/brand/react`, where they had always actually lived.
 * That is why the WizeWorks staff console can depend on it at all.
 */
const BANNED_PACKAGES = new Set(['@sparx/brand']);

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

/**
 * Strip comments, so prose ABOUT the boundary never trips the check on it.
 *
 * A block comment is blanked IN PLACE rather than deleted, because deleting it
 * takes its newlines with it and every line number after it shifts. Reproducing
 * the "Sent with sparx" leak to prove RULE 3 goes red reported it on line 173 of
 * a file where it sits on 199 — 26 lines of header comment above it. Every rule
 * in this file has been reporting shifted numbers.
 */
function code(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((line) => (/^\s*(\/\/|\*|#)/.test(line) ? '' : line.replace(/([^:'"`])\/\/.*$/, '$1')))
    .join('\n');
}

const rel = (file) => path.relative(ROOT, file).replace(/\\/g, '/');

/**
 * RULE 3 — no brand's name in a sentence the shared platform says out loud.
 *
 * wizeworks/CLAUDE.md has listed this among the things `check:boundaries` fails
 * on since the tree move. It did not check it, and the pass was indistinguishable
 * from a real one: "Sent with sparx" survived a documented sweep of 110 brand
 * literals in the footer of every email the OTHER brand's tenants sent, and 97
 * more sentences were still standing when the rule was finally written
 * (piggles/docs/personas/issues/128).
 *
 * ── WHY PROSE AND NOT EVERY LITERAL ─────────────────────────────────────────
 *
 * "Any brand name in any string" is 3,131 hits, and almost all of them are
 * IDENTIFIERS: the hostname `sparx.works`, the database role `sparx_owner`, the
 * staff console's `/sparx/tenants` route, the header `x-sparx-internal-cron-token`,
 * the block namespace `sparx.navbar`, the gateway id `sparx-pay`. Renaming those
 * is a migration, not a fix, and a check that fires on all of them is a check
 * somebody switches off on the second afternoon.
 *
 * What actually reaches a customer is a SENTENCE. So the rule is: the brand
 * standing as its own word, inside a string of four words or more. That is the
 * shape of "sparx cannot read balances from Xero yet" and is not the shape of any
 * identifier, and it is what `{platform}` + `fillPlatformName` exist to fix.
 *
 * Backtick-quoted (`` `sparx` ``) is treated as an identifier being NAMED rather
 * than the platform speaking — which is how an MCP tool description can still
 * tell an AI that the composites live under the `sparx` namespace.
 */
const BRAND_WORDS = ['sparx', 'piggles'];

/** The brand standing alone: not glued into an identifier by a leading word
 *  char / @ / slash / dot / hyphen / backtick, and not the head of a dotted path
 *  (`sparx.works`) or a longer token. A trailing `.` IS allowed — that is a
 *  sentence ending, and "a newer version of sparx." is exactly the leak. */
const BRAND_WORD = new RegExp(
  `(?<![\\w@/_.\`-])(${BRAND_WORDS.join('|')})(?![\\w/_\`-])(?!\\.\\w)`,
  'i'
);

/** Every quoted run on a line, single/double/backtick, without crossing lines. */
const STRING_LITERAL = /(['"`])((?:(?!\1)[^\n])*)\1/g;

/** A sentence, not a slug: four or more words is the floor that separates
 *  "sparx cannot read balances" from "sparx-pay" and "Stock value in sparx". */
const isSentence = (text) => text.trim().split(/\s+/).length >= 4;

/**
 * Files this rule does not read, and why each is not a loophole.
 *
 *   · Tests and fixtures ASSERT brand-resolved output — `expect(name).toBe('sparx
 *     Support')` is the guard working, and failing it would delete the proof.
 *   · `package.json` is npm metadata read by developers and registries, never by
 *     a tenant. (Excluded by extension: this rule reads code, not data.)
 */
const isTestFile = (p) =>
  /(\.test\.|\.spec\.|\/__tests__\/|\/test\/|\/fixtures?\/|-fixtures\.)/.test(p);

const BRAND_PROSE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

/**
 * Named exceptions, by FILE, with the reason beside each — same shape as
 * RULE_1_EXCEPTIONS above and for the same reason: an allowlist entry has to be
 * added in a diff somebody reads, where a softened pattern lets the next one in
 * silently.
 *
 * The bar is "this sentence is ABOUT that brand", not "this sentence is
 * inconvenient to fix". Everything a tenant could read has to be resolved
 * through `platformBrandIdentity` or `{platform}` instead.
 */
const RULE_3_EXCEPTIONS = new Map([
  [
    'wizeworks/packages/db/prisma/seed.ts',
    'Demo content for the development tenant, which IS a sparx tenant. Never runs against a customer database.',
  ],
  [
    'wizeworks/packages/billing/scripts/provision-stripe.ts',
    "Provisions products in sparx's OWN Stripe account. The name is that account's, and another brand provisions its own.",
  ],
  [
    'wizeworks/services/api-rest/src/scripts/verify-self-register-prune.ts',
    'A developer script; the "sparx row" it names is the fixture row it just seeded, printed to a terminal.',
  ],
]);

function checkBrandProse() {
  const problems = [];
  for (const file of walk(path.join(ROOT, 'wizeworks'))) {
    const name = rel(file);
    if (!BRAND_PROSE_EXTENSIONS.has(path.extname(file))) continue;
    if (isTestFile(name) || RULE_3_EXCEPTIONS.has(name)) continue;
    const source = code(fs.readFileSync(file, 'utf8'));
    source.split('\n').forEach((line, index) => {
      for (const match of line.matchAll(STRING_LITERAL)) {
        const text = match[2];
        if (!isSentence(text) || !BRAND_WORD.test(text)) continue;
        problems.push(`${name}:${index + 1}: ${text.trim().slice(0, 110)}`);
      }
    });
  }
  if (problems.length) {
    console.error(`\n✖ a brand's name in the shared platform's own words — ${problems.length}:\n`);
    for (const problem of problems) console.error('   ' + problem);
    console.error(
      `\n   wizeworks/ serves every brand from one deployment, so a sentence with a\n` +
        `   product's name baked in is right for one tenant and wrong for the other.\n` +
        `   Resolve it: platformBrandIdentity(brand).name where a tenant is in scope,\n` +
        `   or {platform} + fillPlatformName for data declared at module scope.\n`
    );
  }
  return problems.length;
}

/** Only sparx. Piggles naming itself inside its own tree is the product
 *  speaking; naming the OTHER brand is the leak. */
const OTHER_BRAND = /(?<![\w@/_.`-])(sparx)(?![\w/_`-])(?!\.\w)/i;

/**
 * The same rule as `checkBrandProse`, pointed at the other tree — and a ratchet
 * rather than a ban, for the reason below.
 *
 * `checkBrandProse` walks `wizeworks/` only, so a sentence naming sparx inside
 * PIGGLES' OWN CONSOLE has never been looked at by anything. That is how a
 * Piggles owner came to read "Not payroll — sparx hands the hours to whoever
 * runs yours" on her own team screen (issue 180), and it is issue 128 repeated
 * one tree over: prose said a guard was watching, and the guard was walking a
 * different directory.
 *
 * A ratchet, because a large share of these are not string edits. sparx Pay,
 * sparx.market and the sparx marketplace are sparx PRODUCTS, and piggles/
 * CLAUDE.md is explicit that they are EXCLUDED from Piggles rather than renamed
 * — "Piggles Pay" is a product nobody can sign up for, which is worse than the
 * leak because now nothing looks wrong. Removing a surface is a change with a
 * scope of its own; a hard failure would price that work into every unrelated
 * push until somebody switched the check off.
 *
 * So the number can only fall. Nothing new leaks in while the removals are
 * sequenced.
 */
function countOtherBrandProse() {
  const problems = [];
  for (const file of walk(path.join(ROOT, 'piggles'))) {
    const name = rel(file);
    if (!BRAND_PROSE_EXTENSIONS.has(path.extname(file))) continue;
    if (isTestFile(name) || name.startsWith('piggles/docs/')) continue;
    const source = code(fs.readFileSync(file, 'utf8'));
    source.split('\n').forEach((line, index) => {
      for (const match of line.matchAll(STRING_LITERAL)) {
        // Backticked text is an identifier being NAMED, same carve-out as above.
        if (match[1] === '`') continue;
        const text = match[2];
        if (!isSentence(text) || !OTHER_BRAND.test(text)) continue;
        problems.push(`${name}:${index + 1}: ${text.trim().slice(0, 110)}`);
      }
    });
  }
  return problems;
}

function checkOtherBrandProse(leaks, update) {
  const baseline = readBrandLeakBaseline();
  if (update) {
    fs.writeFileSync(BRAND_LEAK_BASELINE, `${String(leaks.length)}\n`);
    console.log(`updated the sparx-in-piggles baseline to ${String(leaks.length)}`);
    return 0;
  }
  if (leaks.length <= baseline) {
    const fell = leaks.length < baseline ? ` (was ${String(baseline)} — down)` : '';
    console.log(`✓ sparx sentences under piggles/: ${String(leaks.length)}${fell}`);
    return 0;
  }
  console.error(
    `\n✖ another brand's name in Piggles' own words — ${String(leaks.length)}, baseline ${String(baseline)}:\n`
  );
  for (const leak of leaks) console.error('   ' + leak);
  console.error(
    `\n   A Piggles customer is reading another company's product name.\n` +
      `   A sparx PRODUCT (sparx Pay, sparx.market) is EXCLUDED from Piggles, never\n` +
      `   renamed — hiddenSurfaces / hiddenFeatures in lib/product.ts. Everything\n` +
      `   else takes Piggles' own words.\n` +
      `   This number may only fall.\n`
  );
  return leaks.length - baseline;
}

function scan(root, patterns, label, exceptions) {
  const problems = [];
  for (const file of walk(path.join(ROOT, root))) {
    if (exceptions?.has(rel(file))) continue;
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
 * Not a ban, because a ban on `@wizeworks/query` would fail on day one of a
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
failures += scan('sparx', SPARX_TO_PIGGLES, 'sparx/ reaches into piggles/');
failures += scan(
  'wizeworks',
  WIZEWORKS_TO_BRAND,
  'wizeworks/ reaches into a BRAND tree',
  RULE_1_EXCEPTIONS
);
// The ban runs even under --update-baseline. A brand leak is never something a
// regenerate should be able to absorb, and the whole reason this rule exists is
// that five of them survived the fork by being invisible.
failures += checkBanned(banned);
failures += checkBrandProse();
failures += checkOtherBrandProse(countOtherBrandProse(), update);
failures += checkRatchet(counts, update, banned);

// Rule 1 (WIZEWORKS_TO_BRAND) and rule 3 (checkBrandProse) are both LIVE. The
// hex rule the same paragraph claimed is NOT, and the inventory is why: 1,049
// literal hexes live under wizeworks/, and the overwhelming majority are the
// theme system DEFINING its tokens, the email palette (mail clients cannot
// resolve a custom property) and document renderers — all places a hex is the
// only thing that can be written. The rule as stated fires on every one of them.
// What it was reaching for is root RULE #1, which is about feature code PAINTING
// a control, and that lives in the ESLint rule and in review. wizeworks/CLAUDE.md
// now says three rules because there are three.

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
