#!/usr/bin/env node
/**
 * Fails if a new migration drops a database object BY A NAME NOTHING EVER CREATED.
 *
 * ---------------------------------------------------------------------------
 * The problem this exists for
 * ---------------------------------------------------------------------------
 *
 * `DROP INDEX IF EXISTS "some_name"` succeeds whether or not `some_name` is
 * there. That is the whole point of `IF EXISTS`, and it is what makes a typo in
 * the name completely silent: the statement runs, the migration applies, the
 * release goes green, and the constraint the author meant to remove is still on
 * the table.
 *
 * MEASURED 2026-09-22. `20261221000000_billing_documents_per_site` set out to
 * turn "one default print template per tenant" into "one per site", and wrote:
 *
 *     DROP INDEX IF EXISTS "billing_document_templates_one_default_per_tenant";
 *
 * The index created eight migrations earlier is named
 * `billing_document_templates_tenant_default_unique`. Nothing has ever been
 * called `..._one_default_per_tenant`, so the drop removed nothing, the
 * tenant-wide UNIQUE survived beside the new per-site one, and the stricter of
 * the two wins: a tenant with seven sites could hold exactly one default
 * letterhead across all of them. The column, the index, the Prisma comment and
 * the migration's own prose all described per-site letterheads. One misspelled
 * name was the difference, and every check in the repository was green over it.
 * [[feedback_absent_behaves_like_fine]]
 *
 * ---------------------------------------------------------------------------
 * The rule
 * ---------------------------------------------------------------------------
 *
 * A `DROP <kind> IF EXISTS <name>` in a NEW migration must name something the
 * migration tree creates at or before that migration. Renames are tracked, so
 * dropping a renamed object by its new name is fine.
 *
 * Only newly-added migrations are checked, exactly as check-migration-order.mjs
 * does, and for the same reason: an applied migration's directory name is a
 * primary key in `_prisma_migrations` on every deployed database and its body is
 * checksummed, so history cannot be edited to satisfy a check. Two historical
 * misses are known and are recorded in
 * piggles/docs/personas/issues/777-a-letterhead-could-not-belong-to-one-business.md.
 *
 * Usage:  node scripts/check-migration-drops.mjs [baseRef]
 *         baseRef defaults to origin/main.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS = 'wizeworks/packages/db/prisma/migrations';

const baseRef = process.argv[2] || 'origin/main';

function git(args, { allowFailure = false } = {}) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    if (allowFailure) return '';
    throw error;
  }
}

/** Migration directory names present at a ref. Empty when the ref has no such
 *  path — the caller decides whether that is fatal. */
function migrationsAt(ref) {
  return git(['ls-tree', '--name-only', `${ref}:${MIGRATIONS}`], { allowFailure: true })
    .split('\n')
    .map((line) => line.replace(/\/$/, '').trim())
    .filter((name) => name && name !== 'migration_lock.toml');
}

// ── What each migration CREATES, and what it DROPS ──────────────────────────
//
// Both halves read the checked-out tree, in Prisma's own order (lexicographic by
// directory name), so a drop is only ever compared against names that exist by
// the time it runs. A later migration creating the name does not excuse an
// earlier migration dropping it.

/** Every regex that mints a name. `CREATE` in all the forms this tree uses, plus
 *  the two renames, which give an existing object a second name. */
const CREATES = [
  /CREATE\s+(?:UNIQUE\s+)?INDEX(?:\s+CONCURRENTLY)?(?:\s+IF\s+NOT\s+EXISTS)?\s+"?([A-Za-z0-9_]+)"?/gi,
  /ADD\s+CONSTRAINT\s+"?([A-Za-z0-9_]+)"?/gi,
  /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+"?([A-Za-z0-9_]+)"?/gi,
  /CREATE\s+(?:OR\s+REPLACE\s+)?(?:MATERIALIZED\s+)?VIEW(?:\s+IF\s+NOT\s+EXISTS)?\s+"?([A-Za-z0-9_]+)"?/gi,
  /CREATE\s+POLICY\s+"?([A-Za-z0-9_]+)"?/gi,
  /CREATE\s+TYPE\s+"?([A-Za-z0-9_]+)"?/gi,
  /CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+"?([A-Za-z0-9_]+)"?/gi,
  /RENAME\s+(?:CONSTRAINT|COLUMN)\s+"?[A-Za-z0-9_]+"?\s+TO\s+"?([A-Za-z0-9_]+)"?/gi,
  /ALTER\s+INDEX\s+"?[A-Za-z0-9_]+"?\s+RENAME\s+TO\s+"?([A-Za-z0-9_]+)"?/gi,
];

