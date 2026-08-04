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
// READS ONE TENANT AT A TIME, and that is not a stylistic choice. `builder_pages` is
// ENABLE + FORCE row level security and the connection role is `sparx_app`, a
// non-superuser — so a bare `findMany` across the table returns ZERO rows and this
// report cheerfully prints "no duplicates". A pre-flight that cannot fail loudly is
// worse than no pre-flight, because the answer it gives is the one you were hoping
// for. The scan therefore walks `tenants` (which is not RLS-scoped) and re-reads under
// `set_config('app.tenant_id', …, true)` per tenant — the same shape the backfill
// migration itself uses, for the same reason (packages/db/CLAUDE.md, "Backfilling a
// FORCE-RLS table"). The tenant count is printed so a run that saw nothing is
// distinguishable from a run that had nothing to see.
//
// Lives HERE rather than in the repo-root `scripts/` because `@prisma/client` is a
// dependency of this package — pnpm links it into `packages/db/node_modules` only, so
// a root-level script cannot resolve it at all.

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
  /** Whether the row carries a silica draft body. TIER IS THE COLUMN THIS REPORT WAS
   *  MISSING, and the omission cost a production outage: it counted legacy sparx-tier
   *  templates in its totals without ever saying they were legacy, so "40 templates,
   *  0 collisions, 40 already addressed" read as an all-clear while 36 of those 40 were
   *  rows `ensureRecordPagesTx` was about to collide with. */
  silicaDraftTree: unknown;
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

/** Every record template on the platform, read under each tenant's own RLS context. */
async function scanAllTenants(): Promise<{ rows: Row[]; tenants: number }> {
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  const rows: Row[] = [];

  for (const tenant of tenants) {
    // One transaction per tenant: `set_config(..., true)` is transaction-local, so the
    // context and the read have to share it, and a single long transaction spanning
    // every tenant would trip the interactive-transaction timeout on a large platform.
    const found = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`select set_config('app.tenant_id', $1, true)`, tenant.id);
      return tx.builderPage.findMany({
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
          silicaDraftTree: true,
        },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      });
    });
    rows.push(...found);
  }

  return { rows, tenants: tenants.length };
}

async function main() {
  const { rows, tenants } = await scanAllTenants();

  const buckets = groupBy(rows, (r) => `${r.propertyId} ${r.recordType}`);
  const collisions = [...buckets.entries()].filter(([, group]) => group.length > 1);

  // Already-addressed rows are not a collision, but they ARE a sign the backfill has
  // partly run (or that a tenant saved after the code shipped) — worth surfacing so a
  // re-run is not mistaken for a fresh one.
  const alreadyAddressed = rows.filter((r) => (r.slug ?? '').includes(':'));

  // Tier of the rows already sitting at an address. A LEGACY one is the shape that took
  // the builder down: the migration addresses by `kind`+`record_type` without regard to
  // tier, but only silica rows reach the page switcher — so the property reads as still
  // missing its product page while the address is already spoken for. `recordPagePlan`
  // upgrades those in place now; this line is how you SEE them before a release, which
  // is the whole reason this file exists.
  const legacyAtAddress = alreadyAddressed.filter((r) => r.silicaDraftTree == null);

  console.log(`tenants scanned                    : ${tenants}`);
  console.log(`record templates for routed types : ${rows.length}`);
  console.log(`distinct (property, record type)   : ${buckets.size}`);
  console.log(`already carrying an address        : ${alreadyAddressed.length}`);
  console.log(
    `  ...of those, LEGACY (no silica)  : ${legacyAtAddress.length}  → upgraded in place on next builder load`
  );
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
