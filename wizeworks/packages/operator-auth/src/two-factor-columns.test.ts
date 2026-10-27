import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { twoFactor } from 'better-auth/plugins';
import { describe, expect, it } from 'vitest';

// The operator instance talks to wize_admin through Kysely, not Prisma, so no
// generated client notices when a Better Auth upgrade grows the twoFactor
// plugin's schema. 1.6.33 added `failedVerificationCount` and `lockedUntil`, and
// every verify then failed with 42703 until a migration caught up. This reads
// the migrations and asks the plugin itself which columns it will write.

const MIGRATIONS = join(import.meta.dirname, '../../db/prisma/migrations');

/** Every column the migrations create or add on one wize_admin table. */
function columnsOf(table: string): Set<string> {
  const target = new RegExp(`^(CREATE|ALTER) TABLE\\s+"wize_admin"\\."${table}"\\s`);
  const columns = new Set<string>();
  for (const dir of readdirSync(MIGRATIONS, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const sql = readFileSync(join(MIGRATIONS, dir.name, 'migration.sql'), 'utf8').replace(
      /--.*$/gm,
      ''
    );
    for (const statement of sql.split(';').map((s) => s.trim())) {
      if (!target.test(statement)) continue;
      // Only a column definition opens a line with a quoted name; constraints
      // and indexes start with a keyword.
      for (const m of statement.matchAll(/(?:^|\(|,|ADD COLUMN)\s*"(\w+)"\s+[A-Z]/g)) {
        columns.add(m[1]!);
      }
    }
  }
  return columns;
}

const schema = twoFactor().schema;

describe('wize_admin has every column the twoFactor plugin writes', () => {
  it('platform_operator_two_factors', () => {
    const columns = columnsOf('platform_operator_two_factors');
    expect([...columns].sort()).toEqual(
      expect.arrayContaining(Object.keys(schema.twoFactor.fields))
    );
  });

  it('platform_operators', () => {
    const columns = columnsOf('platform_operators');
    expect([...columns].sort()).toEqual(expect.arrayContaining(Object.keys(schema.user.fields)));
  });
});
