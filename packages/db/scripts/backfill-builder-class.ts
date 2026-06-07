#!/usr/bin/env tsx
// Backfill — migrate persisted Builder trees from the pre-cutover box/layout
// shape to the class-only model (docs/61).
//
// WHY: the storefront renderer and the editor canvas are class-only — they read
// ONLY `node.class`, and the node zod schema strips unknown keys. Rows authored
// or blueprint-installed BEFORE the cutover still carry `box`/`layout` OBJECTS and
// no `class`, so at render every layout/spacing/surface/grid utility is dropped
// (only the site-ui component base + inline button styles survive — "as though
// every style was dropped"). This rewrites each stored tree through
// @sparx/builder-schemas#migrateTree, which replays the SAME compile a fresh seed
// runs — lossless (the box/layout data is intact) and idempotent (a class-only
// tree passes through untouched, so re-running is a no-op).
//
// TABLES (all tenant-scoped, FORCE RLS):
//   builder_pages               draft_tree, published_tree
//   builder_layouts             draft_tree, published_tree   (site chrome / header+footer)
//   builder_emails              draft_tree, published_tree   (Email Builder, docs/52)
//   builder_component_versions  tree
// The Email Builder uses the SAME BuilderNode model (email.ts imports
// BuilderNodeSchema), and its renderer reads node.class via readEmailLayout()
// — whose token vocabulary IS box-to-class's output (p-N, gap-N, grid, bg-*) —
// so the identical converter applies. A DB-wide scan of every json column for
// the box/backgroundWidth signature confirms these four are the only affected
// tables (brand = design tokens, CMS = TipTap docs, sitebuilder = a separate
// legacy model — none carry builder box/layout).
//
// RLS: in prod `sparx_owner` is a NON-superuser, so FORCE-RLS reads/writes need
// the tenant GUC set (cf. [memory] sparx_db_rls_pattern). We loop tenants and run
// each tenant's batch inside a transaction that sets `app.tenant_id`.
//
// SAFETY: DRY-RUN by default — prints what it would change. Pass `--apply` to
// write. After a backfill, PUBLISHED sites should be re-published so their
// compiled stylesheet regenerates from the migrated tree (the draft/editor canvas
// recompiles live, so it's fixed immediately).
//
//   pnpm --filter @sparx/db db:backfill:builder-class            # dry-run
//   pnpm --filter @sparx/db db:backfill:builder-class -- --apply # write

import { PrismaClient } from '@prisma/client';
import { migrateTree, type LegacyNode } from '@sparx/builder-schemas';

const APPLY = process.argv.includes('--apply');

interface TableSpec {
  table: string;
  /** JSON tree columns on the table (a null column is skipped). */
  cols: string[];
}

const TABLES: readonly TableSpec[] = [
  { table: 'builder_pages', cols: ['draft_tree', 'published_tree'] },
  { table: 'builder_layouts', cols: ['draft_tree', 'published_tree'] },
  { table: 'builder_emails', cols: ['draft_tree', 'published_tree'] },
  { table: 'builder_component_versions', cols: ['tree'] },
];

const prisma = new PrismaClient();

interface ColResult {
  json: string;
  converted: number;
  droppedHiddenOn: number;
}

/** Migrate one tree value. Returns null when there's nothing to convert (already
 *  class-only, or not an object), so unchanged columns are never rewritten. */
function migrateColumn(value: unknown): ColResult | null {
  if (!value || typeof value !== 'object') return null;
  const { tree, stats } = migrateTree(value as LegacyNode);
  if (stats.converted === 0) return null;
  return {
    json: JSON.stringify(tree),
    converted: stats.converted,
    droppedHiddenOn: stats.droppedHiddenOn,
  };
}

async function main(): Promise<void> {
  const tenants = await prisma.$queryRaw<
    { id: string }[]
  >`SELECT id FROM tenants ORDER BY created_at`;

  let rowsTouched = 0;
  let treesConverted = 0;
  let nodesConverted = 0;
  let hiddenDropped = 0;

  for (const { id: tenantId } of tenants) {
    await prisma.$transaction(async (tx) => {
      // FORCE-RLS scoping: set the tenant GUC for this connection/transaction so a
      // non-superuser owner (prod) can read + write this tenant's rows.
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);

      for (const { table, cols } of TABLES) {
        const selectList = ['id', ...cols].join(', ');
        const rows = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
          `SELECT ${selectList} FROM ${table} WHERE tenant_id = $1::uuid`,
          tenantId
        );

        for (const row of rows) {
          const sets: { col: string; json: string }[] = [];
          let rowNodes = 0;
          for (const col of cols) {
            const res = migrateColumn(row[col]);
            if (res) {
              sets.push({ col, json: res.json });
              rowNodes += res.converted;
              nodesConverted += res.converted;
              hiddenDropped += res.droppedHiddenOn;
              treesConverted += 1;
            }
          }
          if (sets.length === 0) continue;

          rowsTouched += 1;
          if (APPLY) {
            // $1 = id; $2.. = each migrated tree json.
            const setSql = sets.map((s, i) => `${s.col} = $${i + 2}::jsonb`).join(', ');
            await tx.$executeRawUnsafe(
              `UPDATE ${table} SET ${setSql} WHERE id = $1::uuid`,
              row.id,
              ...sets.map((s) => s.json)
            );
          }
          const verb = APPLY ? 'migrated' : 'would migrate';
          console.log(
            `${verb} ${table} ${String(row.id)} — ${rowNodes} node(s), col(s): ${sets.map((s) => s.col).join(', ')}`
          );
        }
      }
    });
  }

  console.log('───');
  console.log(
    `${APPLY ? 'APPLIED' : 'DRY-RUN'}: ${rowsTouched} row(s), ${treesConverted} tree(s), ${nodesConverted} node(s) converted` +
      (hiddenDropped ? `, ${hiddenDropped} non-empty hiddenOn dropped (no class equivalent)` : '')
  );
  if (!APPLY && rowsTouched > 0) console.log('Re-run with `-- --apply` to write.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
