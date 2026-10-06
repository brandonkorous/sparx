// The SQL that keeps a trade account's credit used must ask "is this owed?" the
// same way the app does.
//
// `OWED_DOCUMENT_WHERE` is the app's one answer (issue 857): unpaid, partial or
// overdue, NOT an offer, NOT on a draft or void stage. `sync_b2b_credit_used`
// is a Postgres function, so it cannot import that answer and has to spell it.
// It spelled only the first clause, and Wasatch Front's unaccepted $4,075.60
// quote used up $4,075.60 of its credit (sparx persona issue 084).
//
// This reads the NEWEST migration that defines the function, which is the
// definition every database ends up running, and checks it names every offer
// workflow and every not-owed stage the app knows about.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { NOT_OWED_STAGE_TYPES, PRICE_OFFER_WORKFLOW_SLUGS } from '@wizeworks/crm-schemas/builtins';

/** Walks up from this file to the folder holding the migrations. */
function migrationsDir(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const candidate = join(dir, 'packages', 'db', 'prisma', 'migrations');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) throw new Error('No packages/db/prisma/migrations above this test');
    dir = parent;
  }
}

function newestCreditUsedDefinition(): { name: string; sql: string } {
  const dir = migrationsDir();
  const defining = readdirSync(dir)
    .filter((name) => existsSync(join(dir, name, 'migration.sql')))
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(dir, name, 'migration.sql'), 'utf8') }))
    .filter((m) => /FUNCTION\s+sync_b2b_credit_used\s*\(/.test(m.sql));
  const newest = defining.at(-1);
  if (!newest) throw new Error('No migration defines sync_b2b_credit_used');
  return newest;
}

describe('sync_b2b_credit_used', () => {
  const { name, sql } = newestCreditUsedDefinition();
  const body = sql.slice(sql.search(/FUNCTION\s+sync_b2b_credit_used\s*\(/), sql.indexOf('$$;'));

  it(`leaves out every kind of offer (${name})`, () => {
    expect(PRICE_OFFER_WORKFLOW_SLUGS.length).toBeGreaterThan(0);
    for (const slug of PRICE_OFFER_WORKFLOW_SLUGS) expect(body).toContain(`'${slug}'`);
  });

  it(`leaves out every stage nothing is owed on (${name})`, () => {
    expect(NOT_OWED_STAGE_TYPES.length).toBeGreaterThan(0);
    for (const type of NOT_OWED_STAGE_TYPES) expect(body).toContain(`'${type}'`);
  });
});