/** Every `DROP … IF EXISTS <name>` whose name is checkable. FUNCTION is absent on
 *  purpose: it is dropped by argument signature, not by a bare name. */
const DROPS = [
  /DROP\s+(INDEX)(?:\s+CONCURRENTLY)?\s+IF\s+EXISTS\s+"?([A-Za-z0-9_]+)"?/gi,
  /DROP\s+(CONSTRAINT)\s+IF\s+EXISTS\s+"?([A-Za-z0-9_]+)"?/gi,
  /DROP\s+(POLICY)\s+IF\s+EXISTS\s+"?([A-Za-z0-9_]+)"?/gi,
  /DROP\s+(TABLE)\s+IF\s+EXISTS\s+"?([A-Za-z0-9_]+)"?/gi,
  /DROP\s+(VIEW)\s+IF\s+EXISTS\s+"?([A-Za-z0-9_]+)"?/gi,
  /DROP\s+(TYPE)\s+IF\s+EXISTS\s+"?([A-Za-z0-9_]+)"?/gi,
  /DROP\s+(TRIGGER)\s+IF\s+EXISTS\s+"?([A-Za-z0-9_]+)"?/gi,
];

/**
 * The migration with its comments removed.
 *
 * Load-bearing, because these migrations explain themselves at length and a
 * comment quoting the statement it is about — "it wrote: DROP INDEX IF EXISTS
 * …" — is prose, not SQL. Read literally it makes a migration fail its own
 * check for a drop it never performs. String literals are left alone: a
 * database object name inside quotes is still a name.
 */
function stripComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
}

function namesFrom(sql, patterns) {
  const found = [];
  for (const pattern of patterns) {
    // A fresh RegExp per pass: these literals carry /g, so lastIndex would
    // persist between files and skip matches in the next one.
    for (const match of sql.matchAll(new RegExp(pattern.source, pattern.flags))) {
      found.push(match.length > 2 ? { kind: match[1], name: match[2] } : { name: match[1] });
    }
  }
  return found;
}

const dirs = readdirSync(MIGRATIONS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (dirs.length === 0) {
  console.error(`No migrations found under ${MIGRATIONS} — is the path still right?`);
  process.exit(1);
}

const base = migrationsAt(baseRef);
if (base.length === 0) {
  console.error(
    `No migrations found at ${baseRef}:${MIGRATIONS}. This check only inspects migrations ADDED\n` +
      `against the base ref, so with nothing to compare against it can only report a false pass —\n` +
      `refusing to. Check the ref exists and is fetched (CI needs fetch-depth: 0).`
  );
  process.exit(1);
}
const baseSet = new Set(base);

const created = new Set();
const problems = [];
let checked = 0;

for (const dir of dirs) {
  let sql = '';
  try {
    sql = stripComments(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
  } catch {
    // A directory with no migration.sql is not this check's business.
    continue;
  }

  // Drops are read against the names created BEFORE this migration, so they are
  // resolved first; then this migration's own creations join the set.
  if (!baseSet.has(dir)) {
    checked += 1;
    for (const drop of namesFrom(sql, DROPS)) {
      if (created.has(drop.name)) continue;
      problems.push(
        `NAMES NOTHING  ${dir}\n` +
          `               DROP ${drop.kind} IF EXISTS ${drop.name}\n` +
          `               No migration up to this point creates "${drop.name}", so this\n` +
          `               statement removes nothing and says nothing. Whatever it was\n` +
          `               meant to remove is still on the table after the release.\n` +
          `               Check the spelling against the CREATE that made it.`
      );
    }
  }

  for (const made of namesFrom(sql, CREATES)) created.add(made.name);
}

if (problems.length > 0) {
  console.error(`\nMigration drop-name check FAILED (base: ${baseRef})\n`);
  for (const problem of problems) {
    console.error(
      problem
        .split('\n')
        .map((line) => `  ${line}`)
        .join('\n') + '\n'
    );
  }
  console.error(`  See wizeworks/packages/db/CLAUDE.md for the migration conventions.\n`);
  process.exit(1);
}

console.log(
  checked === 0
    ? `OK: no migrations added (${dirs.length} in the tree, ${created.size} names created).`
    : `OK: ${checked} migration(s) added, every IF EXISTS drop names something real ` +
        `(${created.size} names created across ${dirs.length} migrations).`
);
