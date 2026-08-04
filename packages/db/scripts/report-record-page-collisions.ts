#!/usr/bin/env tsx
// Pre-flight for the record-page address backfill: which properties would collide?
//
//   pnpm --filter @sparx/db db:report:record-pages
//
// WHY THIS RUNS BEFORE THE MIGRATION. A page that renders one record used to be
// identified by `kind='collection'` + `record_type`, with no slug. The backfill gives
// each one the address its record type implies (`commerce.product` → `/products/:handle`)
// so it becomes an ordinary, editable page. But `(tenant_id, property_id, slug)` is
// UNIQUE, and nothing ever stopped a property from holding SEVERAL templates for one
// record type — `builder_page_assignments` exists precisely so a specific product can be
// pinned to a different one. Two of those would collide the moment they were given the
// same address.
//
// A collision is not a crash the migration can shrug off: it aborts the release. So this
// reports the set FIRST, read-only, and the migration is only run once the answer is
// known. Where duplicates exist the migration keeps the winner (`is_default`, else lowest
// `position`) and demotes the rest to ordinary unrouted pages — this is the report that
// says whose site that would happen to.
//
// Reads through the bare client (no RLS context): it is an operator-run audit across
// every tenant, which is the one thing tenant-scoped reads cannot do. It lives HERE
// rather than in the repo-root `scripts/` because `@prisma/client` is a dependency of
// this package — pnpm links it into `packages/db/node_modules` only, so a root-level
// script cannot resolve it at all.

import { PrismaClient } from '@prisma/client';

const ROUTED = [
  'commerce.product',
  'commerce.collection',
  'commerce.category',
  'scheduling.service',
  'cms.blog_post',
];

const prisma = new PrismaClient();

interface Row {
  id: string;
  name: string;
  slug: string | null;
  tenantId: string;
  propertyId: string | null;
  recordType: string | null;
  isDefault: boolean;
  position: number;
  publishedAt: Date | null;
}

/** Group by a derived key, preserving insertion order. */
function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const bucket = out.get(k);
    if (bucket) bucket.push(row);
    else out.set(k, [row]);
  }
  return out;
}

async function main() {
  const rows: Row[] = await prisma.builderPage.findMany({
    where: { kind: 'collection', recordType: { in: ROUTED } },
    select: {
      id: true,
      name: true,
      slug: true,
      tenantId: true,
      propertyId: true,
      recordType: true,
      isDefault: true,
      position: true,
      publishedAt: true,
    },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });

  const buckets = groupBy(rows, (r) => `${r.propertyId} ${r.recordType}`);
  const collisions = [...buckets.entries()].filter(([, group]) => group.length > 1);

  // Already-addressed rows are not a collision, but they ARE a sign the backfill has
  // partly run (or that a tenant saved after the code shipped) — worth surfacing so a
  // re-run is not mistaken for a fresh one.
  const alreadyAddressed = rows.filter((r) => (r.slug ?? '').includes(':'));

  console.log(`record templates for routed types : ${rows.length}`);
  console.log(`distinct (property, record type)   : ${buckets.size}`);
  console.log(`already carrying an address        : ${alreadyAddressed.length}`);
  console.log(`properties needing a decision      : ${collisions.length}`);

  if (collisions.length === 0) {
    console.log('\nNo duplicates. The backfill can run without demoting anything.');
    return;
  }

  console.log('\nEach group below keeps ONE page at the address; the others become');
  console.log('ordinary pages (kind=singleton, record_type=NULL, no slug).\n');

  for (const [key, group] of collisions) {
    const [propertyId, recordType] = key.split(' ');
    // Same rule the migration applies, so this report names the actual winner rather
    // than a plausible one.
    const winner =
      group.find((r) => r.isDefault) ?? [...group].sort((a, b) => a.position - b.position)[0];
    // `collisions` only holds groups of 2+, so this is unreachable — it is here because
    // an indexed read is `T | undefined` under the strict compiler, not because a
    // collision group can be empty.
    if (!winner) continue;
    console.log(`property ${propertyId}  tenant ${winner.tenantId}`);
    console.log(`  ${recordType} — ${group.length} templates`);
    for (const r of group) {
      const mark = r.id === winner.id ? 'KEEP  ' : 'demote';
      const live = r.publishedAt ? 'published' : 'draft';
      console.log(`    ${mark} ${r.id}  pos=${r.position}  ${live}  ${JSON.stringify(r.name)}`);
    }
    console.log('');
  }

  // Non-zero exit so a pipeline step can gate on it; a human run just reads the list.
  process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
