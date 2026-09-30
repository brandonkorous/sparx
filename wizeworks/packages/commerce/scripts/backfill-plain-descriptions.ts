#!/usr/bin/env tsx
// Backfill — make `commerce_products.description` hold the plain text it has
// always been contracted to hold.
//
// WHY: the field is plain text everywhere a person meets it. The console edits it
// in a bare textarea, the site renders it as text split at blank lines, the meta
// description and the JSON-LD both read it as words. One line said otherwise:
//
//     description: z.string().max(50_000).nullish(), // rich text (HTML allowed)
//
// so the sample-data packs wrote HTML into it and shoppers read the tags
// (issue 848). The packs are fixed, the schema now normalizes on parse, and every
// reader runs the same `plainText`, so nobody SEES a tag any more. This closes the
// last gap: the stored rows themselves, so a reader added later cannot bring the
// defect back by doing the obvious thing.
//
// Measured on the development database when this was written:
//
//     185 of 642 product descriptions carried markup, across 9 businesses
//
// ONE RULE, NOT A SECOND ONE. This imports the same `plainText` the schema, the
// site, the search index and both consoles use. A hand-written SQL version of the
// same regexes is exactly the drift this whole fix exists to remove.
// [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// IDEMPOTENT: a description with no complete tag in it is returned unchanged by
// `plainText`, is therefore never written, and re-running is a no-op.
//
// RLS: `commerce_products` is tenant-scoped, so every read and write runs inside
// `withTenant`. `tenants` is not, so that read is plain.
//
// DRY-RUN by default; pass `--apply` to write.
//
//   pnpm --filter @wizeworks/commerce db:backfill:plain-descriptions
//   pnpm --filter @wizeworks/commerce db:backfill:plain-descriptions -- --apply

import { plainText } from '@wizeworks/commerce-schemas';
import { prisma, withTenant } from '@wizeworks/db';

const APPLY = process.argv.includes('--apply');

/** A short, readable before/after for the log, so a dry-run is reviewable rather
 *  than just a count. */
function clip(text: string, max = 70): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max)}…`;
}

async function main(): Promise<void> {
  const tenants = await prisma.$queryRaw<{ id: string; name: string }[]>`
    SELECT id, name FROM tenants ORDER BY created_at
  `;

  let changed = 0;
  let scanned = 0;
  const businesses = new Set<string>();

  for (const tenant of tenants) {
    await withTenant({ tenantId: tenant.id }, async (tx) => {
      const rows = await tx.product.findMany({
        where: { tenantId: tenant.id, description: { not: null } },
        select: { id: true, title: true, description: true },
      });

      for (const row of rows) {
        scanned += 1;
        const current = row.description ?? '';
        const next = plainText(current);
        if (next === current) continue;

        changed += 1;
        businesses.add(tenant.name);
        if (APPLY) {
          await tx.product.update({
            where: { id: row.id },
            data: { description: next === '' ? null : next },
          });
        }
        console.log(
          `${APPLY ? 'cleaned' : 'would clean'} ${tenant.name} · ${row.title}\n` +
            `    before  ${clip(current)}\n` +
            `    after   ${clip(next)}`
        );
      }
    });
  }

  console.log('───');
  console.log(
    `${APPLY ? 'APPLIED' : 'DRY-RUN'}: ${String(changed)} of ${String(scanned)} ` +
      `product description(s) carried markup, across ${String(businesses.size)} business(es)`
  );
  if (!APPLY && changed > 0) console.log('Re-run with `-- --apply` to write.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err: unknown) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
