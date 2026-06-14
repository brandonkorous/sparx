#!/usr/bin/env tsx
// Backfill — rewrite the `sf-` CSS prefix to `st-` inside persisted Builder trees
// (store→site rename, docs/34 §5).
//
// WHY: @sparx/site-ui's class + token prefix was `sf-` (= "storefront"). It is now
// `st-` (site). The library no longer defines `sf-*` classes, so any stored node
// tree that still carries `sf-…` classes (e.g. `st-reveal` motion, `st-c-*` color
// roles, surface utilities) would render unstyled until rewritten. A DB-wide scan
// of every json/jsonb column for the `sf-` signature confirms the affected columns
// are the same four Builder tree tables the box→class backfill covers (compiled
// token maps store BARE keys — the `--st-` prefix is added at CSS-gen, so they need
// no rewrite; the sitebuilder snapshot tables carry no `sf-`).
//
// SAFETY: rewrites ONLY `node.class` string values (a deep walk keyed on `class`),
// never prose/text/URL content — so a heading that happens to contain "sf-" is left
// alone. Idempotent: a tree with no `sf-` passes through untouched, so re-running is
// a no-op. DRY-RUN by default; pass `--apply` to write.
//
// RLS: prod `sparx_owner` is a NON-superuser, so FORCE-RLS reads/writes need the
// tenant GUC set (memory: sparx_db_rls_pattern). We loop tenants and run each
// tenant's batch inside a transaction that sets `app.tenant_id`.
//
// After a backfill, PUBLISHED sites should be re-published so the compiled
// stylesheet regenerates with the `st-` selectors (the draft/editor canvas
// recompiles live).
//
//   pnpm --filter @sparx/db db:backfill:sf-to-st            # dry-run
//   pnpm --filter @sparx/db db:backfill:sf-to-st -- --apply # write

import { PrismaClient } from '@prisma/client';

const APPLY = process.argv.includes('--apply');

interface TableSpec {
  table: string;
  cols: string[];
}

const TABLES: readonly TableSpec[] = [
  { table: 'builder_pages', cols: ['draft_tree', 'published_tree'] },
  { table: 'builder_layouts', cols: ['draft_tree', 'published_tree'] },
  { table: 'builder_emails', cols: ['draft_tree', 'published_tree'] },
  { table: 'builder_component_versions', cols: ['tree'] },
];

const prisma = new PrismaClient();

/** Deep-rewrite `sf-` → `st-` inside every `class` string of a node tree. Returns
 *  the rewritten value + how many class strings changed (0 = nothing to do). */
function rewriteClasses(value: unknown): { value: unknown; count: number } {
  let count = 0;
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      for (const k of Object.keys(o)) {
        const cur = o[k];
        if (k === 'class' && typeof cur === 'string' && cur.includes('sf-')) {
          o[k] = cur.replace(/sf-/g, 'st-');
          count += 1;
        } else {
          o[k] = walk(cur);
        }
      }
      return o;
    }
    return v;
  };
  const out = walk(value);
  return { value: out, count };
}

function migrateColumn(value: unknown): { json: string; count: number } | null {
  if (!value || typeof value !== 'object') return null;
  const { value: out, count } = rewriteClasses(value);
  if (count === 0) return null;
  return { json: JSON.stringify(out), count };
}

async function main(): Promise<void> {
  const tenants = await prisma.$queryRaw<
    { id: string }[]
  >`SELECT id FROM tenants ORDER BY created_at`;

  let rowsTouched = 0;
  let classesRewritten = 0;

  for (const { id: tenantId } of tenants) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);

      for (const { table, cols } of TABLES) {
        const selectList = ['id', ...cols].join(', ');
        const rows = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
          `SELECT ${selectList} FROM ${table} WHERE tenant_id = $1::uuid`,
          tenantId
        );

        for (const row of rows) {
          const sets: { col: string; json: string }[] = [];
          let rowClasses = 0;
          for (const col of cols) {
            const res = migrateColumn(row[col]);
            if (res) {
              sets.push({ col, json: res.json });
              rowClasses += res.count;
              classesRewritten += res.count;
            }
          }
          if (sets.length === 0) continue;

          rowsTouched += 1;
          if (APPLY) {
            const setSql = sets.map((s, i) => `${s.col} = $${i + 2}::jsonb`).join(', ');
            await tx.$executeRawUnsafe(
              `UPDATE ${table} SET ${setSql} WHERE id = $1::uuid`,
              row.id,
              ...sets.map((s) => s.json)
            );
          }
          const verb = APPLY ? 'rewrote' : 'would rewrite';
          console.log(
            `${verb} ${table} ${String(row.id)} — ${rowClasses} class string(s), col(s): ${sets.map((s) => s.col).join(', ')}`
          );
        }
      }
    });
  }

  console.log('───');
  console.log(
    `${APPLY ? 'APPLIED' : 'DRY-RUN'}: ${rowsTouched} row(s), ${classesRewritten} class string(s) rewritten sf- → st-`
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
