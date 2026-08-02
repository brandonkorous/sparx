#!/usr/bin/env node
/**
 * Fails if a new Prisma migration would apply OUT OF ORDER.
 *
 * ---------------------------------------------------------------------------
 * The problem this exists for
 * ---------------------------------------------------------------------------
 *
 * Prisma orders migrations LEXICOGRAPHICALLY by directory name and records each
 * one it has applied in `_prisma_migrations`. It does not sort by file mtime,
 * by git history, or by anything else — the name IS the order.
 *
 * The timestamp prefixes in this repository are hand-authored and have drifted
 * roughly six months AHEAD of real time: `20270131000000_silica_class_vocabulary`
 * was committed on 2026-07-31. That is fine on its own — the sequence is
 * internally consistent and every one of the 241 applied migrations sorts
 * correctly against its neighbours.
 *
 * It stops being fine the moment someone runs `prisma migrate dev`, which stamps
 * the REAL clock. Today that produces `20260802…`, which sorts BEFORE all 241
 * migrations already applied in production. Prisma then sees a migration in the
 * folder that it has never applied, sitting earlier in the order than migrations
 * it HAS — and `migrate deploy` fails on the drift rather than applying it,
 * mid-release, having already taken the roles Job. Locally, `migrate dev` offers
 * to reset the database instead.
 *
 * There is no way to "fix" the drift by renaming: the directory name is the
 * primary key in `_prisma_migrations` on every deployed database, so renaming
 * 241 directories makes Prisma treat all of them as brand-new migrations and
 * re-run them against a schema they have already been applied to. The drift is
 * permanent, and the only sound response is to keep the sequence MONOTONIC and
 * enforce it here.
 *
 * ---------------------------------------------------------------------------
 * The rule
 * ---------------------------------------------------------------------------
 *
 * A migration added by this change must sort AFTER every migration that already
 * existed. That is the whole invariant, and it is the one Prisma actually
 * depends on.
 *
 * In practice: take the newest directory name on the base branch and pick a
 * bigger one. `pnpm --filter @sparx/db exec prisma migrate dev --create-only`
 * then rename, or author the directory by hand — both are normal here, since
 * the RLS policies are hand-edited SQL that Prisma cannot generate anyway.
 *
 * Usage:  node scripts/check-migration-order.mjs [baseRef]
 *         baseRef defaults to origin/main.
 */
import { execFileSync } from 'node:child_process';

const MIGRATIONS = 'packages/db/prisma/migrations';
const NAME_RE = /^\d{14}_[a-z0-9_]+$/;

const baseRef = process.argv[2] || 'origin/main';

/** git, captured, trimmed, empty string on a non-zero exit we expect. */
function git(args, { allowFailure = false } = {}) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch (error) {
    if (allowFailure) return '';
    throw error;
  }
}

/**
 * Migration directory names present at a given ref.
 *
 * `git ls-tree` rather than reading the filesystem: the point of comparison is
 * what the BASE branch contains, not what is checked out.
 */
function migrationsAt(ref) {
  const out = git(['ls-tree', '--name-only', `${ref}:${MIGRATIONS}`], {
    allowFailure: true,
  });
  return out
    .split('\n')
    .map((line) => line.replace(/\/$/, '').trim())
    .filter((name) => name && name !== 'migration_lock.toml');
}

const base = migrationsAt(baseRef);
const head = migrationsAt('HEAD');

if (head.length === 0) {
  console.error(`No migrations found at HEAD:${MIGRATIONS} — is the path right?`);
  process.exit(1);
}

const baseSet = new Set(base);
const added = head.filter((name) => !baseSet.has(name));

// Removing an applied migration is its own kind of broken: `_prisma_migrations`
// still names it, so `migrate deploy` reports a migration recorded as applied
// that no longer exists in the folder and refuses to continue.
const headSet = new Set(head);
const removed = base.filter((name) => !headSet.has(name));

const problems = [];

for (const name of removed) {
  problems.push(
    `REMOVED  ${name}\n` +
      `         Every database that has applied this still records it by name.\n` +
      `         Deleting the directory makes 'prisma migrate deploy' fail on the\n` +
      `         mismatch. Write a new migration that reverses it instead.`
  );
}

if (added.length > 0) {
  // The bar every new migration has to clear. Lexicographic max, because that
  // is the comparison Prisma itself makes.
  const ceiling = base.length > 0 ? base.reduce((a, b) => (a > b ? a : b)) : '';

  for (const name of added.sort()) {
    if (!NAME_RE.test(name)) {
      problems.push(
        `MALFORMED  ${name}\n` +
          `           Expected <14-digit timestamp>_<lower_snake_case>, e.g.\n` +
          `           20270201000000_add_widget_table`
      );
      continue;
    }

    if (ceiling && name <= ceiling) {
      problems.push(
        `OUT OF ORDER  ${name}\n` +
          `              sorts at or before ${ceiling}, which is already applied.\n` +
          `              Prisma orders migrations by NAME, so this one would be\n` +
          `              recorded as pending behind migrations that already ran and\n` +
          `              'migrate deploy' would refuse the whole release.\n` +
          `\n` +
          `              This is almost always 'prisma migrate dev' stamping the real\n` +
          `              clock: this repository's prefixes run ahead of it. Rename the\n` +
          `              directory to something greater than ${ceiling}.`
      );
    }
  }
}

if (problems.length > 0) {
  console.error(`\nMigration ordering check FAILED (base: ${baseRef})\n`);
  for (const problem of problems) {
    // Indent the WHOLE block, not just its first line — a message whose
    // continuation lines hang at a different depth reads as three separate
    // findings.
    console.error(
      problem
        .split('\n')
        .map((line) => `  ${line}`)
        .join('\n') + '\n'
    );
  }
  console.error(
    `  Newest migration on ${baseRef}: ${base.reduce((a, b) => (a > b ? a : b), '(none)')}`
  );
  console.error(`  See packages/db/CLAUDE.md for the naming convention.\n`);
  process.exit(1);
}

if (added.length === 0) {
  console.log('OK: no migrations added.');
} else {
  console.log(`OK: ${added.length} migration(s) added, all sorting after the base branch:`);
  for (const name of added.sort()) console.log(`  + ${name}`);
}
